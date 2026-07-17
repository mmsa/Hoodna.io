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

export function intentLabel(
  intent?: string | null,
  category?: ListingCategory | string | null
) {
  if (category === "SERVICE") return intent === "RENT" ? "Hourly" : "One-time"
  if (category === "PROPERTY" && intent === "RENT") return "For rent"
  return "For sale"
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

export function friendlyListingValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}

export function listingAttributeSummary(listing: Pick<Listing, "category" | "attributes">) {
  const attributes = listing.attributes
  if (!attributes) return null

  if (listing.category === "ITEM" && "condition" in attributes) {
    return friendlyListingValue(attributes.condition)
  }
  if (listing.category === "CAR" && "make" in attributes) {
    return `${attributes.year} · ${attributes.make} ${attributes.model} · ${attributes.mileage_km.toLocaleString()} km`
  }
  if (listing.category === "PROPERTY" && "property_type" in attributes) {
    return `${friendlyListingValue(attributes.property_type)} · ${attributes.bedrooms} bd · ${attributes.bathrooms} ba · ${attributes.area_sqm.toLocaleString()} m²`
  }
  return null
}

export function listingAttributeDetails(
  listing: Pick<Listing, "category" | "attributes">
): Array<{ label: string; value: string }> {
  const attributes = listing.attributes
  if (!attributes) return []

  if (listing.category === "ITEM" && "condition" in attributes) {
    return [{ label: "Condition", value: friendlyListingValue(attributes.condition) }]
  }
  if (listing.category === "CAR" && "make" in attributes) {
    return [
      { label: "Make and model", value: `${attributes.make} ${attributes.model}` },
      { label: "Year", value: String(attributes.year) },
      { label: "Mileage", value: `${attributes.mileage_km.toLocaleString()} km` },
      { label: "Transmission", value: friendlyListingValue(attributes.transmission) },
      { label: "Fuel type", value: friendlyListingValue(attributes.fuel_type) },
    ]
  }
  if (listing.category === "PROPERTY" && "property_type" in attributes) {
    return [
      { label: "Property type", value: friendlyListingValue(attributes.property_type) },
      { label: "Bedrooms", value: String(attributes.bedrooms) },
      { label: "Bathrooms", value: String(attributes.bathrooms) },
      { label: "Area", value: `${attributes.area_sqm.toLocaleString()} m²` },
      { label: "Furnishing", value: friendlyListingValue(attributes.furnishing) },
    ]
  }
  return []
}
