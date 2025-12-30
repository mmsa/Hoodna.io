'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Rating } from '@/components/ui/rating'
import api from '@/lib/api'
import { formatTimeAgo } from '@/lib/utils'

interface Review {
  id: number
  listing_id: number
  reviewer_id: number
  reviewer_name: string
  rating: number
  comment?: string | null
  created_at: string
  updated_at: string
}

interface ReviewsListProps {
  listingId: number
}

export function ReviewsList({ listingId }: ReviewsListProps) {
  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ['reviews', listingId],
    queryFn: async () => {
      const response = await api.get(`/api/listings/${listingId}/reviews`)
      return response.data
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading reviews...</div>
        </CardContent>
      </Card>
    )
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Reviews</h3>
          <p className="text-gray-500 text-center py-4">No reviews yet. Be the first to review!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Reviews ({reviews.length})
        </h3>
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{review.reviewer_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatTimeAgo(new Date(review.created_at))}
                  </p>
                </div>
                <Rating rating={review.rating} size="sm" />
              </div>
              {review.comment && (
                <p className="text-gray-700 mt-2">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

