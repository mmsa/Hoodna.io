'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: string[]
  requireApproved?: boolean
}

export function RoleGuard({ children, allowedRoles, requireApproved = false }: RoleGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    // Public routes that don't require authentication
    const publicRoutes = [
      '/auth/login',
      '/auth/signup',
      '/auth/phone-login',
      '/auth/otp-verify',
      '/',
      '/features',
    ]

    if (publicRoutes.some(route => pathname.startsWith(route))) {
      return
    }

    // If not authenticated, redirect to login
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Check if user has selected a role
    if (!user.role) {
      // Allow access to role selection and onboarding pages
      if (
        pathname.startsWith('/onboarding/choose-role') ||
        pathname.startsWith('/onboarding/provider') ||
        pathname.startsWith('/onboarding/moderator') ||
        pathname.startsWith('/onboarding/compound-select')
      ) {
        return
      }
      router.push('/onboarding/choose-role')
      return
    }

    // Check role-based access
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.push('/feed')
      return
    }

    // Check approval status for specific roles
    if (user.role === 'SERVICE_PROVIDER') {
      // Allow access to onboarding and status pages
      if (
        pathname.startsWith('/onboarding/provider') ||
        pathname.startsWith('/provider/status')
      ) {
        return
      }
      // Redirect to status page if not approved
      // Note: We'd need to fetch provider profile to check status
      // For now, let the status page handle this
    }

    if (user.role === 'COMPOUND_MOD') {
      // Allow access to onboarding and status pages
      if (
        pathname.startsWith('/onboarding/moderator') ||
        pathname.startsWith('/moderator/status')
      ) {
        return
      }
      // Redirect to status page if not approved
      // Note: We'd need to fetch moderator profile to check status
      // For now, let the status page handle this
    }

    if (user.role === 'RESIDENT' || user.role === 'USER') {
      // Resident-specific checks
      if (requireApproved && user.status !== 'APPROVED') {
        if (!pathname.startsWith('/verification') && !pathname.startsWith('/onboarding/compound-select')) {
          router.push('/verification')
          return
        }
      }
    }
  }, [user, isLoading, pathname, router, allowedRoles, requireApproved])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return <>{children}</>
}

