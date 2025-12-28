'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { Upload, CheckCircle, XCircle, Clock } from 'lucide-react'

interface VerificationStatus {
  national_id: {
    id: number
    type: string
    file_url: string
    status: string
    created_at: string
  } | null
  contract: {
    id: number
    type: string
    file_url: string
    status: string
    created_at: string
  } | null
  user_status: string
  can_post: boolean
}

export default function VerificationPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState<'national_id' | 'contract' | null>(null)

  const { data: status, refetch } = useQuery<VerificationStatus>({
    queryKey: ['verification-status'],
    queryFn: async () => {
      const response = await api.get('/api/verification/status')
      return response.data
    },
  })

  const uploadDocument = async (type: 'national_id' | 'contract', file: File) => {
    setUploading(type)

    try {
      // Get presigned URL
      const documentType = type === 'national_id' ? 'NATIONAL_ID' : 'CONTRACT'
      const presignResponse = await api.post('/api/verification/presign', {
        file_name: file.name,
        file_type: file.type,
        document_type: documentType,
      })

      const { presigned_url, file_url } = presignResponse.data

      // Upload to S3
      await fetch(presigned_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      // Submit document
      await api.post('/api/verification/submit', {
        file_url,
        document_type: documentType,
      })

      await refetch()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  const getStatusIcon = (docStatus: string | undefined) => {
    if (!docStatus) return <Clock className="w-5 h-5 text-gray-400" />
    if (docStatus === 'APPROVED') return <CheckCircle className="w-5 h-5 text-green-500" />
    if (docStatus === 'REJECTED') return <XCircle className="w-5 h-5 text-red-500" />
    return <Clock className="w-5 h-5 text-yellow-500" />
  }

  const getStatusText = (docStatus: string | undefined) => {
    if (!docStatus) return 'Not uploaded'
    if (docStatus === 'APPROVED') return 'Approved'
    if (docStatus === 'REJECTED') return 'Rejected'
    return 'Pending review'
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Verification Documents</CardTitle>
            <CardDescription>
              Upload your National ID and residency/ownership contract to get verified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* National ID */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">National ID</h3>
                  <p className="text-sm text-gray-600">Upload a clear photo of your national ID</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status?.national_id?.status)}
                  <span className="text-sm">{getStatusText(status?.national_id?.status)}</span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadDocument('national_id', file)
                }}
                disabled={uploading === 'national_id'}
                className="hidden"
                id="national-id-upload"
              />
              <label htmlFor="national-id-upload">
                <Button
                  variant="outline"
                  disabled={uploading === 'national_id'}
                  className="w-full"
                  asChild
                >
                  <span>
                    {uploading === 'national_id' ? (
                      'Uploading...'
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {status?.national_id ? 'Replace Document' : 'Upload Document'}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {/* Contract */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Residency/Ownership Contract</h3>
                  <p className="text-sm text-gray-600">Upload your contract or proof of residency</p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status?.contract?.status)}
                  <span className="text-sm">{getStatusText(status?.contract?.status)}</span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadDocument('contract', file)
                }}
                disabled={uploading === 'contract'}
                className="hidden"
                id="contract-upload"
              />
              <label htmlFor="contract-upload">
                <Button
                  variant="outline"
                  disabled={uploading === 'contract'}
                  className="w-full"
                  asChild
                >
                  <span>
                    {uploading === 'contract' ? (
                      'Uploading...'
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {status?.contract ? 'Replace Document' : 'Upload Document'}
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            {status?.can_post && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-semibold">✓ Verification Complete!</p>
                <p className="text-green-700 text-sm mt-1">
                  You can now post, comment, and create listings.
                </p>
                <Button
                  onClick={() => router.push('/feed')}
                  className="mt-4"
                >
                  Go to Feed
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

