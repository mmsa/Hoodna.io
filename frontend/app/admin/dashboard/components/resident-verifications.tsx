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
import { formatDocumentType } from '@/lib/format-enums'
import { SignedFileLink, SignedDocumentPreview } from '@/components/signed-file'

interface VerificationDocument {
  id: number
  user_id: number
  type: string
  file_url: string
  status: string
  reviewer_id?: number
  notes?: string
  created_at: string
  llm_verified?: number
  llm_confidence?: number
  llm_recommendation?: string
  llm_reasoning?: string
  llm_issues?: string[]
  user?: {
    id: number
    name: string
    email: string
    phone?: string
    compound_id?: number
    compound_name?: string
  }
}

export default function ResidentVerifications() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<VerificationDocument | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionNotes, setRejectionNotes] = useState('')
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState<string>('APPROVED')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [requestMoreDialogOpen, setRequestMoreDialogOpen] = useState(false)
  const [requestMoreNotes, setRequestMoreNotes] = useState('')
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ type: string; file_url: string } | null>(null)
  const [aiResultDialogOpen, setAiResultDialogOpen] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const { data: documents, isLoading, refetch } = useQuery<VerificationDocument[]>({
    queryKey: ['admin-resident-verifications', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        status_filter: statusFilter,
        limit: '50',
      })
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      const response = await api.get(`/api/admin/verifications?${params.toString()}`)
      return response.data.items || response.data || []
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/approve`, { notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resident-verifications'] })
      toast.success('Document approved')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve document')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/reject`, { notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resident-verifications'] })
      setRejectDialogOpen(false)
      setRejectionNotes('')
      setSelectedDoc(null)
      toast.success('Document rejected')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject document')
    },
  })

  const requestMoreMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/request-more-details`, { notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resident-verifications'] })
      setRequestMoreDialogOpen(false)
      setRequestMoreNotes('')
      setSelectedDoc(null)
      toast.success('Requested more details from user')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update document')
    },
  })

  const statusOverrideMutation = useMutation({
    mutationFn: async ({ docId, status, notes }: { docId: number; status: string; notes?: string }) => {
      const response = await api.patch(`/api/admin/verifications/${docId}/status`, { status, notes })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resident-verifications'] })
      setOverrideDialogOpen(false)
      setOverrideNotes('')
      setSelectedDoc(null)
      toast.success('Document status updated')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update status')
    },
  })

  const verifyWithAiMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(`/api/admin/verifications/${docId}/verify-with-llm`)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-resident-verifications'] })
      setAiResult(data.llm_result)
      setAiResultDialogOpen(true)
      toast.success('AI verification completed')
      refetch()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'AI verification failed')
    },
  })

  const handleReject = (doc: VerificationDocument) => {
    setSelectedDoc(doc)
    setRejectionNotes('')
    setRejectDialogOpen(true)
  }

  const handleRequestMore = (doc: VerificationDocument) => {
    setSelectedDoc(doc)
    setRequestMoreNotes('')
    setRequestMoreDialogOpen(true)
  }

  const handleApprove = (doc: VerificationDocument) => {
    const notes =
      doc.status !== 'PENDING' && doc.status !== 'APPROVED'
        ? `[Admin override from ${doc.status}]`
        : undefined
    approveMutation.mutate({ docId: doc.id, notes })
  }

  const openOverrideDialog = (doc: VerificationDocument) => {
    setSelectedDoc(doc)
    setOverrideStatus(doc.status === 'APPROVED' ? 'PENDING' : 'APPROVED')
    setOverrideNotes('')
    setOverrideDialogOpen(true)
  }

  const confirmOverride = () => {
    if (!selectedDoc) return
    const notes =
      overrideNotes.trim() ||
      (selectedDoc.status !== overrideStatus
        ? `[Admin override: ${selectedDoc.status} → ${overrideStatus}]`
        : undefined)
    statusOverrideMutation.mutate({
      docId: selectedDoc.id,
      status: overrideStatus,
      notes,
    })
  }

  const handlePreview = (doc: VerificationDocument) => {
    setPreviewDoc({ type: doc.type, file_url: doc.file_url })
    setPreviewDialogOpen(true)
  }

  const handleVerifyWithAi = (doc: VerificationDocument) => {
    verifyWithAiMutation.mutate(doc.id)
  }

  const confirmReject = () => {
    if (!selectedDoc) return
    const notes =
      rejectionNotes.trim() ||
      (selectedDoc.status !== 'REJECTED'
        ? `[Admin override from ${selectedDoc.status}]`
        : undefined)
    rejectMutation.mutate({ docId: selectedDoc.id, notes })
  }

  const confirmRequestMore = () => {
    if (!selectedDoc) return
    requestMoreMutation.mutate({
      docId: selectedDoc.id,
      notes: requestMoreNotes.trim() || undefined,
    })
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
                  placeholder="Search by name, email, or compound..."
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
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="REQUEST_MORE_DETAILS">Request More</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading verifications...</p>
          </CardContent>
        </Card>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{formatDocumentType(doc.type)}</CardTitle>
                    <CardDescription>
                      {doc.user?.name || `User ID: ${doc.user_id}`} • {doc.user?.email}
                      {doc.user?.compound_name && ` • ${doc.user.compound_name}`}
                    </CardDescription>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    doc.status === 'REQUEST_MORE_DETAILS' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(doc)}
                    className="inline-flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Quick Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyWithAi(doc)}
                    disabled={verifyWithAiMutation.isPending}
                    className="inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {verifyWithAiMutation.isPending ? 'Verifying...' : 'Verify by AI'}
                  </Button>
                  <SignedFileLink
                    fileUrl={doc.file_url}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
                  >
                    View Document
                    <ExternalLink className="w-3 h-3" />
                  </SignedFileLink>
                  <span className="text-sm text-gray-500">
                    Submitted: {new Date(doc.created_at).toLocaleString()}
                  </span>
                </div>

                {/* AI Verification Results */}
                {doc.llm_verified !== undefined && (
                  <div className={`p-3 rounded border ${
                    doc.llm_verified === 1 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <strong className={`text-sm ${
                        doc.llm_verified === 1 ? 'text-green-900' : 'text-yellow-900'
                      }`}>
                        AI Verification:
                      </strong>
                      {doc.llm_confidence !== undefined && (
                        <span className={`text-xs font-medium ${
                          doc.llm_verified === 1 ? 'text-green-700' : 'text-yellow-700'
                        }`}>
                          Confidence: {Math.round(doc.llm_confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {doc.llm_recommendation && (
                      <p className={`text-xs mb-1 ${
                        doc.llm_verified === 1 ? 'text-green-800' : 'text-yellow-800'
                      }`}>
                        Recommendation: {doc.llm_recommendation}
                      </p>
                    )}
                    {doc.llm_reasoning && (
                      <p className={`text-xs ${
                        doc.llm_verified === 1 ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {doc.llm_reasoning}
                      </p>
                    )}
                  </div>
                )}

                {doc.notes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <strong className="text-yellow-900">Notes:</strong>
                    <p className="text-yellow-800 mt-1">{doc.notes}</p>
                  </div>
                )}

                {doc.status !== 'PENDING' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                    AI or system set this to <strong>{doc.status.replace(/_/g, ' ')}</strong>.
                    Use the actions below to override.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <span className="w-full text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Admin actions
                  </span>
                  {doc.status !== 'APPROVED' && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(doc)}
                      disabled={approveMutation.isPending}
                      className="text-green-700 border-green-200 hover:bg-green-50"
                      variant="outline"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {doc.status === 'REJECTED' ? 'Override & Approve' : 'Approve'}
                    </Button>
                  )}
                  {doc.status !== 'REJECTED' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(doc)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  )}
                  {doc.status !== 'REQUEST_MORE_DETAILS' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestMore(doc)}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Request more details
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openOverrideDialog(doc)}
                  >
                    Change status…
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No verifications found</p>
          </CardContent>
        </Card>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Document Preview: {previewDoc ? formatDocumentType(previewDoc.type) : ''}</span>
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
                title={formatDocumentType(previewDoc.type)}
              />
            ) : null}
          </div>
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDoc && selectedDoc.status !== 'PENDING' ? 'Override & Reject' : 'Reject Document'}
            </DialogTitle>
            <DialogDescription>
              {selectedDoc && selectedDoc.status !== 'PENDING'
                ? `Override current status (${selectedDoc.status}) and reject this document.`
                : 'Please provide a reason for rejection. This will be shown to the user.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionNotes">Rejection Reason (Optional)</Label>
              <Textarea
                id="rejectionNotes"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="e.g., Document is unclear, missing information..."
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
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request More Details Dialog */}
      <Dialog open={requestMoreDialogOpen} onOpenChange={setRequestMoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more details</DialogTitle>
            <DialogDescription>
              Ask the user to upload a clearer or different document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="requestMoreNotes">Message to user (optional)</Label>
              <Textarea
                id="requestMoreNotes"
                value={requestMoreNotes}
                onChange={(e) => setRequestMoreNotes(e.target.value)}
                placeholder="e.g., Please upload a clearer photo of your contract…"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestMoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRequestMore} disabled={requestMoreMutation.isPending}>
              {requestMoreMutation.isPending ? 'Saving…' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override document status</DialogTitle>
            <DialogDescription>
              {selectedDoc
                ? `Change status for ${formatDocumentType(selectedDoc.type)} (currently ${selectedDoc.status}).`
                : 'Set a new status for this document.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="overrideStatus">New status</Label>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger id="overrideStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="REQUEST_MORE_DETAILS">Request more details</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="overrideNotes">Admin note (optional)</Label>
              <Textarea
                id="overrideNotes"
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="Reason for override…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmOverride}
              disabled={statusOverrideMutation.isPending || selectedDoc?.status === overrideStatus}
            >
              {statusOverrideMutation.isPending ? 'Saving…' : 'Update status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
