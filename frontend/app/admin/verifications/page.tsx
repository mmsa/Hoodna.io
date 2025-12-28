'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileText, 
  User, 
  Mail, 
  Phone,
  Sparkles,
  Loader2,
  Eye,
  MessageSquare
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface VerificationDocument {
  id: number
  user_id: number
  type: string
  file_url: string
  status: string
  reviewer_id?: number
  notes?: string
  llm_verified?: boolean
  llm_confidence?: number
  llm_recommendation?: string
  llm_reasoning?: string
  llm_issues?: string[]
  llm_extracted_info?: Record<string, any>
  llm_verified_at?: string
  created_at: string
  user?: {
    id: number
    name: string
    email: string
    phone?: string
    compound_id?: number
  }
}

export default function AdminVerificationsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedDoc, setSelectedDoc] = useState<VerificationDocument | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request-more' | null>(null)

  const { data: documents, isLoading, refetch } = useQuery<VerificationDocument[]>({
    queryKey: ['admin-verifications'],
    queryFn: async () => {
      const response = await api.get('/api/admin/verifications?status_filter=PENDING')
      return response.data
    },
  })

  const llmVerifyMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(`/api/admin/verifications/${docId}/verify-with-llm`)
      return response.data
    },
    onSuccess: (data) => {
      toast({
        title: "LLM Verification Complete! 🤖",
        description: `Recommendation: ${data.llm_result.recommendation}`,
        variant: "success",
      })
      refetch()
    },
    onError: (error: any) => {
      toast({
        title: "LLM Verification Failed",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/approve`, { notes })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Document Approved! ✅",
        description: "The document has been approved.",
        variant: "success",
      })
      setActionDialogOpen(false)
      setSelectedDoc(null)
      setReviewNotes('')
      refetch()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/reject`, { notes })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "Document Rejected",
        description: "The document has been rejected.",
        variant: "default",
      })
      setActionDialogOpen(false)
      setSelectedDoc(null)
      setReviewNotes('')
      refetch()
    },
  })

  const requestMoreMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/request-more-details`, { notes })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: "More Details Requested",
        description: "The user will be notified to provide more information.",
        variant: "default",
      })
      setActionDialogOpen(false)
      setSelectedDoc(null)
      setReviewNotes('')
      refetch()
    },
  })

  const handleAction = (doc: VerificationDocument, type: 'approve' | 'reject' | 'request-more') => {
    setSelectedDoc(doc)
    setActionType(type)
    setReviewNotes('')
    setActionDialogOpen(true)
  }

  const submitAction = () => {
    if (!selectedDoc) return

    const notes = reviewNotes.trim() || undefined

    if (actionType === 'approve') {
      approveMutation.mutate({ docId: selectedDoc.id, notes })
    } else if (actionType === 'reject') {
      rejectMutation.mutate({ docId: selectedDoc.id, notes })
    } else if (actionType === 'request-more') {
      requestMoreMutation.mutate({ docId: selectedDoc.id, notes })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Approved</span>
      case 'REJECTED':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Rejected</span>
      case 'REQUEST_MORE_DETAILS':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">More Details Needed</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Pending</span>
    }
  }

  const getLLMRecommendationBadge = (recommendation?: string) => {
    if (!recommendation) return null
    
    switch (recommendation) {
      case 'APPROVE':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          LLM: Approve
        </span>
      case 'REJECT':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          LLM: Reject
        </span>
      case 'REQUEST_MORE_DETAILS':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          LLM: More Details
        </span>
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading verifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Document Verification
          </h1>
          <p className="text-gray-600">Review and verify user documents</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                  <p className="text-3xl font-bold text-blue-700">{documents?.length || 0}</p>
                </div>
                <AlertCircle className="w-12 h-12 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        {documents && documents.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">All caught up!</h3>
              <p className="text-gray-500">No pending verifications at the moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {documents?.map((doc) => (
              <Card key={doc.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fade-in">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">
                          {doc.type === 'NATIONAL_ID' ? 'National ID' : 'Residency/Ownership Contract'}
                        </CardTitle>
                        {getStatusBadge(doc.status)}
                        {getLLMRecommendationBadge(doc.llm_recommendation)}
                      </div>
                      <CardDescription>
                        Submitted {new Date(doc.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* User Info */}
                  {doc.user && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        User Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{doc.user.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{doc.user.email}</span>
                        </div>
                        {doc.user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{doc.user.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LLM Verification Results */}
                  {doc.llm_verified_at && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold text-sm text-purple-900">AI Verification Results</h4>
                        {doc.llm_confidence !== undefined && (
                          <span className="ml-auto text-xs text-gray-600">
                            Confidence: {Math.round(doc.llm_confidence * 100)}%
                          </span>
                        )}
                      </div>
                      {doc.llm_reasoning && (
                        <p className="text-sm text-gray-700">{doc.llm_reasoning}</p>
                      )}
                      {doc.llm_issues && doc.llm_issues.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-red-700 mb-1">Issues Found:</p>
                          <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                            {doc.llm_issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {doc.llm_extracted_info && Object.keys(doc.llm_extracted_info).length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-green-700 mb-1">Extracted Information:</p>
                          <div className="text-xs text-gray-600 space-y-1">
                            {Object.entries(doc.llm_extracted_info).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Document Preview */}
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Document Preview</h4>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Full Document
                      </a>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                      <img
                        src={doc.file_url}
                        alt={doc.type}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EDocument Preview%3C/text%3E%3C/svg%3E'
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {!doc.llm_verified_at && (
                      <Button
                        variant="outline"
                        onClick={() => llmVerifyMutation.mutate(doc.id)}
                        disabled={llmVerifyMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {llmVerifyMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Verify with AI
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="default"
                      onClick={() => handleAction(doc, 'approve')}
                      className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction(doc, 'reject')}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction(doc, 'request-more')}
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Request More Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' && 'Approve Document'}
                {actionType === 'reject' && 'Reject Document'}
                {actionType === 'request-more' && 'Request More Details'}
              </DialogTitle>
              <DialogDescription>
                {actionType === 'approve' && 'This will approve the document and notify the user.'}
                {actionType === 'reject' && 'This will reject the document. Please provide a reason.'}
                {actionType === 'request-more' && 'Request additional information from the user.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes or comments..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitAction}
                  disabled={
                    approveMutation.isPending ||
                    rejectMutation.isPending ||
                    requestMoreMutation.isPending
                  }
                  className={
                    actionType === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : actionType === 'reject'
                      ? 'bg-red-600 hover:bg-red-700'
                      : ''
                  }
                >
                  {approveMutation.isPending || rejectMutation.isPending || requestMoreMutation.isPending
                    ? 'Processing...'
                    : 'Confirm'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

