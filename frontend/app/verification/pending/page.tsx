'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, XCircle, Loader2, LogOut, Upload } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import Cookies from 'js-cookie'
import { getResidentWebRoute, isResidentRole } from '@/lib/resident-routing'

interface VerificationStatus {
  national_id: { status: string } | null
  contract: { status: string } | null
  user_status: string
}

function docLabel(status?: string) {
  if (!status) return 'Not submitted'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  if (status === 'REQUEST_MORE_DETAILS') return 'More details needed'
  return 'Under review'
}

export default function VerificationPendingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading, refreshUser } = useAuth()

  const { data: status, isLoading } = useQuery<VerificationStatus>({
    queryKey: ['verification-status'],
    queryFn: async () => {
      const response = await api.get('/api/verification/status')
      return response.data
    },
    enabled: !!user?.compound_id && isResidentRole(user?.role),
    refetchInterval: 8000,
  })

  useEffect(() => {
    if (userLoading || !user) return
    if (!isResidentRole(user.role)) {
      router.replace('/')
      return
    }
    if (!user.compound_id) {
      router.replace('/onboarding/compound-select')
      return
    }
    if (user.status === 'APPROVED') {
      router.replace('/feed')
      return
    }
    if (user.verification_status === 'UNVERIFIED' || !user.verification_status) {
      if (user.status !== 'REJECTED' && user.status !== 'BANNED') {
        router.replace('/verification')
      }
    }
  }, [user, userLoading, router])

  // When polling shows approval, refresh user and go to feed
  useEffect(() => {
    if (status?.user_status === 'APPROVED') {
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      refreshUser()
      router.replace('/feed')
    }
  }, [status?.user_status, queryClient, router, refreshUser])

  useEffect(() => {
    if (!user) return
    const route = getResidentWebRoute(user)
    if (route === '/feed') {
      router.replace(route)
    }
  }, [user, router])

  const handleLogout = () => {
    Cookies.remove('access_token')
    Cookies.remove('refresh_token')
    router.push('/auth/login')
  }

  if (userLoading || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const isRejected = user.status === 'REJECTED' || user.status === 'BANNED'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div
            className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${
              isRejected ? 'bg-red-100' : 'bg-amber-100'
            }`}
          >
            {isRejected ? (
              <XCircle className="h-10 w-10 text-red-600" />
            ) : (
              <Clock className="h-10 w-10 text-amber-600" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isRejected ? 'Verification rejected' : 'Verification under review'}
          </h1>
          <p className="text-slate-600">
            {isRejected
              ? 'Your documents were not approved. You can re-upload and submit again.'
              : "We've received your documents. You can't access the community until a moderator approves your account."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document status</CardTitle>
            <CardDescription>Updates automatically while we review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">National ID</span>
              <span className="font-medium">{docLabel(status?.national_id?.status)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Contract</span>
              <span className="font-medium">{docLabel(status?.contract?.status)}</span>
            </div>
          </CardContent>
        </Card>

        {(isRejected ||
          status?.national_id?.status === 'REJECTED' ||
          status?.contract?.status === 'REJECTED' ||
          status?.national_id?.status === 'REQUEST_MORE_DETAILS' ||
          status?.contract?.status === 'REQUEST_MORE_DETAILS') && (
          <Button className="w-full" onClick={() => router.push('/verification')}>
            <Upload className="mr-2 h-4 w-4" />
            Re-upload documents
          </Button>
        )}

        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  )
}
