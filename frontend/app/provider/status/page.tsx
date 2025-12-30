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

  const { data: profile, isLoading } = useQuery({
    queryKey: ['provider-profile'],
    queryFn: async () => {
      const response = await api.get('/api/providers/me')
      return response.data
    },
    enabled: !!user,
    retry: false,
  })

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (user.role !== 'SERVICE_PROVIDER') {
      router.push('/onboarding/choose-role')
      return
    }

    if (!profile && !isLoading) {
      // No profile exists, redirect to onboarding
      router.push('/onboarding/provider')
    }
  }, [user, profile, isLoading, router])

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

            {/* Rejection/Suspension Reason */}
            {profile.rejection_reason && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-lg text-red-900">Rejection Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-800">{profile.rejection_reason}</p>
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
              {status === 'DRAFT' && (
                <Button asChild className="flex-1">
                  <Link href="/onboarding/provider">Complete Profile</Link>
                </Button>
              )}
              {status === 'REJECTED' && (
                <Button asChild className="flex-1" variant="outline">
                  <Link href="/onboarding/provider">Update Profile</Link>
                </Button>
              )}
              {status === 'APPROVED' && (
                <Button asChild className="flex-1">
                  <Link href="/services">View Services</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

