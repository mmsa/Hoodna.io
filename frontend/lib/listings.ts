import { Car, Home, Package, ShoppingBag, Wrench, type LucideIcon } from "lucide-react"

export type ListingCategory = "PROPERTY" | "CAR" | "ITEM" | "SERVICE"
export type ListingIntent = "SELL" | "RENT"

export interface Listing {
  id: number
  title: string
  description?: string | null
  price?: number | null
  currency?: string
  category: string
  intent?: string | null
  image_urls?: string[]
  compound_name?: string
  owner_id?: number
  owner_name?: string
  owner_email?: string
  owner_phone?: string
  created_at?: string
  is_saved?: boolean
  average_rating?: number | null
  review_count?: number
}

export interface CategoryOption {
  value: ListingCategory
  label: string
  description: string
  icon: LucideIcon
}

export const LISTING_CATEGORIES: CategoryOption[] = [
  { value: "PROPERTY", label: "Property", description: "Homes and spaces", icon: Home },
  { value: "CAR", label: "Vehicles", description: "Cars and transport", icon: Car },
  { value: "ITEM", label: "Items", description: "Goods and equipment", icon: Package },
  { value: "SERVICE", label: "Services", description: "Professional help", icon: Wrench },
]

export const MARKETPLACE_CATEGORIES = LISTING_CATEGORIES.filter(
  (category) => category.value !== "SERVICE"
)

export const LISTING_SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
]

export function getCategory(category?: string) {
  return (
    LISTING_CATEGORIES.find((option) => option.value === category?.toUpperCase()) ?? {
      value: "ITEM" as const,
      label: "Listing",
      description: "Community listing",
      icon: ShoppingBag,
    }
  )
}

export function getIntentLabel(intent?: string | null, service = false) {
  if (service) return intent === "RENT" ? "Hourly / session" : "One-time"
  return intent === "RENT" ? "For rent" : "For sale"
}

export function formatListingPrice(listing: Pick<Listing, "price" | "currency">) {
  if (listing.price == null) return "Price on request"
  return `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`
}

export function formatListingDate(value?: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}
