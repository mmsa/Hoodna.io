import { Car, Home, Package, ShoppingBag, Wrench, type LucideIcon } from "lucide-react"
import type { Listing, ListingCategory, ListingIntent } from "@hoodna/shared"

export type ListingView = Partial<Pick<Listing, "compound_id" | "status">> &
  Omit<Listing, "compound_id" | "status"> & {
    average_rating?: number | null
    review_count?: number
  }

export const LISTING_CATEGORIES: Array<{
  value: ListingCategory | ""
  label: string
  icon: LucideIcon
}> = [
  { value: "", label: "All categories", icon: ShoppingBag },
  { value: "ITEM", label: "Items", icon: Package },
  { value: "CAR", label: "Vehicles", icon: Car },
  { value: "PROPERTY", label: "Property", icon: Home },
  { value: "SERVICE", label: "Services", icon: Wrench },
]

export const LISTING_INTENTS: Array<{ value: ListingIntent | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "SELL", label: "For sale" },
  { value: "RENT", label: "For rent" },
]

export const LISTING_SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
]

export function categoryMeta(category: string) {
  return (
    LISTING_CATEGORIES.find((item) => item.value === category) ??
    LISTING_CATEGORIES[0]
  )
}

export function intentLabel(intent?: string | null, service = false) {
  if (service) return intent === "RENT" ? "Per hour / session" : "One-time service"
  return intent === "RENT" ? "For rent" : "For sale"
}

export function formatListingPrice(
  price?: number | null,
  currency = "EGP",
  service = false
) {
  if (price == null) return "Price on request"
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(price)
  return service ? `From ${formatted} ${currency}` : `${formatted} ${currency}`
}
