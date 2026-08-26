'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import {
  getResidentWebRoute,
  isResidentRole,
  canAccessVerificationUpload,
  isVerifiedForCurrentCompound,
  isPlatformStaff,
  needsContactVerification,
} from '@/lib/resident-routing'

interface RoleGuardProps {
  children: React.ReactNode
}

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/phone-login',
  '/auth/otp-verify',
  '/auth/verify-contact',
  '/',
  '/features',
]

export function RoleGuard({ children }: RoleGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!pathname) return

    if (PUBLIC_ROUTES.some((route) => pathname === route || (route !== '/' && pathname.startsWith(route)))) {
      return
    }

    // Marketing / public content that doesn't need auth
    if (pathname.startsWith('/features')) return

    if (!user) {
      // Allow landing and auth only
      if (!pathname.startsWith('/auth')) {
        router.replace('/auth/login')
      }
      return
    }

    // Platform admins/moderators: full app access, no verification gates
    if (isPlatformStaff(user.role)) {
      return
    }

    // Chat-import / invited accounts must finish name + password on profile first.
    if (user.needs_profile_setup) {
      if (
        pathname.startsWith('/profile') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/auth')
      ) {
        return
      }
      router.replace('/profile')
      return
    }

    // Password signup: require phone (+ email if provided) OTP before onboarding.
    if (needsContactVerification(user)) {
      if (pathname.startsWith('/auth/verify-contact') || pathname.startsWith('/auth/login')) {
        return
      }
      router.replace('/auth/verify-contact')
      return
    }

    if (!user.role) {
      if (
        pathname.startsWith('/onboarding/choose-role') ||
        pathname.startsWith('/onboarding/provider') ||
        pathname.startsWith('/onboarding/moderator') ||
        pathname.startsWith('/onboarding/compound-select')
      ) {
        return
      }
      router.replace('/onboarding/choose-role')
      return
    }

    if (user.role === 'SERVICE_PROVIDER') {
      if (
        pathname.startsWith('/onboarding/provider') ||
        pathname.startsWith('/provider/status') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/services') ||
        pathname.startsWith('/profile')
      ) {
        return
      }
      router.replace('/provider/status')
      return
    }

    if (user.role === 'COMPOUND_MOD') {
      if (
        pathname.startsWith('/onboarding/moderator') ||
        pathname.startsWith('/moderator/status') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/feed')
      ) {
        return
      }
      router.replace('/moderator/status')
      return
    }

    if (isResidentRole(user.role)) {
      if (user.status === 'APPROVED' && isVerifiedForCurrentCompound(user)) {
        return
      }

      const allowedWhilePending = [
        '/verification',
        '/verification/pending',
        '/onboarding/compound-select',
        '/onboarding/choose-role',
        '/settings',
        '/profile',
        '/auth',
      ]
      if (allowedWhilePending.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
        if (pathname === '/verification') {
          if (!canAccessVerificationUpload(user)) {
            router.replace('/verification/pending')
          }
          return
        }
        return
      }

      router.replace(getResidentWebRoute(user))
      return
    }
  }, [user, isLoading, pathname, router])

  // Defer loading UI until after hydration so SSR markup matches the first client render.
  if (mounted && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
