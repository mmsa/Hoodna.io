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
      console.log('[RoleGuard] SERVICE_PROVIDER detected:', {
        pathname,
        isOnboarding: pathname.startsWith('/onboarding/provider'),
        isStatus: pathname.startsWith('/provider/status'),
        isAuth: pathname.startsWith('/auth'),
        isServices: pathname.startsWith('/services')
      })
      
      // Allow access to onboarding, status, services, and auth pages
      if (
        pathname.startsWith('/onboarding/provider') ||
        pathname.startsWith('/provider/status') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/services')
      ) {
        console.log('[RoleGuard] ✅ Allowing access to:', pathname)
        return
      }
      // Redirect to status page - status page will check approval and redirect if approved
      console.log('[RoleGuard] 🔄 Redirecting SERVICE_PROVIDER to /provider/status from:', pathname)
      router.push('/provider/status')
      return
    }

    if (user.role === 'COMPOUND_MOD') {
      // Allow access to onboarding and status pages
      if (
        pathname.startsWith('/onboarding/moderator') ||
        pathname.startsWith('/moderator/status') ||
        pathname.startsWith('/auth')
      ) {
        return
      }
      // Redirect to status page - status page will check approval and redirect if approved
      router.push('/moderator/status')
      return
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

