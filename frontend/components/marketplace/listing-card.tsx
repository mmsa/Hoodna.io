"use client"

import Link from "next/link"
import { Bookmark, MapPin } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { Avatar } from "@/components/ui/avatar"
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
  const sellerName = listing.owner_name || "Neighbour"

  return (
    <article className={cn("social-card group", className)}>
      <Link
        href={`/listing/${listing.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {listing.image_urls?.[0] ? (
            <SignedFileImage
              fileUrl={listing.image_urls[0]}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/5 to-[hsl(var(--social-warm)/0.15)] text-muted-foreground">
              <CategoryIcon aria-hidden="true" className="h-10 w-10 text-primary/60" />
              <span className="text-xs font-medium">No photo yet</span>
            </div>
          )}

          <div className="absolute left-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
            {category.label}
          </div>

          <div className="absolute bottom-3 left-3 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-md">
            {formatListingPrice(listing.price, listing.currency, isService)}
          </div>

          {listing.is_saved ? (
            <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/95 text-primary shadow-sm">
              <Bookmark aria-label="Saved" className="h-4 w-4 fill-current" />
            </span>
          ) : null}
        </div>

        <div className="p-3.5">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">
            {listing.title}
          </h2>

          <div className="mt-2.5 flex items-center gap-2">
            <Avatar name={sellerName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{sellerName}</p>
              <p className="text-[11px] text-muted-foreground">
                {intentLabel(listing.intent, isService)}
              </p>
            </div>
          </div>

          {isService && listing.average_rating ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Rating rating={listing.average_rating} size="sm" />
              <span>{listing.review_count ?? 0} reviews</span>
            </div>
          ) : listing.compound_name ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span className="truncate">{listing.compound_name}</span>
            </p>
          ) : null}
        </div>
      </Link>
      {action ? <div className="border-t border-border p-3">{action}</div> : null}
    </article>
  )
}
