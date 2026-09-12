import { getNotificationRoute, type NotificationRouteInput } from "@hoodna/shared";

/**
 * Maps a notification to an expo-router path.
 *
 * Shared by the in-app notification list and by push-notification taps so the
 * two cannot drift apart — a push must open the same screen the list would.
 * Returns null when there is no specific destination, in which case the caller
 * should fall back to the notification list.
 */
export function notificationPath(
  notification: NotificationRouteInput,
): string | null {
  const destination = getNotificationRoute(notification);

  switch (destination.type) {
    case "post":
      return `/post/${destination.id}`;
    case "listing":
      return `/listing/${destination.id}`;
    case "message":
      return `/messages/${destination.id}`;
    case "verification":
      return "/verification";
    case "business":
      return `/businesses/${destination.slug}`;
    case "digest":
      return "/digest";
  }

  const type = (notification.type || "").toUpperCase();
  if (type.startsWith("BUSINESS_CLAIM")) return "/business-claims";
  if (type === "REFERRAL_ACCEPTED") return "/invite-neighbours";
  return null;
}
