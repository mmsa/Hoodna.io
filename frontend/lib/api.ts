import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401 and redirect to compound selection on 400 (no compound)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle compound selection requirement
    // BUT: Don't redirect service providers or moderators (they don't need compound_id)
    if (error.response?.status === 400 && error.response?.data?.detail?.includes('compound')) {
      // Only redirect if we're not already on the compound selection page
      // AND if user is not on service provider or moderator pages
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/onboarding/compound-select')) {
        const pathname = window.location.pathname
        // Don't redirect if user is on service provider or moderator pages
        const isServiceProviderPage = pathname.startsWith('/provider') || 
                                      pathname.startsWith('/services') ||
                                      pathname.startsWith('/onboarding/provider')
        const isModeratorPage = pathname.startsWith('/moderator') ||
                                pathname.startsWith('/onboarding/moderator')
        
        if (!isServiceProviderPage && !isModeratorPage) {
          window.location.href = '/onboarding/compound-select'
        }
        return Promise.reject(error)
      }
    }

    // Handle verification requirement
    // BUT: Don't redirect if user is on compound-select page (they need to select compound first)
    if (error.response?.status === 403 && (error.response?.data?.detail?.includes('verified') || error.response?.data?.detail?.includes('approved'))) {
      // Only redirect if we're not already on the verification page AND not on compound-select page
      if (typeof window !== 'undefined' && 
          !window.location.pathname.includes('/verification') &&
          !window.location.pathname.includes('/onboarding/compound-select') &&
          !window.location.pathname.includes('/onboarding/choose-role') &&
          !window.location.pathname.includes('/onboarding/provider') &&
          !window.location.pathname.includes('/onboarding/moderator') &&
          !window.location.pathname.includes('/provider/status') &&
          !window.location.pathname.includes('/moderator/status')) {
        window.location.href = '/verification'
        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = Cookies.get('refresh_token')
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          }, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
          const { access_token, refresh_token } = response.data
          Cookies.set('access_token', access_token)
          Cookies.set('refresh_token', refresh_token)
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        window.location.href = '/auth/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api

