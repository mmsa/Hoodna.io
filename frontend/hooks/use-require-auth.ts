'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

/**
 * Sends signed-out visitors to the login page.
 *
 * Gated pages commonly guard their render with `if (isLoading || !user) return
 * <Spinner/>` and guard their effects with `if (!user) return`. For a signed-out
 * visitor that combination never resolves: loading finishes, `user` stays null,
 * and the page spins forever with no way forward. Pages that need a session
 * should call this so that case always ends in a redirect.
 */
export function useRequireAuth() {
  const auth = useAuth()
  const router = useRouter()

  // No token at all is decided immediately; a token that failed to resolve has
  // already been cleared by useAuth, so !user once loading ends is final.
  const shouldRedirect = !auth.isLoading && !auth.user

  useEffect(() => {
    if (!shouldRedirect) return
    router.replace('/auth/login')
  }, [shouldRedirect, router])

  return { ...auth, isRedirecting: shouldRedirect }
}
