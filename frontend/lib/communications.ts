export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  read: boolean
  read_at: string | null
  related_id: number | null
  related_type: string | null
  extra_data: Record<string, unknown> | null
  created_at: string
}

export interface NotificationListResponse {
  items: AppNotification[]
  total: number
  unread_count: number
  skip: number
  limit: number
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const elapsed = Date.now() - date.getTime()
  const minutes = Math.floor(elapsed / 60_000)
  const hours = Math.floor(elapsed / 3_600_000)
  const days = Math.floor(elapsed / 86_400_000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function numericExtra(
  extraData: Record<string, unknown> | null,
  key: string
): number | null {
  const value = extraData?.[key]
  if (typeof value === "number") return value
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value)
  return null
}

export function getNotificationHref(notification: AppNotification): string {
  const { related_id: relatedId, related_type: relatedType, extra_data: extra } =
    notification

  if (relatedType === "message") {
    const conversationId = numericExtra(extra, "conversation_id") ?? relatedId
    return conversationId ? `/messages/${conversationId}` : "/messages"
  }
  if (relatedType === "listing" && relatedId) return `/listing/${relatedId}`
  if (relatedType === "post" && relatedId) return `/feed?post=${relatedId}`
  if (relatedType === "comment") {
    const postId = numericExtra(extra, "post_id") ?? relatedId
    return postId ? `/feed?post=${postId}` : "/feed"
  }
  if (relatedType === "service_provider") return "/provider/status"
  if (relatedType === "moderator") return "/onboarding/moderator"
  if (notification.type.includes("VERIFICATION") || relatedType === "verification") {
    return "/verification"
  }
  return "/notifications"
}
