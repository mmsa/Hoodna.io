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
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink, Search } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ProviderProfile {
  id: number
  user_id: number
  user_name?: string
  provider_type: string
  verification_method: string
  business_name: string
  category_id: number
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
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderProfile | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')

  const { data: providers, isLoading, refetch } = useQuery<ProviderProfile[]>({
    queryKey: ['admin-providers', statusFilter],
    queryFn: async () => {
      const response = await api.get(`/api/admin/providers?status_filter=${statusFilter}`)
      return response.data
    },
  })

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

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <Card>
        <CardContent className="p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
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
      ) : providers && providers.length > 0 ? (
        <div className="space-y-4">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{provider.business_name}</CardTitle>
                    <CardDescription>
                      User ID: {provider.user_id} | {provider.provider_type} | {provider.verification_method}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    provider.provider_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    provider.provider_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    provider.provider_status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {provider.provider_status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <strong>Phone:</strong> {provider.phone}
                  </div>
                  <div>
                    <strong>Category ID:</strong> {provider.category_id}
                  </div>
                  {provider.occupation_text && (
                    <div>
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
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                      >
                        {doc.document_type}
                        <ExternalLink className="w-3 h-3" />
                      </a>
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
            <p className="text-gray-500">No providers found with status: {statusFilter}</p>
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}

