'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import { CheckCircle, XCircle } from 'lucide-react'

interface VerificationDocument {
  id: number
  type: string
  file_url: string
  status: string
  notes: string | null
  created_at: string
}

export default function AdminPage() {
  const queryClient = useQueryClient()

  const { data: documents, isLoading } = useQuery<VerificationDocument[]>({
    queryKey: ['admin-verifications'],
    queryFn: async () => {
      const response = await api.get('/api/admin/verifications?status_filter=PENDING')
      return response.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await api.post(`/api/admin/verifications/${docId}/approve`, {})
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ docId, notes }: { docId: number; notes?: string }) => {
      const response = await api.post(`/api/admin/verifications/${docId}/reject`, {
        notes: notes || '',
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] })
    },
  })

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {/* Redirect to new dashboard */}
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4">Admin dashboard has been moved to a unified interface.</p>
            <Button asChild>
              <Link href="/admin/dashboard">Go to Admin Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents?.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold">{doc.type}</h3>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Document
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(doc.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate({ docId: doc.id })}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {documents?.length === 0 && (
                <p className="text-center text-gray-500 py-8">No pending verifications</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

