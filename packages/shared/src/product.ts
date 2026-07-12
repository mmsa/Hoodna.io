export const LISTING_CATEGORIES = [
  { value: "ITEM", label: "Item" },
  { value: "CAR", label: "Vehicle" },
  { value: "PROPERTY", label: "Property" },
  { value: "SERVICE", label: "Service" },
] as const;

export const POST_CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "HELP", label: "Help request" },
  { value: "LOST_FOUND", label: "Lost and found" },
  { value: "EVENT", label: "Event" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "ALERT", label: "Alert" },
  { value: "DISCUSSION", label: "Discussion" },
] as const;

export function humanizeEnum(value?: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRelativeTime(
  value: string | Date,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatCompoundLabel(
  name?: string | null,
  area?: string | null,
): string {
  if (!name) return "Choose a compound";
  return area ? `${name}, ${area}` : name;
}
