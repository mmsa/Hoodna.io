"use client"

import { useQuery } from "@tanstack/react-query"
import { MessageSquare } from "lucide-react"

import { Rating } from "@/components/ui/rating"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states"
import api from "@/lib/api"
import { formatTimeAgo } from "@/lib/utils"

interface Review {
  id: number
  reviewer_name: string
  rating: number
  comment?: string | null
  created_at: string
}

export function ReviewsList({ listingId }: { listingId: number }) {
  const { data: reviews, isLoading, error } = useQuery<Review[]>({
    queryKey: ["reviews", listingId],
    queryFn: async () =>
      (await api.get(`/api/listings/${listingId}/reviews`)).data || [],
  })

  if (isLoading) {
    return <LoadingState className="min-h-36" title="Loading reviews" />
  }
  if (error) {
    return <ErrorState className="min-h-36" title="Reviews could not be loaded" />
  }
  if (!reviews?.length) {
    return (
      <EmptyState
        className="min-h-36"
        icon={<MessageSquare className="h-5 w-5" />}
        title="No reviews yet"
        description="The first review will appear here."
      />
    )
  }

  return (
    <section aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-lg font-semibold">Reviews ({reviews.length})</h2>
      <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card px-5">
        {reviews.map((review) => (
          <article key={review.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{review.reviewer_name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatTimeAgo(new Date(review.created_at))}
                </p>
              </div>
              <Rating rating={review.rating} size="sm" />
            </div>
            {review.comment ? (
              <p className="mt-3 text-sm leading-6 text-foreground">{review.comment}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
