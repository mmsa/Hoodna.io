export type PostCategory =
  | "GENERAL"
  | "HELP"
  | "LOST_FOUND"
  | "EVENT"
  | "MARKETPLACE"
  | "ANNOUNCEMENT"
  | "ALERT"
  | "DISCUSSION"

export interface Comment {
  id: number
  author_name: string
  author_status?: string
  content: string
  created_at: string
}

export interface Post {
  id: number
  author_id: number
  author_name: string
  content: string
  created_at: string
  compound_id?: number
  compound_name?: string
  author_status?: string
  category?: PostCategory | string
  is_urgent?: boolean
  comments: Comment[]
  reaction_counts?: Record<string, number>
  user_reaction?: string | null
}

export interface Listing {
  id: number
  title: string
  category: string
  price: number
  currency: string
  intent: string
  image_urls: string[]
  compound_name: string
  owner_name: string
  created_at: string
}

export interface FeedSummary {
  compound_name: string | null
  compound_area: string | null
  compound_developer: string | null
  compound_status: string | null
  compound_hero_image_url?: string | null
  recent_listings_count: number
  recent_posts_count: number
  total_neighbors: number
}

export interface ResidentUser {
  id?: number
  name: string
  role: string
  status?: string
  compound_id?: number | null
}

export const POST_CATEGORIES: Array<{
  value: PostCategory
  label: string
}> = [
  { value: "GENERAL", label: "General" },
  { value: "HELP", label: "Help request" },
  { value: "LOST_FOUND", label: "Lost & found" },
  { value: "EVENT", label: "Event" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "DISCUSSION", label: "Discussion" },
]

export function categoryLabel(category?: string) {
  if (!category) return "General"
  return (
    POST_CATEGORIES.find((item) => item.value === category)?.label ??
    category
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^\w/, (letter) => letter.toUpperCase())
  )
}

export function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const CATEGORY_ACCENTS: Record<string, string> = {
  GENERAL: "border-l-border",
  HELP: "border-l-amber-400",
  LOST_FOUND: "border-l-pink-400",
  EVENT: "border-l-primary",
  MARKETPLACE: "border-l-emerald-500",
  ANNOUNCEMENT: "border-l-amber-400",
  ALERT: "border-l-destructive",
  DISCUSSION: "border-l-violet-400",
}

const CATEGORY_BADGES: Record<string, string> = {
  GENERAL: "bg-muted text-muted-foreground",
  HELP: "bg-amber-50 text-amber-800",
  LOST_FOUND: "bg-pink-50 text-pink-800",
  EVENT: "bg-primary/10 text-primary",
  MARKETPLACE: "bg-emerald-50 text-emerald-800",
  ANNOUNCEMENT: "bg-amber-50 text-amber-900",
  ALERT: "bg-destructive/10 text-destructive",
  DISCUSSION: "bg-violet-50 text-violet-800",
}

export function categoryAccentClass(category?: string) {
  const key = category?.toUpperCase() ?? "GENERAL"
  return CATEGORY_ACCENTS[key] ?? CATEGORY_ACCENTS.GENERAL
}

export function categoryBadgeClass(category?: string) {
  const key = category?.toUpperCase() ?? "GENERAL"
  return CATEGORY_BADGES[key] ?? CATEGORY_BADGES.GENERAL
}
