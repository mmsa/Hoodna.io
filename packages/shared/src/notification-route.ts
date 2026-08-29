import { EljiranRoute } from "./links";

export interface NotificationRouteInput {
  id: number;
  type: string;
  related_id?: number | null;
  related_type?: string | null;
  extra_data?: Record<string, unknown> | null;
}

/** Resolves Eljiran notifications to one shared web/mobile route contract. */
export function getNotificationRoute(
  notification: NotificationRouteInput,
): EljiranRoute {
  const relatedType = notification.related_type?.toLowerCase();
  const type = notification.type.toUpperCase();

  if (relatedType === "post" && notification.related_id) {
    return { type: "post", id: notification.related_id };
  }
  if (relatedType === "listing" && notification.related_id) {
    return { type: "listing", id: notification.related_id };
  }
  if (
    (relatedType === "message" || type === "MESSAGE") &&
    notification.related_id
  ) {
    return { type: "message", id: notification.related_id };
  }
  if (relatedType === "business") {
    const slug = notification.extra_data?.business_slug;
    if (typeof slug === "string" && slug) return { type: "business", slug };
  }
  if (type.startsWith("VERIFICATION") || relatedType === "verification") {
    return { type: "verification" };
  }
  if (type.toLowerCase().includes("digest")) {
    const digestId = notification.extra_data?.digest_id;
    return {
      type: "digest",
      id: typeof digestId === "number" ? digestId : undefined,
    };
  }
  return { type: "notification", id: notification.id };
}
