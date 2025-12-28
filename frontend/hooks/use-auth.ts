'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Cookies from 'js-cookie'

interface User {
  id: number
  name: string
  email: string
  phone?: string
  role: string
  status: string
  compound_id?: number
}

export function useAuth() {
  const token = typeof window !== 'undefined' ? Cookies.get('access_token') : null
  const isAuthenticated = !!token

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ['current-user'],
    queryFn: async () => {
      if (!token) return null
      try {
        const response = await api.get('/api/auth/me')
        return response.data
      } catch (error) {
        // If 401, user is not authenticated
        if ((error as any).response?.status === 401) {
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          return null
        }
        throw error
      }
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'MODERATOR',
  }
}

