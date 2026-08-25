import { useState } from "react";
import {
  Alert,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ELJIRAN_WEB_ORIGIN, type ApiClient, type Post } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui";
import { LinkifiedText, LinkPreviewCard } from "@/components/link-preview";
import { colors } from "@/constants/colors";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NeighbourPostCard({
  post,
  apiClient,
  currentUser,
  onPostDeleted,
}: {
  post: Post;
  apiClient?: ApiClient;
  currentUser?: { id?: number; role?: string } | null;
  onPostDeleted?: (postId: number) => void;
}) {
  const router = useRouter();
  const timeAgo = formatTimeAgo(post.created_at);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(
    post.reaction_counts ?? {},
  );
  const [userReaction, setUserReaction] = useState<string | null>(
    post.user_reaction ?? null,
  );
  const [poll, setPoll] = useState(post.poll);
  const [saved, setSaved] = useState(Boolean(post.is_saved));
  const likeCount = (reactionCounts.LIKE ?? 0) + (reactionCounts.LOVE ?? 0);
  const commentCount = post.comments?.length ?? 0;
  const liked = userReaction === "LIKE" || userReaction === "LOVE";

  async function handleLike() {
    try {
      const result = await apiClient?.reactToPost(post.id, "LIKE");
      if (result) {
        setReactionCounts(result.reaction_counts);
        setUserReaction(result.user_reaction);
      }
    } catch (error: any) {
      Alert.alert("Could not react", error?.message || "Please try again.");
    }
  }

  async function handleShare() {
    try {
      const postUrl = `${ELJIRAN_WEB_ORIGIN}/feed#post-${post.id}`;
      await Share.share({
        title: `${post.author_name} on eljiran.io`,
        message: `${post.content}\n\n${postUrl}`,
        url: postUrl,
      });
    } catch {
      Alert.alert("Could not share", "Please try again.");
    }
  }

  async function handleSave() {
    try {
      if (saved) await apiClient?.unsavePost(post.id);
      else await apiClient?.savePost(post.id);
      setSaved((value) => !value);
    } catch (error: any) {
      Alert.alert("Could not update saved posts", error?.message || "Please try again.");
    }
  }

  async function handleVote(optionId: number) {
    try {
      const updated = await apiClient?.votePoll(post.id, optionId);
      if (updated?.poll) setPoll(updated.poll);
    } catch (error: any) {
      Alert.alert("Could not vote", error?.message || "Please try again.");
    }
  }

  const isMod =
    currentUser?.role === "MODERATOR" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "COMPOUND_MOD";

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => router.push(`/post/${post.id}`)}
      style={styles.card}
    >
      <View style={styles.visual}>
        <View style={styles.visualInner}>
          <Avatar
            name={post.author_name}
            fileUrl={post.author_avatar_url}
            apiClient={apiClient}
            size={72}
          />
          <Text style={styles.visualHint} numberOfLines={2}>
            {post.category === "EVENT"
              ? "Community event"
              : post.category === "HELP"
                ? "Neighbour needs help"
                : post.category === "LOST_FOUND"
                  ? "Lost & found"
                  : "From your compound"}
          </Text>
        </View>
        {post.is_urgent ? (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>Urgent</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <LinkifiedText text={post.content} style={styles.content} />
        <LinkPreviewCard text={post.content} apiClient={apiClient} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {post.category === "LOST_FOUND" ? "Lost & found" : post.category === "POLL" ? "Poll" : (post.category || "General").replace("_", " ")}
          </Text>
        </View>
        {poll ? (
          <View style={styles.poll}>
            <Text style={styles.pollQuestion}>{poll.question || post.content}</Text>
            {poll.options.map((option) => {
              const percent = poll.total_votes ? Math.round((option.votes / poll.total_votes) * 100) : 0;
              return (
                <TouchableOpacity key={option.id} onPress={() => handleVote(option.id)} style={[styles.pollOption, poll.user_vote === option.id && styles.pollOptionSelected]}>
                  <Text style={styles.pollOptionText}>{option.label}</Text>
                  <Text style={styles.pollPercent}>{percent}%</Text>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.pollVotes}>{poll.total_votes} votes</Text>
          </View>
        ) : null}

        <View style={styles.meta}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation?.();
              router.push(`/neighbours/${post.author_id}`);
            }}
            style={styles.authorPress}
          >
            <Avatar
              name={post.author_name}
              fileUrl={post.author_avatar_url}
              apiClient={apiClient}
              size={28}
            />
            <View style={styles.metaText}>
              <Text style={styles.author} numberOfLines={1}>
                {post.author_name}
              </Text>
              <Text style={styles.time}>{timeAgo}</Text>
            </View>
          </TouchableOpacity>
          {isMod ? (
            <TouchableOpacity
              hitSlop={10}
              onPress={() => {
                Alert.alert("Delete post", "Remove this post from the feed?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await apiClient?.deletePost(post.id);
                        onPostDeleted?.(post.id);
                      } catch (error: any) {
                        Alert.alert("Error", error?.message || "Failed to delete");
                      }
                    },
                  },
                ]);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Like"
            onPress={handleLike}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, liked && styles.actionActive]}>
              Like{likeCount > 0 ? ` · ${likeCount}` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Comment"
            onPress={() => router.push(`/post/${post.id}`)}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>
              Comment{commentCount > 0 ? ` · ${commentCount}` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Share"
            onPress={handleShare}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={saved ? "Unsave post" : "Save post"} onPress={handleSave} style={styles.action}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={saved ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[5],
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  visual: {
    height: 180,
    backgroundColor: palette.primarySoft,
    position: "relative",
  },
  visualInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  visualHint: {
    color: palette.primaryHover,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  urgentBadge: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    backgroundColor: colors.error,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
  urgentText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: typography.weight.bold,
  },
  body: {
    padding: spacing[4],
  },
  content: {
    color: colors.textMain,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    marginBottom: spacing[3],
  },
  categoryBadge: { alignSelf: "flex-start", marginBottom: spacing[3], borderRadius: radii.full, backgroundColor: palette.primarySoft, paddingHorizontal: spacing[2], paddingVertical: 4 },
  categoryText: { color: colors.primary, fontSize: typography.size.caption, fontWeight: typography.weight.bold, textTransform: "capitalize" },
  poll: { gap: spacing[2], marginBottom: spacing[3] },
  pollQuestion: { color: colors.textMain, fontSize: typography.size.bodySmall, fontWeight: typography.weight.bold },
  pollOption: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: palette.border, borderRadius: radii.medium, paddingHorizontal: spacing[3] },
  pollOptionSelected: { borderColor: colors.primary, backgroundColor: palette.primarySoft },
  pollOptionText: { color: colors.textMain, flex: 1 },
  pollPercent: { color: colors.textMuted, fontWeight: typography.weight.semibold },
  pollVotes: { color: colors.textMuted, fontSize: typography.size.caption },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  authorPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    minWidth: 0,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  time: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[5],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  action: {
    paddingVertical: spacing[2],
  },
  actionLabel: {
    color: colors.primary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  actionActive: {
    color: palette.primaryHover,
  },
});
