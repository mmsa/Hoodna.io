'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'

export default function PromotePage({ params }: { params: Promise<{ listingId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const listingId = parseInt(resolvedParams.listingId)

  const promoteMutation = useMutation({
    mutationFn: async ({ scope, duration }: { scope: string; duration: number }) => {
      const response = await api.post('/api/promotions/checkout', {
        listing_id: listingId,
        scope,
        duration_days: duration,
      })
      return response.data
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.url
    },
  })

  const handlePromote = (scope: 'CROSS_COMPOUND' | 'PUBLIC', duration: number) => {
    promoteMutation.mutate({ scope, duration })
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Promote Your Listing</CardTitle>
            <CardDescription>Reach more people by promoting your listing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Cross-Compound Promotion</h3>
              <p className="text-sm text-gray-600 mb-4">
                Make your listing visible to users in other compounds
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">50 EGP/week</span>
                <Button
                  onClick={() => handlePromote('CROSS_COMPOUND', 7)}
                  disabled={promoteMutation.isPending}
                >
                  Promote
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Public Promotion</h3>
              <p className="text-sm text-gray-600 mb-4">
                Make your listing visible to everyone, including non-logged-in visitors
              </p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">100 EGP/week</span>
                <Button
                  onClick={() => handlePromote('PUBLIC', 7)}
                  disabled={promoteMutation.isPending}
                >
                  Promote
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

