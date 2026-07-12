import type { Post } from "@hoodna/shared";

export type FeedCategory =
  | ""
  | "help"
  | "lost"
  | "event"
  | "marketplace"
  | "general";

export const POST_FILTERS: ReadonlyArray<{ value: FeedCategory; label: string }> = [
  { value: "", label: "All" },
  { value: "help", label: "Help" },
  { value: "lost", label: "Lost & found" },
  { value: "event", label: "Events" },
  { value: "marketplace", label: "Market" },
  { value: "general", label: "General" },
];

export const POST_CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "HELP", label: "Help" },
  { value: "LOST_FOUND", label: "Lost & found" },
  { value: "EVENT", label: "Event" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "DISCUSSION", label: "Discussion" },
  { value: "ALERT", label: "Alert" },
] as const;

const CATEGORY_META: Record<
  string,
  { label: string; type: Exclude<FeedCategory, ""> }
> = {
  GENERAL: { label: "General", type: "general" },
  HELP: { label: "Help", type: "help" },
  LOST_FOUND: { label: "Lost & found", type: "lost" },
  EVENT: { label: "Event", type: "event" },
  MARKETPLACE: { label: "Marketplace", type: "marketplace" },
  ANNOUNCEMENT: { label: "Announcement", type: "general" },
  ALERT: { label: "Alert", type: "general" },
  DISCUSSION: { label: "Discussion", type: "general" },
};

export function getPostMeta(post: Post) {
  if (post.category && CATEGORY_META[post.category]) {
    return CATEGORY_META[post.category];
  }

  const content = post.content.toLowerCase();
  if (/(lost|found|missing)/.test(content)) return CATEGORY_META.LOST_FOUND;
  if (/(help|need|urgent)/.test(content)) return CATEGORY_META.HELP;
  if (/(event|gathering|meeting)/.test(content)) return CATEGORY_META.EVENT;
  if (/(sell|buy|for sale)/.test(content)) return CATEGORY_META.MARKETPLACE;
  return CATEGORY_META.GENERAL;
}

export function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

export function filterAndSortPosts(
  posts: Post[],
  query: string,
  category: FeedCategory,
  sort: "newest" | "oldest",
) {
  const normalizedQuery = query.trim().toLowerCase();
  return posts
    .filter((post) => {
      const matchesQuery =
        !normalizedQuery ||
        post.content.toLowerCase().includes(normalizedQuery) ||
        post.author_name.toLowerCase().includes(normalizedQuery) ||
        post.comments.some((comment) =>
          comment.content.toLowerCase().includes(normalizedQuery),
        );
      return matchesQuery && (!category || getPostMeta(post).type === category);
    })
    .sort((a, b) => {
      const difference =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sort === "newest" ? difference : -difference;
    });
}
