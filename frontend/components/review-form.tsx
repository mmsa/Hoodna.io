"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RatingInput } from "@/components/ui/rating"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import api from "@/lib/api"
import { useFeatureConfig } from "@/components/feature-config-provider"

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
  const { isEnabled } = useFeatureConfig()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [comment, setComment] = useState(existingReview?.comment || "")

  const mutation = useMutation({
    mutationFn: async () =>
      existingReview
        ? api.put(`/api/reviews/${existingReview.id}`, {
            rating,
            comment: comment.trim() || null,
          })
        : api.post(`/api/listings/${listingId}/reviews`, {
            listing_id: listingId,
            rating,
            comment: comment.trim() || null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] })
      queryClient.invalidateQueries({ queryKey: ["reviews", listingId] })
      toast.success(existingReview ? "Review updated" : "Review submitted")
      if (!existingReview) {
        setRating(0)
        setComment("")
      }
      onSuccess?.()
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.detail || "Could not submit review"),
  })

  if (!user || !isEnabled("business_reviews")) return null

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="write-review-title">
      <h2 id="write-review-title" className="text-lg font-semibold">
        {existingReview ? "Update your review" : "Write a review"}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!rating) {
            toast.error("Choose a rating")
            return
          }
          mutation.mutate()
        }}
        className="mt-4 space-y-4"
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Rating</legend>
          <RatingInput value={rating} onChange={setRating} size="lg" />
        </fieldset>
        <label className="block text-sm font-medium" htmlFor="review-comment">
          Comment <span className="font-normal text-muted-foreground">(optional)</span>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share useful details about your experience."
            className="mt-2 min-h-24 resize-y"
          />
        </label>
        <Button type="submit" disabled={mutation.isPending || !rating}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mutation.isPending ? "Submitting…" : existingReview ? "Update review" : "Submit review"}
        </Button>
      </form>
    </section>
  )
}
