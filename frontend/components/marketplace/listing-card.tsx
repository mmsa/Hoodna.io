"use client"

import Link from "next/link"
import { Heart } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { cn } from "@/lib/utils"
import {
  categoryMeta,
  formatListingPrice,
  intentLabel,
  listingAttributeSummary,
  type ListingView,
} from "./listing-meta"

function formatListedAgo(dateString: string) {
  const hours = Math.floor((Date.now() - new Date(dateString).getTime()) / 3600000)
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString()
}

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
  const location = listing.compound_name || "Your compound"
  const attributeSummary = listingAttributeSummary(listing)

  return (
    <article
      className={cn(
        "eljiran-card group transition-transform duration-200 hover:-translate-y-0.5",
        className
      )}
    >
      <Link
        href={`/listing/${listing.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {listing.image_urls?.[0] ? (
            <SignedFileImage
              fileUrl={listing.image_urls[0]}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-primary/5 text-muted-foreground">
              <CategoryIcon aria-hidden="true" className="h-9 w-9 text-primary/40" />
              <span className="text-xs font-medium">Add a photo</span>
            </div>
          )}

          <div className="absolute bottom-3 left-3">
            <span className="eljiran-price-overlay">
              {listing.intent === "FREE"
                ? "Free"
                : formatListingPrice(listing.price, listing.currency, isService)}
            </span>
          </div>

          <span
            className={cn(
              "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-card",
              listing.is_saved ? "text-accent" : "text-muted-foreground"
            )}
          >
            <Heart
              aria-label={listing.is_saved ? "Saved" : "Save listing"}
              className={cn("h-4 w-4", listing.is_saved && "fill-current")}
            />
          </span>
        </div>

        <div className="space-y-1 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {category.label} · {intentLabel(listing.intent, listing.category)}
          </p>
          <h2 className="line-clamp-2 text-base font-semibold leading-5 text-foreground">
            {listing.title}
          </h2>
          {attributeSummary ? (
            <p className="truncate text-sm text-muted-foreground">{attributeSummary}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {sellerName} · {location}
            {listing.created_at ? ` · ${formatListedAgo(listing.created_at)}` : ""}
          </p>
        </div>
      </Link>
      {action ? <div className="border-t border-border p-3">{action}</div> : null}
    </article>
  )
}
