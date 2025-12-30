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
import { formatModeratorStatus, formatDocumentType } from '@/lib/format-enums'
import { normalizeFileUrl } from '@/lib/file-url'
import { formatCompoundName } from '@/lib/format-compound'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ document_type: string; file_url: string } | null>(null)
  const [previewLoadError, setPreviewLoadError] = useState(false)
  const [selectedModerator, setSelectedModerator] = useState<ModeratorProfile | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [aiResultDialogOpen, setAiResultDialogOpen] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null)

  const { data: moderators, isLoading, refetch } = useQuery<ModeratorProfile[]>({
    queryKey: ['admin-moderators', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        status_filter: statusFilter,
      })
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      const response = await api.get(`/api/admin/moderators?${params.toString()}`)
      return response.data
    },
  })

  // Filter moderators by search query on client side if needed
  const filteredModerators = moderators?.filter((moderator) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      moderator.role_title?.toLowerCase().includes(query) ||
      moderator.compound_name?.toLowerCase().includes(query) ||
      moderator.user_name?.toLowerCase().includes(query) ||
      String(moderator.user_id).includes(query) ||
      String(moderator.compound_id).includes(query)
    )
  }) || []

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

  const handlePreview = (doc: { document_type: string; file_url: string }) => {
    setPreviewDoc(doc)
    setPreviewLoadError(false) // Reset error state when opening preview
    setPreviewDialogOpen(true)
  }

  const verifyWithAiMutation = useMutation({
    mutationFn: async ({ moderatorId, documentId }: { moderatorId: number; documentId: number }) => {
      const response = await api.post(`/api/admin/moderators/${moderatorId}/documents/${documentId}/verify-with-llm`)
      return response.data
    },
    onSuccess: (data) => {
      setAiResult(data.llm_result)
      setAiResultDialogOpen(true)
      setVerifyingDocId(null)
      toast.success('AI verification completed')
      refetch()
    },
    onError: (error: any) => {
      setVerifyingDocId(null)
      toast.error(error.response?.data?.detail || 'AI verification failed')
    },
  })

  const handleVerifyWithAi = (moderatorId: number, docId: number) => {
    setVerifyingDocId(docId)
    verifyWithAiMutation.mutate({ moderatorId, documentId: docId })
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
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by role title, compound, user ID..."
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
                </SelectContent>
              </Select>
            </div>
          </div>
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
      ) : filteredModerators && filteredModerators.length > 0 ? (
        <div className="space-y-4">
          {filteredModerators.map((moderator) => (
            <Card key={moderator.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{moderator.role_title}</CardTitle>
                    <CardDescription>
                      {moderator.user_name || `User ID: ${moderator.user_id}`} • {moderator.compound_name ? formatCompoundName(moderator.compound_name) : `Compound ID: ${moderator.compound_id}`}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    moderator.moderator_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    moderator.moderator_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    moderator.moderator_status === 'SUSPENDED' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {formatModeratorStatus(moderator.moderator_status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <strong>Compound:</strong> {moderator.compound_name ? formatCompoundName(moderator.compound_name) : `ID: ${moderator.compound_id}`}
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
                          onClick={() => handleVerifyWithAi(moderator.id, doc.id)}
                          disabled={verifyingDocId === doc.id || verifyWithAiMutation.isPending}
                          className="inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          {verifyingDocId === doc.id ? 'Verifying...' : 'Verify by AI'}
                        </Button>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
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
            <p className="text-gray-500">No moderators found</p>
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
            {previewDoc && <DocumentPreviewContent doc={previewDoc} />}
          </div>
        </DialogContent>
      </Dialog>

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

function DocumentPreviewContent({ doc }: { doc: { document_type: string; file_url: string } }) {
  const [loadError, setLoadError] = useState(false)
  const normalizedUrl = normalizeFileUrl(doc.file_url)
  
  if (loadError) {
    return (
      <div className="p-8 text-center border border-red-200 rounded-lg bg-red-50">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-800 font-medium mb-2">Failed to load document</p>
        <p className="text-red-600 text-sm mb-4">The file could not be found or accessed.</p>
        <p className="text-red-500 text-xs mb-4 font-mono break-all">{normalizedUrl}</p>
        <Button
          variant="outline"
          onClick={() => {
            window.open(normalizedUrl, '_blank')
          }}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Try opening in new tab
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {doc.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
        <img
          src={normalizedUrl}
          alt={doc.document_type}
          className="w-full h-auto rounded-lg border"
          onError={() => {
            console.error('Failed to load image:', normalizedUrl)
            setLoadError(true)
          }}
        />
      ) : (
        <iframe
          src={normalizedUrl}
          className="w-full h-[600px] rounded-lg border"
          title={doc.document_type}
          onError={() => {
            console.error('Failed to load document:', normalizedUrl)
            setLoadError(true)
          }}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            window.open(normalizedUrl, '_blank')
          }}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  )
}
