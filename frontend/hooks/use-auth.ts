'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api, { persistUserRole } from '@/lib/api'
import Cookies from 'js-cookie'
import { useCallback, useEffect } from 'react'

interface User {
  id: number
  name: string
  email: string
  phone?: string
  avatar_url?: string | null
  role: string
  status: string
  compound_id?: number
  verification_status?: string | null
  verified_compound_ids?: number[] | null
  is_verified_for_current_compound?: boolean | null
  can_post?: boolean
  can_comment?: boolean
  can_create_listing?: boolean
  needs_profile_setup?: boolean | null
  phone_verified?: boolean | null
  email_verified?: boolean | null
  needs_contact_verification?: boolean | null
  creation_source?: string | null
  needs_imported_content_choice?: boolean | null
  imported_content_choice?: string | null
}

export function useAuth() {
  const queryClient = useQueryClient()
  const token = typeof window !== 'undefined' ? Cookies.get('access_token') : null
  const isAuthenticated = !!token

  // Invalidate user cache when token changes to prevent stale data
  useEffect(() => {
    if (token) {
      // Invalidate cache to force fresh fetch with new token
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    } else {
      // Clear cache if no token
      persistUserRole(null)
      queryClient.setQueryData(['current-user'], null)
    }
  }, [token, queryClient])

  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ['current-user', token], // Include token in query key to prevent stale data
    queryFn: async () => {
      if (!token) return null
      try {
        const response = await api.get('/api/auth/me')
        const userData = response.data
        // Verify the token matches the user (safety check)
        if (userData && typeof window !== 'undefined') {
          const currentToken = Cookies.get('access_token')
          if (!currentToken || currentToken !== token) {
            // Token changed, return null to force re-fetch
            return null
          }
          persistUserRole(userData.role)
        }
        return userData
      } catch (error) {
        // If 401, user is not authenticated
        if ((error as any).response?.status === 401) {
          Cookies.remove('access_token', { path: '/' })
          Cookies.remove('refresh_token', { path: '/' })
          persistUserRole(null)
          queryClient.setQueryData(['current-user'], null)
          return null
        }
        throw error
      }
    },
    enabled: isAuthenticated && !!token,
    retry: false,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache user data
  })

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Local session cleanup must still succeed if the server is unavailable.
    }

    Cookies.remove('access_token', { path: '/' })
    Cookies.remove('refresh_token', { path: '/' })
    persistUserRole(null)
    await queryClient.cancelQueries({ queryKey: ['current-user'] })
    queryClient.setQueriesData({ queryKey: ['current-user'] }, null)
    await queryClient.invalidateQueries({
      queryKey: ['current-user'],
      refetchType: 'none',
    })
  }, [queryClient])

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'MODERATOR',
    logout,
    refreshUser: async () => {
      // Invalidate both generic and token-scoped keys, then refetch
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      await queryClient.invalidateQueries({ queryKey: ['current-user', token] })
      return refetch()
    },
  }
}
