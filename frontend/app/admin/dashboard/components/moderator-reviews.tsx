'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'

interface ModeratorProfile {
  id: number
  user_id: number
  user_name?: string
  compound_id: number
  compound_name?: string
  role_title: string
  moderator_status: string
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

export default function ModeratorReviews() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [selectedModerator, setSelectedModerator] = useState<ModeratorProfile | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')

  const { data: moderators, isLoading, refetch } = useQuery<ModeratorProfile[]>({
    queryKey: ['admin-moderators', statusFilter],
    queryFn: async () => {
      const response = await api.get(`/api/admin/moderators?status_filter=${statusFilter}`)
      return response.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (moderatorId: number) => {
      const response = await api.post(`/api/admin/moderators/${moderatorId}/approve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderators'] })
      toast.success('Moderator approved')
      refetch()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ moderatorId, reason }: { moderatorId: number; reason: string }) => {
      const response = await api.post(`/api/admin/moderators/${moderatorId}/reject`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderators'] })
      setRejectDialogOpen(false)
      setRejectionReason('')
      setSelectedModerator(null)
      toast.success('Moderator rejected')
      refetch()
    },
  })

  const suspendMutation = useMutation({
    mutationFn: async ({ moderatorId, reason }: { moderatorId: number; reason: string }) => {
      const response = await api.post(`/api/admin/moderators/${moderatorId}/suspend`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderators'] })
      setSuspendDialogOpen(false)
      setSuspensionReason('')
      setSelectedModerator(null)
      toast.success('Moderator suspended')
      refetch()
    },
  })

  const handleReject = (moderator: ModeratorProfile) => {
    setSelectedModerator(moderator)
    setRejectDialogOpen(true)
  }

  const handleSuspend = (moderator: ModeratorProfile) => {
    setSelectedModerator(moderator)
    setSuspendDialogOpen(true)
  }

  const confirmReject = () => {
    if (!selectedModerator || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectMutation.mutate({ moderatorId: selectedModerator.id, reason: rejectionReason })
  }

  const confirmSuspend = () => {
    if (!selectedModerator || !suspensionReason.trim()) {
      toast.error('Please provide a suspension reason')
      return
    }
    suspendMutation.mutate({ moderatorId: selectedModerator.id, reason: suspensionReason })
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

      {/* Moderators List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading moderators...</p>
          </CardContent>
        </Card>
      ) : moderators && moderators.length > 0 ? (
        <div className="space-y-4">
          {moderators.map((moderator) => (
            <Card key={moderator.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{moderator.role_title}</CardTitle>
                    <CardDescription>
                      User ID: {moderator.user_id} | Compound: {moderator.compound_name || moderator.compound_id}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    moderator.moderator_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    moderator.moderator_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    moderator.moderator_status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {moderator.moderator_status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <strong>Compound:</strong> {moderator.compound_name || `ID: ${moderator.compound_id}`}
                  </div>
                  <div>
                    <strong>Role Title:</strong> {moderator.role_title}
                  </div>
                  {moderator.submitted_at && (
                    <div>
                      <strong>Submitted:</strong> {new Date(moderator.submitted_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <strong>Documents:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {moderator.documents.map((doc) => (
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
                {moderator.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <strong className="text-red-900">Rejection Reason:</strong>
                    <p className="text-red-800 mt-1">{moderator.rejection_reason}</p>
                  </div>
                )}
                {moderator.suspension_reason && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <strong className="text-orange-900">Suspension Reason:</strong>
                    <p className="text-orange-800 mt-1">{moderator.suspension_reason}</p>
                  </div>
                )}

                {/* Actions */}
                {moderator.moderator_status === 'SUBMITTED' || moderator.moderator_status === 'IN_REVIEW' ? (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(moderator.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(moderator)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                ) : moderator.moderator_status === 'APPROVED' ? (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleSuspend(moderator)}
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
            <p className="text-gray-500">No moderators found with status: {statusFilter}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Moderator</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shown to the moderator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Missing authorization letter, Invalid documents..."
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
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Moderator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Moderator</DialogTitle>
            <DialogDescription>
              Please provide a reason for suspension. This will be shown to the moderator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="suspensionReason">Suspension Reason *</Label>
              <Textarea
                id="suspensionReason"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g., Violation of moderation guidelines..."
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
              {suspendMutation.isPending ? 'Suspending...' : 'Suspend Moderator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

