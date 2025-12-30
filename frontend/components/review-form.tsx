'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RatingInput } from '@/components/ui/rating'
import { Card, CardContent } from '@/components/ui/card'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface ReviewFormProps {
  listingId: number
  existingReview?: {
    id: number
    rating: number
    comment?: string | null
  } | null
  onSuccess?: () => void
}

export function ReviewForm({ listingId, existingReview, onSuccess }: ReviewFormProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createMutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      const response = await api.post(`/listings/${listingId}/reviews`, {
        listing_id: listingId,
        rating: data.rating,
        comment: data.comment || null,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings', listingId] })
      queryClient.invalidateQueries({ queryKey: ['reviews', listingId] })
      queryClient.invalidateQueries({ queryKey: ['reviews', listingId, 'stats'] })
      toast.success('Review submitted successfully!')
      setRating(0)
      setComment('')
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit review')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      const response = await api.put(`/reviews/${existingReview!.id}`, {
        rating: data.rating,
        comment: data.comment || null,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings', listingId] })
      queryClient.invalidateQueries({ queryKey: ['reviews', listingId] })
      queryClient.invalidateQueries({ queryKey: ['reviews', listingId, 'stats'] })
      toast.success('Review updated successfully!')
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update review')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    setIsSubmitting(true)
    
    try {
      if (existingReview) {
        await updateMutation.mutateAsync({ rating, comment })
      } else {
        await createMutation.mutateAsync({ rating, comment })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Please sign in to leave a review
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {existingReview ? 'Update Your Review' : 'Write a Review'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Rating *
            </label>
            <RatingInput
              value={rating}
              onChange={setRating}
              size="lg"
            />
          </div>
          
          <div>
            <label htmlFor="comment" className="block text-sm font-medium mb-2">
              Comment (optional)
            </label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className="w-full"
          >
            {isSubmitting
              ? 'Submitting...'
              : existingReview
              ? 'Update Review'
              : 'Submit Review'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

