'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink, Search, Eye, X, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { formatProviderType, formatVerificationMethod, formatProviderStatus, formatDocumentType } from '@/lib/format-enums'
import { SignedFileLink, SignedDocumentPreview } from '@/components/signed-file'

interface ProviderProfile {
  id: number
  user_id: number
  user_name?: string
  provider_type: string
  verification_method: string
  business_name: string
  category_id: number
  category?: {
    id: number
    name: string
    icon?: string
  }
  phone: string
  service_area_compound_ids: number[]
  occupation_text?: string
  provider_status: string
  submitted_at?: string
  reviewed_at?: string
  reviewed_by?: number
  rejection_reason?: string
  suspension_reason?: string
  documents: Array<{
    id: number
    document_type: string
    file_url: string
  }>
}

export default function ProviderReviews() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED')
  const [searchQuery, setSearchQuery] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ document_type: string; file_url: string } | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [aiResultDialogOpen, setAiResultDialogOpen] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null)
  const [autoApproved, setAutoApproved] = useState(false)
  const [requestMoreDialogOpen, setRequestMoreDialogOpen] = useState(false)
  const [requestMoreReason, setRequestMoreReason] = useState('')

  const { data: providers, isLoading, refetch } = useQuery<ProviderProfile[]>({
    queryKey: ['admin-providers', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        status_filter: statusFilter,
      })
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      const response = await api.get(`/api/admin/providers?${params.toString()}`)
      return response.data
    },
  })

  // Filter providers by search query on client side if needed
  const filteredProviders = providers?.filter((provider) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      provider.business_name?.toLowerCase().includes(query) ||
      provider.phone?.toLowerCase().includes(query) ||
      provider.user_name?.toLowerCase().includes(query) ||
      provider.occupation_text?.toLowerCase().includes(query) ||
      String(provider.user_id).includes(query)
    )
  }) || []

  const approveMutation = useMutation({
    mutationFn: async (providerId: number) => {
      const response = await api.post(`/api/admin/providers/${providerId}/approve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] })
      toast.success('Provider approved')
      refetch()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ providerId, reason }: { providerId: number; reason: string }) => {
      const response = await api.post(`/api/admin/providers/${providerId}/reject`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] })
      setRejectDialogOpen(false)
      setRejectionReason('')
      setSelectedProvider(null)
      toast.success('Provider rejected')
      refetch()
    },
  })

  const suspendMutation = useMutation({
    mutationFn: async ({ providerId, reason }: { providerId: number; reason: string }) => {
      const response = await api.post(`/api/admin/providers/${providerId}/suspend`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] })
      setSuspendDialogOpen(false)
      setSuspensionReason('')
      setSelectedProvider(null)
      toast.success('Provider suspended')
      refetch()
    },
  })

  const handleReject = (provider: ProviderProfile) => {
    setSelectedProvider(provider)
    setRejectDialogOpen(true)
  }

  const handleSuspend = (provider: ProviderProfile) => {
    setSelectedProvider(provider)
    setSuspendDialogOpen(true)
  }

  const handlePreview = (doc: { document_type: string; file_url: string }) => {
    setPreviewDoc(doc)
    setPreviewDialogOpen(true)
  }

  const verifyWithAiMutation = useMutation({
    mutationFn: async ({ providerId, documentId }: { providerId: number; documentId: number }) => {
      const response = await api.post(`/api/admin/providers/${providerId}/documents/${documentId}/verify-with-llm`)
      return response.data
    },
    onSuccess: (data) => {
      setAiResult(data.llm_result)
      setAutoApproved(data.auto_approved || false)
      setAiResultDialogOpen(true)
      setVerifyingDocId(null)
      if (data.auto_approved) {
        toast.success('Provider auto-approved based on high confidence AI verification')
      } else {
        toast.success('AI verification completed')
      }
      refetch()
    },
    onError: (error: any) => {
      setVerifyingDocId(null)
      toast.error(error.response?.data?.detail || 'AI verification failed')
    },
  })

  const requestMoreMutation = useMutation({
    mutationFn: async ({ providerId, reason }: { providerId: number; reason: string }) => {
      const response = await api.post(`/api/admin/providers/${providerId}/request-more-details`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] })
      toast.success('Request for more details sent to provider')
      setRequestMoreDialogOpen(false)
      setRequestMoreReason('')
      setSelectedProvider(null)
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to request more details')
    },
  })

  const handleVerifyWithAi = (providerId: number, docId: number) => {
    setVerifyingDocId(docId)
    verifyWithAiMutation.mutate({ providerId, documentId: docId })
  }

  const confirmReject = () => {
    if (!selectedProvider || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectMutation.mutate({ providerId: selectedProvider.id, reason: rejectionReason })
  }

  const confirmSuspend = () => {
    if (!selectedProvider || !suspensionReason.trim()) {
      toast.error('Please provide a suspension reason')
      return
    }
    suspendMutation.mutate({ providerId: selectedProvider.id, reason: suspensionReason })
  }

  const confirmRequestMore = () => {
    if (!selectedProvider || !requestMoreReason.trim()) {
      toast.error('Please provide a reason for requesting more details')
      return
    }
    requestMoreMutation.mutate({ providerId: selectedProvider.id, reason: requestMoreReason })
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by business name, phone, user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="IN_REVIEW">In Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="REQUEST_MORE_DETAILS">Request More Details</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Providers List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading providers...</p>
          </CardContent>
        </Card>
      ) : filteredProviders && filteredProviders.length > 0 ? (
        <div className="space-y-4">
          {filteredProviders.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{provider.business_name}</CardTitle>
                    <CardDescription>
                      {provider.user_name || `User ID: ${provider.user_id}`} • {provider.phone}
                      {provider.category && ` • ${provider.category.icon || ''} ${provider.category.name}`}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    provider.provider_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    provider.provider_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    provider.provider_status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                    'bg-secondary text-primary'
                  }`}>
                    {formatProviderStatus(provider.provider_status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <strong>Provider Type:</strong> {formatProviderType(provider.provider_type)}
                  </div>
                  <div>
                    <strong>Verification Method:</strong> {formatVerificationMethod(provider.verification_method)}
                  </div>
                  {provider.category && (
                    <div>
                      <strong>Service Category:</strong> {provider.category.icon || ''} {provider.category.name}
                    </div>
                  )}
                  {provider.occupation_text && (
                    <div className="md:col-span-2">
                      <strong>Occupation:</strong> {provider.occupation_text}
                    </div>
                  )}
                  {provider.submitted_at && (
                    <div>
                      <strong>Submitted:</strong> {new Date(provider.submitted_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <strong>Documents:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {provider.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(doc)}
                          className="inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          {formatDocumentType(doc.document_type)}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyWithAi(provider.id, doc.id)}
                          disabled={verifyingDocId === doc.id || verifyWithAiMutation.isPending}
                          className="inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          {verifyingDocId === doc.id ? 'Verifying...' : 'Verify by AI'}
                        </Button>
                        <SignedFileLink
                          fileUrl={doc.file_url}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </SignedFileLink>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rejection/Suspension Reason */}
                {provider.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <strong className="text-red-900">Rejection Reason:</strong>
                    <p className="text-red-800 mt-1">{provider.rejection_reason}</p>
                  </div>
                )}
                {provider.suspension_reason && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <strong className="text-orange-900">Suspension Reason:</strong>
                    <p className="text-orange-800 mt-1">{provider.suspension_reason}</p>
                  </div>
                )}

                {/* Actions */}
                {provider.provider_status === 'SUBMITTED' || provider.provider_status === 'IN_REVIEW' ? (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(provider.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProvider(provider)
                        setRequestMoreDialogOpen(true)
                      }}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Request More Details
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(provider)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                ) : provider.provider_status === 'APPROVED' ? (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleSuspend(provider)}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Suspend
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No providers found</p>
          </CardContent>
        </Card>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Document Preview: {previewDoc ? formatDocumentType(previewDoc.document_type) : ''}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewDialogOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewDoc ? (
              <SignedDocumentPreview
                fileUrl={previewDoc.file_url}
                title={formatDocumentType(previewDoc.document_type)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Provider</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shown to the provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Missing required documents, Invalid business information..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Verification Result Dialog */}
      <Dialog open={aiResultDialogOpen} onOpenChange={setAiResultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Verification Results</DialogTitle>
            <DialogDescription>
              Review the AI analysis of this document
            </DialogDescription>
          </DialogHeader>
          {aiResult && (
            <div className="space-y-4">
              {autoApproved && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Provider Auto-Approved</p>
                      <p className="text-sm text-green-700">High confidence AI verification ({Math.round(aiResult.confidence * 100)}%) automatically approved this provider.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-medium">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  aiResult.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {aiResult.verified ? 'Verified' : 'Needs Review'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Confidence:</span>
                <span className="text-sm">{Math.round(aiResult.confidence * 100)}%</span>
              </div>
              {aiResult.recommendation && (
                <div>
                  <span className="font-medium">Recommendation:</span>
                  <p className="text-sm text-gray-600 mt-1">{aiResult.recommendation}</p>
                </div>
              )}
              {aiResult.reasoning && (
                <div>
                  <span className="font-medium">Reasoning:</span>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{aiResult.reasoning}</p>
                </div>
              )}
              {aiResult.issues && aiResult.issues.length > 0 && (
                <div>
                  <span className="font-medium text-red-600">Issues Found:</span>
                  <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                    {aiResult.issues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setAiResultDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Provider</DialogTitle>
            <DialogDescription>
              Please provide a reason for suspension. This will be shown to the provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="suspensionReason">Suspension Reason *</Label>
              <Textarea
                id="suspensionReason"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g., Violation of terms of service..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmSuspend}
              disabled={!suspensionReason.trim() || suspendMutation.isPending}
            >
              {suspendMutation.isPending ? 'Suspending...' : 'Suspend Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request More Details Dialog */}
      <Dialog open={requestMoreDialogOpen} onOpenChange={setRequestMoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request More Details</DialogTitle>
            <DialogDescription>
              Request additional information from the provider. They will be notified and can respond with more details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="requestMoreReason">Reason for Request *</Label>
              <Textarea
                id="requestMoreReason"
                value={requestMoreReason}
                onChange={(e) => setRequestMoreReason(e.target.value)}
                placeholder="e.g., Please provide clearer photos of your commercial register, or additional documentation..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRequestMoreDialogOpen(false)
              setRequestMoreReason('')
              setSelectedProvider(null)
            }}>
              Cancel
            </Button>
            <Button
              onClick={confirmRequestMore}
              disabled={!requestMoreReason.trim() || requestMoreMutation.isPending}
            >
              {requestMoreMutation.isPending ? 'Sending...' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

