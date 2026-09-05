import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://eljiran-api.onrender.com'

export const USER_ROLE_STORAGE_KEY = 'eljiran_user_role'

export function persistUserRole(role: string | null | undefined) {
  if (typeof window === 'undefined') return
  if (role) {
    window.sessionStorage.setItem(USER_ROLE_STORAGE_KEY, role)
    Cookies.set(USER_ROLE_STORAGE_KEY, role, { path: '/', sameSite: 'lax' })
  } else {
    window.sessionStorage.removeItem(USER_ROLE_STORAGE_KEY)
    Cookies.remove(USER_ROLE_STORAGE_KEY, { path: '/' })
  }
}

function readStoredUserRole(): string | null {
  if (typeof window === 'undefined') return null
  return (
    window.sessionStorage.getItem(USER_ROLE_STORAGE_KEY) ||
    Cookies.get(USER_ROLE_STORAGE_KEY) ||
    null
  )
}

function isPlatformStaffRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MODERATOR'
}

const AUTH_COOKIE_OPTS = { expires: 30, path: '/', sameSite: 'lax' as const }

export function clearAuthTokens() {
  Cookies.remove('access_token', { path: '/' })
  Cookies.remove('refresh_token', { path: '/' })
}

export function persistAuthTokens(accessToken: string, refreshToken: string): boolean {
  clearAuthTokens()
  Cookies.set('access_token', accessToken, AUTH_COOKIE_OPTS)
  Cookies.set('refresh_token', refreshToken, AUTH_COOKIE_OPTS)
  return Cookies.get('access_token') === accessToken
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshInFlight: Promise<string | null> | null = null

function isPublicPathname(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/features') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/delete-account')
  )
}

function forceSignOut() {
  clearAuthTokens()
  persistUserRole(null)
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const refreshToken = Cookies.get('refresh_token')
    if (!refreshToken) return null
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/refresh`,
        { refresh_token: refreshToken },
        {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        },
      )
      const { access_token, refresh_token } = response.data
      if (!access_token) return null
      persistAuthTokens(access_token, refresh_token || refreshToken)
      return access_token as string
    } catch {
      return null
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

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

    if (error.response?.status >= 500 && !originalRequest?.url?.includes('/api/telemetry/')) {
      void import('@/lib/telemetry').then(({ reportError }) => {
        reportError(error, {
          error_kind: 'api',
          status_code: error.response.status,
          request_id: error.response.headers?.['x-request-id'],
        })
      })
    }

    const pathname =
      typeof window !== 'undefined' ? window.location.pathname : ''
    const storedRole = readStoredUserRole()
    const isStaff = isPlatformStaffRole(storedRole)

    // Handle compound selection requirement
    // BUT: Don't redirect service providers, compound mods, or platform staff
    if (error.response?.status === 400 && error.response?.data?.detail?.includes('compound')) {
      if (
        typeof window !== 'undefined' &&
        !pathname.includes('/onboarding/compound-select') &&
        !isStaff
      ) {
        const isServiceProviderPage =
          pathname.startsWith('/provider') ||
          pathname.startsWith('/services') ||
          pathname.startsWith('/onboarding/provider')
        const isModeratorPage =
          pathname.startsWith('/moderator') ||
          pathname.startsWith('/onboarding/moderator')
        const isAdminPage = pathname.startsWith('/admin')

        if (!isServiceProviderPage && !isModeratorPage && !isAdminPage) {
          window.location.href = '/onboarding/compound-select?returnTo=/feed'
        }
        return Promise.reject(error)
      }
    }

    // Handle verification requirement — never bounce platform staff to /verification
    if (
      error.response?.status === 403 &&
      (error.response?.data?.detail?.includes('verified') ||
        error.response?.data?.detail?.includes('approved'))
    ) {
      if (
        typeof window !== 'undefined' &&
        !isStaff &&
        !pathname.includes('/verification') &&
        !pathname.includes('/onboarding/compound-select') &&
        !pathname.includes('/onboarding/choose-role') &&
        !pathname.includes('/auth/verify-contact') &&
        !pathname.includes('/settings') &&
        !pathname.includes('/profile') &&
        !pathname.includes('/onboarding/provider') &&
        !pathname.includes('/onboarding/moderator') &&
        !pathname.includes('/provider/status') &&
        !pathname.includes('/moderator/status') &&
        !pathname.includes('/services') &&
        !pathname.includes('/provider') &&
        !pathname.includes('/admin')
      ) {
        window.location.href = '/verification'
        return Promise.reject(error)
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const accessToken = await refreshAccessToken()
      if (accessToken) {
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      }
      forceSignOut()
      if (typeof window !== 'undefined' && pathname && !isPublicPathname(pathname)) {
        window.location.href = '/auth/login'
      }
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

export default api
