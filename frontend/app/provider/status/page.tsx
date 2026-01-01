'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

const STATUS_CONFIG = {
  DRAFT: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    title: 'Draft',
    description: 'Complete your profile to submit for review',
  },
  SUBMITTED: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    title: 'Submitted',
    description: 'Your profile is pending review',
  },
  IN_REVIEW: {
    icon: Loader2,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    title: 'In Review',
    description: 'Your profile is being reviewed by our team',
  },
  APPROVED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    title: 'Approved',
    description: 'Your profile has been approved! You can now list services',
  },
  REJECTED: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    title: 'Rejected',
    description: 'Your profile was rejected. Please review the reason below',
  },
  SUSPENDED: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    title: 'Suspended',
    description: 'Your profile has been suspended',
  },
}

export default function ProviderStatusPage() {
  const router = useRouter()
  const { user } = useAuth()

  const { data: profile, isLoading, error: profileError } = useQuery({
    queryKey: ['provider-profile'],
    queryFn: async () => {
      console.log('[ProviderStatus] Fetching provider profile from API...', {
        userRole: user?.role,
        userId: user?.id,
        hasUser: !!user
      })
      try {
        const response = await api.get('/api/providers/me')
        console.log('[ProviderStatus] API response received:', {
          status: response.status,
          data: response.data,
          provider_status: response.data?.provider_status,
          statusType: typeof response.data?.provider_status,
          fullData: JSON.stringify(response.data, null, 2)
        })
        return response.data
      } catch (err: any) {
        console.error('[ProviderStatus] API call failed:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          message: err.message,
          fullError: err
        })
        throw err
      }
    },
    enabled: !!user && user.role === 'SERVICE_PROVIDER',
    retry: false,
  })

  useEffect(() => {
    if (!profile && !profileError) return

    if (profile) {
      console.log('[ProviderStatus] Query success:', {
        provider_status: profile?.provider_status,
        normalizedStatus: profile?.provider_status?.toString().trim().toUpperCase(),
        hasData: !!profile
      })
    }

    if (profileError) {
      console.error('[ProviderStatus] Query error:', {
        message: profileError.message,
        status: (profileError as any).response?.status,
        data: (profileError as any).response?.data,
        is404: (profileError as any).response?.status === 404,
        is403: (profileError as any).response?.status === 403
      })
    }
  }, [profile, profileError])

  useEffect(() => {
    console.log('[ProviderStatus] useEffect triggered:', {
      hasUser: !!user,
      userRole: user?.role,
      hasProfile: !!profile,
      profileStatus: profile?.provider_status,
      isLoading,
      profileError: profileError ? {
        message: profileError.message,
        status: (profileError as any).response?.status
      } : null,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
    })

    if (!user) {
      console.log('[ProviderStatus] No user - redirecting to login')
      router.push('/auth/login')
      return
    }

    if (user.role !== 'SERVICE_PROVIDER') {
      console.log('[ProviderStatus] User role is not SERVICE_PROVIDER:', user.role, '- redirecting to choose-role')
      router.push('/onboarding/choose-role')
      return
    }

    if (!profile && !isLoading) {
      console.log('[ProviderStatus] No profile and not loading - redirecting to onboarding')
      // No profile exists, redirect to onboarding
      router.push('/onboarding/provider')
      return
    }

    // Redirect approved providers to services page
    if (profile) {
      const status = profile.provider_status?.toString().trim().toUpperCase();
      console.log('[ProviderStatus] Profile check:', {
        provider_status: profile.provider_status,
        normalizedStatus: status,
        statusType: typeof profile.provider_status,
        isApproved: status === 'APPROVED',
        exactMatch: status === 'APPROVED' ? 'YES' : 'NO',
        fullProfile: JSON.stringify(profile, null, 2)
      })
      
      if (status === 'APPROVED') {
        console.log('[ProviderStatus] ✅ Profile is APPROVED - redirecting to /services')
        router.push('/services')
        return
      } else {
        console.log('[ProviderStatus] ⚠️ Profile status is:', status, '- staying on status page')
      }
    }

    // Prevent bypassing status page if not approved
    if (profile && profile.provider_status !== 'APPROVED' && profile.provider_status !== 'DRAFT') {
      console.log('[ProviderStatus] 🔒 User must stay on status page - status:', profile.provider_status)
      // User must stay on status page until approved
      // This prevents accessing other pages
    }
  }, [user, profile, isLoading, profileError, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading status...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const status = profile.provider_status as keyof typeof STATUS_CONFIG
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT
  const Icon = config.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Service Provider Status</CardTitle>
            <CardDescription>Your verification status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-center py-8">
              <div className={`p-6 rounded-full ${config.bgColor}`}>
                <Icon className={`w-16 h-16 ${config.color} ${status === 'IN_REVIEW' ? 'animate-spin' : ''}`} />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{config.title}</h2>
              <p className="text-gray-600">{config.description}</p>
            </div>

            {/* Profile Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <strong>Business Name:</strong> {profile.business_name || 'Not set'}
                </div>
                <div>
                  <strong>Phone:</strong> {profile.phone || 'Not set'}
                </div>
                <div>
                  <strong>Provider Type:</strong> {profile.provider_type || 'Not set'}
                </div>
                <div>
                  <strong>Verification Method:</strong> {profile.verification_method || 'Not set'}
                </div>
                {profile.submitted_at && (
                  <div>
                    <strong>Submitted:</strong> {new Date(profile.submitted_at).toLocaleDateString()}
                  </div>
                )}
                {profile.reviewed_at && (
                  <div>
                    <strong>Reviewed:</strong> {new Date(profile.reviewed_at).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rejection/Suspension Reason or Request More Details */}
            {(profile.rejection_reason || (profile.provider_status === 'IN_REVIEW' && profile.rejection_reason?.includes('More details requested'))) && (
              <Card className={profile.rejection_reason?.includes('More details requested') ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
                <CardHeader>
                  <CardTitle className={`text-lg ${profile.rejection_reason?.includes('More details requested') ? 'text-yellow-900' : 'text-red-900'}`}>
                    {profile.rejection_reason?.includes('More details requested') ? 'More Details Requested' : 'Rejection Reason'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={profile.rejection_reason?.includes('More details requested') ? 'text-yellow-800' : 'text-red-800'}>
                    {profile.rejection_reason?.replace('More details requested: ', '') || profile.rejection_reason}
                  </p>
                  {profile.rejection_reason?.includes('More details requested') && (
                    <Button asChild className="mt-4">
                      <Link href="/onboarding/provider">Provide More Details</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {profile.suspension_reason && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg text-orange-900">Suspension Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-orange-800">{profile.suspension_reason}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              {(status === 'DRAFT' || status === 'REJECTED' || (status === 'IN_REVIEW' && profile.rejection_reason?.includes('More details requested'))) && (
                <Button asChild className="flex-1">
                  <Link href="/onboarding/provider">
                    {status === 'REJECTED' ? 'Update Profile' : profile.rejection_reason?.includes('More details requested') ? 'Provide More Details' : 'Complete Profile'}
                  </Link>
                </Button>
              )}
              {status === 'APPROVED' && (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/onboarding/provider">Edit Profile</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/services">Go to Services</Link>
                  </Button>
                </>
              )}
              {(status === 'SUBMITTED' || status === 'IN_REVIEW') && !profile.rejection_reason?.includes('More details requested') && (
                <p className="text-sm text-gray-600 text-center w-full mt-4">
                  Your profile is being reviewed. You'll be notified once it's approved.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
