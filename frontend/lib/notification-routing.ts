import { getNotificationRoute, type NotificationRouteInput } from "@hoodna/shared"

export function notificationHref(notification: NotificationRouteInput): string {
  const route = getNotificationRoute(notification)
  switch (route.type) {
    case "post": return `/feed#post-${route.id}`
    case "listing": return `/listing/${route.id}`
    case "message": return `/messages/${route.id}`
    case "verification": return "/verification"
    case "business": return `/businesses/${encodeURIComponent(route.slug)}`
    case "digest": return "/digest"
    case "notification": return "/notifications"
    default: return "/"
  }
}
