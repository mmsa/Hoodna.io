"use client"

import Link from "next/link"
import { Bookmark, Calendar, MapPin } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { Rating } from "@/components/ui/rating"
import { cn } from "@/lib/utils"
import {
  categoryMeta,
  formatListingPrice,
  intentLabel,
  type ListingView,
} from "./listing-meta"

interface ListingCardProps {
  listing: ListingView
  action?: React.ReactNode
  className?: string
}

export function ListingCard({ listing, action, className }: ListingCardProps) {
  const category = categoryMeta(listing.category)
  const CategoryIcon = category.icon
  const isService = listing.category === "SERVICE"

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/35",
        className
      )}
    >
      <Link
        href={`/listing/${listing.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {listing.image_urls?.[0] ? (
            <SignedFileImage
              fileUrl={listing.image_urls[0]}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <CategoryIcon aria-hidden="true" className="h-10 w-10" />
            </div>
          )}
          {listing.is_saved ? (
            <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-primary">
              <Bookmark aria-label="Saved" className="h-4 w-4 fill-current" />
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{category.label}</span>
            <span aria-hidden="true">·</span>
            <span>{intentLabel(listing.intent, isService)}</span>
          </div>
          <h2 className="line-clamp-2 text-base font-semibold leading-6 text-foreground group-hover:text-primary">
            {listing.title}
          </h2>
          {listing.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {listing.description}
            </p>
          ) : null}
          <p className="mt-4 text-lg font-semibold tracking-tight">
            {formatListingPrice(listing.price, listing.currency, isService)}
          </p>

          {isService && listing.average_rating ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Rating rating={listing.average_rating} size="sm" />
              <span>{listing.review_count ?? 0} reviews</span>
            </div>
          ) : (
            <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {listing.compound_name ? (
                <span className="flex items-center gap-1">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {listing.compound_name}
                </span>
              ) : null}
              {listing.created_at ? (
                <span className="flex items-center gap-1">
                  <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                  {new Date(listing.created_at).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </Link>
      {action ? <div className="border-t border-border p-3">{action}</div> : null}
    </article>
  )
}
