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
import { getResidentWebRoute, isResidentRole, isVerifiedForCurrentCompound } from '@/lib/resident-routing'
import { UploadedDocumentCard } from '@/components/uploaded-document-card'

interface VerificationStatus {
  national_id: { status: string; file_url: string } | null
  contract: { status: string; file_url: string } | null
  user_status: string
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

  const hasDocs = !!(status?.national_id || status?.contract)

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
    // Wait for status query before bouncing unverified users back to upload
    if (isLoading) return
    if (!hasDocs && user.verification_status !== 'PENDING' && user.status !== 'REJECTED' && user.status !== 'BANNED') {
      router.replace('/verification')
    }
  }, [user, userLoading, router, isLoading, hasDocs])

  useEffect(() => {
    if (status?.user_status !== 'APPROVED') return
    queryClient.invalidateQueries({ queryKey: ['current-user'] })
    refreshUser()
  }, [status?.user_status, queryClient, refreshUser])

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

  const isRejected =
    user.status === 'REJECTED' ||
    user.status === 'BANNED' ||
    user.verification_status === 'REJECTED' ||
    status?.national_id?.status === 'REJECTED' ||
    status?.contract?.status === 'REJECTED' ||
    status?.national_id?.status === 'REQUEST_MORE_DETAILS' ||
    status?.contract?.status === 'REQUEST_MORE_DETAILS'

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
            <CardTitle>Your uploaded documents</CardTitle>
            <CardDescription>These remain after you refresh this page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadedDocumentCard
              title="National ID"
              status={status?.national_id?.status}
              fileUrl={status?.national_id?.file_url}
            />
            <UploadedDocumentCard
              title="Contract"
              status={status?.contract?.status}
              fileUrl={status?.contract?.file_url}
            />
          </CardContent>
        </Card>

        {(isRejected ||
          status?.national_id?.status === 'REJECTED' ||
          status?.contract?.status === 'REJECTED' ||
          status?.national_id?.status === 'REQUEST_MORE_DETAILS' ||
          status?.contract?.status === 'REQUEST_MORE_DETAILS' ||
          !hasDocs) && (
          <Button className="w-full" onClick={() => router.push('/verification')}>
            <Upload className="mr-2 h-4 w-4" />
            {hasDocs ? 'Re-upload documents' : 'Upload documents'}
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
