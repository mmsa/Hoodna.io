import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView, TextInput, Alert, Modal, Share, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { Post } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { CompoundHero } from "@/components/feed/compound-hero";
import { FeedComposer } from "@/components/community/feed-composer";
import { Avatar, Button, Chip } from "@/components/ui";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { formatCompoundName } from "@/utils/formatCompound";
import { radii, spacing } from "@hoodna/tokens";

const POST_LABELS = [
  { value: "", label: "All" },
  { value: "help", label: "Help" },
  { value: "lost", label: "Lost" },
  { value: "event", label: "Events" },
  { value: "marketplace", label: "Market" },
  { value: "general", label: "General" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function SheetOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Chip label={label} selected={selected} onPress={onPress} />
  );
}

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

// Category mapping for display (text labels only)
const CATEGORY_INFO: Record<string, { color: string; label: string; type: string }> = {
  GENERAL: { color: colors.textMuted, label: "General", type: "general" },
  HELP: { color: colors.accent, label: "Help", type: "help" },
  LOST_FOUND: { color: colors.error, label: "Lost & Found", type: "lost" },
  EVENT: { color: colors.primary, label: "Event", type: "event" },
  MARKETPLACE: { color: colors.success, label: "Marketplace", type: "marketplace" },
  ANNOUNCEMENT: { color: colors.accent, label: "Announcement", type: "general" },
  ALERT: { color: colors.error, label: "Alert", type: "general" },
  DISCUSSION: { color: colors.primaryDark, label: "Discussion", type: "general" },
};

function getPostType(post: Post) {
  // Use explicit category if available, otherwise fall back to auto-detection
  if (post.category && CATEGORY_INFO[post.category]) {
    return CATEGORY_INFO[post.category];
  }
  
  // Fallback to content-based detection for backward compatibility
  const lowerContent = post.content.toLowerCase();
  if (lowerContent.includes("lost") || lowerContent.includes("found") || lowerContent.includes("missing")) {
    return CATEGORY_INFO.LOST_FOUND;
  }
  if (lowerContent.includes("help") || lowerContent.includes("need") || lowerContent.includes("urgent")) {
    return CATEGORY_INFO.HELP;
  }
  if (lowerContent.includes("event") || lowerContent.includes("gathering") || lowerContent.includes("meeting")) {
    return CATEGORY_INFO.EVENT;
  }
  if (lowerContent.includes("sell") || lowerContent.includes("buy") || lowerContent.includes("for sale")) {
    return CATEGORY_INFO.MARKETPLACE;
  }
  
  return CATEGORY_INFO.GENERAL;
}

function PostCard({ 
  post, 
  canPost, 
  router,
  newComments,
  setNewComments,
  handleCreateComment,
  submitting,
  currentUser,
  apiClient,
  onPostDeleted,
}: { 
  post: Post; 
  canPost: boolean; 
  router: any;
  newComments: Record<number, string>;
  setNewComments: (comments: Record<number, string>) => void;
  handleCreateComment: (postId: number) => void;
  submitting: boolean;
  currentUser?: any;
  apiClient?: any;
  onPostDeleted?: (postId: number) => void;
}) {
  const timeAgo = formatTimeAgo(post.created_at);
  const isNew = new Date().getTime() - new Date(post.created_at).getTime() < 3600000;
  const hasManyComments = post.comments && post.comments.length >= 5;
  const isHighlighted = isNew || hasManyComments || post.is_urgent;
  const postType = getPostType(post);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(
    post.reaction_counts ?? {},
  );
  const [userReaction, setUserReaction] = useState<string | null>(
    post.user_reaction ?? null,
  );

  async function handleShare() {
    try {
      await Share.share({
        title: `${post.author_name} on eljiran.com`,
        message: `${post.content}\n\nhttps://eljiran.vercel.app/feed#post-${post.id}`,
        url: `https://eljiran.vercel.app/feed#post-${post.id}`,
      });
    } catch {
      Alert.alert("Could not share", "Please try again.");
    }
  }

  async function handleReaction(reaction: "LOVE" | "LIKE" | "WOW" | "PRAY") {
    try {
      const result = await apiClient?.reactToPost(post.id, reaction);
      if (result) {
        setReactionCounts(result.reaction_counts);
        setUserReaction(result.user_reaction);
      }
    } catch (error: any) {
      Alert.alert("Could not react", error?.message || "Please try again.");
    }
  }

  // Background color based on post type (using new vibrant colors)
  const bgColors: Record<string, string> = {
    help: colors.help,
    lost: colors.lost,
    event: colors.event,
    marketplace: colors.marketplace,
    general: colors.backgroundCard,
  };

  return (
    <View
      style={{
        backgroundColor: bgColors[postType.type] || colors.backgroundCard,
        marginHorizontal: spacing[4],
        marginBottom: spacing[4],
        borderRadius: radii.large,
        padding: spacing[4],
        borderWidth: 1,
        borderLeftWidth: 4,
        borderLeftColor: postType.color,
        borderColor: isHighlighted ? colors.primary : colors.border,
        shadowColor: colors.textMain,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {isNew && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[2] }}>
          <View
            style={{
              backgroundColor: colors.successLight,
              paddingHorizontal: spacing[2],
              paddingVertical: 4,
              borderRadius: radii.full,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.primary,
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primaryDark }}>
              Just now
            </Text>
          </View>
        </View>
      )}
      {hasManyComments && !isNew && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[2] }}>
          <View
            style={{
              backgroundColor: colors.primaryLight,
              paddingHorizontal: spacing[2],
              paddingVertical: 4,
              borderRadius: radii.full,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Ionicons name="chatbubbles-outline" size={12} color={colors.primaryDark} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.primaryDark }}>
              Active discussion ({post.comments.length} comments)
            </Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: spacing[3] }}>
        <View style={{ position: "relative" }}>
          <Avatar name={post.author_name} size={48} />
          {isNew && (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.error,
                borderWidth: 2,
                borderColor: colors.backgroundWhite,
              }}
            />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          {post.compound_name && (
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="home-outline" size={12} color={colors.textMuted} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textMuted }}>
                  {formatCompoundName(post.compound_name)}
                </Text>
              </View>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", flex: 1 }}>
              <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textMain }}>
                  {post.author_name}
                </Text>
              </TouchableOpacity>
              {post.author_status === "APPROVED" && (
                <View
                  style={{
                    backgroundColor: colors.successLight,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radii.small,
                    marginLeft: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={12} color={colors.primaryDark} />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.primaryDark }}>
                    Verified
                  </Text>
                </View>
              )}
              <View
                style={{
                  backgroundColor: colors.gray100,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 3,
                  borderRadius: radii.small,
                  marginLeft: spacing[2],
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "600", color: postType.color }}>
                  {postType.label}
                </Text>
              </View>
              {post.is_urgent && (
                <View
                  style={{
                    backgroundColor: colors.errorLight,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: radii.small,
                    marginLeft: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Ionicons name="alert-circle" size={12} color={colors.error} />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: colors.error }}>
                    Urgent
                  </Text>
                </View>
              )}
            </View>
            {/* Moderator Actions */}
            {currentUser && (currentUser.role === "MODERATOR" || currentUser.role === "ADMIN") && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      "Ban User",
                      `Are you sure you want to ban ${post.author_name}?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Ban",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiClient?.banUser(post.author_id, "Moderator action");
                              Alert.alert("Success", "User has been banned");
                            } catch (error: any) {
                              Alert.alert("Error", error.message || "Failed to ban user");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="ban-outline" size={18} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      "Delete Post",
                      "Are you sure you want to delete this post?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiClient?.deletePost(post.id);
                              Alert.alert("Success", "Post deleted successfully");
                              onPostDeleted?.(post.id);
                            } catch (error: any) {
                              Alert.alert("Error", error.message || "Failed to delete post");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{timeAgo}</Text>
          </View>
        </View>
      </View>

      <Text
        style={{
          fontSize: 15,
          color: colors.textMain,
          lineHeight: 22,
          marginBottom: spacing[3],
        }}
      >
        {post.content}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: spacing[3],
          marginBottom: spacing[3],
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        {/* Reaction buttons */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {([
            ["LOVE", "❤️"],
            ["LIKE", "👍"],
            ["WOW", "😮"],
            ["PRAY", "🙏"],
          ] as const).map(([reaction, emoji]) => {
            const selected = userReaction === reaction;
            const count = reactionCounts[reaction] ?? 0;
            return (
              <TouchableOpacity
                key={reaction}
                onPress={() => handleReaction(reaction)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${reaction.toLowerCase()}`}
                accessibilityState={{ selected }}
                style={{
                  minWidth: 32,
                  height: 32,
                  paddingHorizontal: 5,
                  borderRadius: radii.full,
                  flexDirection: "row",
                  gap: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.primaryLight : "transparent",
                  borderWidth: selected ? 1 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted }}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Comment button */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginLeft: spacing[2],
            paddingHorizontal: spacing[2],
            paddingVertical: 4,
            borderRadius: radii.small,
          }}
          onPress={() => router.push(`/post/${post.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            {post.comments?.length || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginLeft: "auto",
            paddingHorizontal: spacing[2],
            paddingVertical: 4,
            borderRadius: radii.small,
          }}
        >
          <Ionicons name="share-outline" size={16} color={colors.textMuted} />
          <Text style={{ fontSize: 13, color: colors.textMuted }}>Share</Text>
        </TouchableOpacity>
      </View>

      {post.comments && post.comments.length > 0 && (
        <View style={{ marginBottom: spacing[3] }}>
          <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
            {post.comments.map((comment) => (
                <View
                  key={comment.id}
                  style={{
                    paddingLeft: spacing[3],
                    borderLeftWidth: 2,
                    borderLeftColor: colors.primary,
                    backgroundColor: colors.primaryLight,
                    borderRadius: radii.medium,
                    padding: 10,
                    marginBottom: spacing[2],
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Avatar name={comment.author_name} size={28} style={{ marginRight: spacing[2] }} />
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMain }}>
                        {comment.author_name}
                      </Text>
                      {comment.author_status === "APPROVED" && (
                        <View
                          style={{
                            backgroundColor: colors.successLight,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                            borderRadius: radii.small,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={10} color={colors.primaryDark} />
                          <Text style={{ fontSize: 9, fontWeight: "600", color: colors.primaryDark }}>
                            Verified
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: spacing[2] }}>
                      {formatTimeAgo(comment.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textMain, marginLeft: 36, lineHeight: 18 }}>
                    {comment.content}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {canPost && (
        <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[2] }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: colors.gray100,
              borderRadius: radii.medium,
              paddingHorizontal: spacing[3],
              paddingVertical: 10,
              fontSize: 14,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textMain,
            }}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={newComments[post.id] || ""}
            onChangeText={(text) =>
              setNewComments({ ...newComments, [post.id]: text })
            }
            multiline
          />
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: radii.medium,
              paddingHorizontal: spacing[4],
              paddingVertical: 10,
              justifyContent: "center",
              opacity: submitting || !newComments[post.id]?.trim() ? 0.5 : 1,
            }}
            onPress={() => handleCreateComment(post.id)}
            disabled={submitting || !newComments[post.id]?.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.backgroundWhite} />
            ) : (
              <Ionicons name="send" size={18} color={colors.backgroundWhite} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [compoundName, setCompoundName] = useState<string | null>(null);
  const [compoundArea, setCompoundArea] = useState<string | null>(null);
  const [compoundHeroUrl, setCompoundHeroUrl] = useState<string | null>(null);
  const [communityStats, setCommunityStats] = useState({
    neighbours: 0,
    posts: 0,
    listings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { user, apiClient } = useAuth();
  const { activeCompoundId } = useCompound();
  const router = useRouter();

  // Load compound feed context (name + hero banner)
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER") return;

    async function loadFeedSummary() {
      if (!apiClient) return;
      try {
        const summary = await apiClient.getFeedSummary();
        setCompoundName(summary.compound_name);
        setCompoundArea(summary.compound_area);
        setCompoundHeroUrl(summary.compound_hero_image_url ?? null);
        setCommunityStats({
          neighbours: summary.total_neighbors,
          posts: summary.recent_posts_count,
          listings: summary.recent_listings_count,
        });
      } catch (error) {
        console.error("Failed to load feed summary:", error);
      }
    }

    if (activeCompoundId || user?.compound_id) {
      loadFeedSummary();
    }
  }, [activeCompoundId, user?.compound_id, user?.role, apiClient]);

  // Refetch posts when compound changes
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER") {
      setLoading(false);
      return;
    }
    if (activeCompoundId) {
      loadPosts();
      loadAnnouncements();
    }
  }, [activeCompoundId, user?.role]);

  // Organize posts into sections: Alerts, Announcements, Discussions
  const organizePosts = (allPosts: Post[], announcements: Post[]) => {
    // Alerts: urgent posts (is_urgent = true)
    const alerts = allPosts.filter((p) => p.is_urgent === true);
    
    // Regular posts (excluding announcements and alerts)
    const regularPosts = allPosts.filter(
      (p) => !announcements.some((a) => a.id === p.id) && !p.is_urgent
    );
    
    // Group regular posts by category
    const postsByCategory: Record<string, Post[]> = {};
    regularPosts.forEach((post) => {
      const category = post.category || "GENERAL";
      if (!postsByCategory[category]) {
        postsByCategory[category] = [];
      }
      postsByCategory[category].push(post);
    });
    
    return { alerts, announcements, postsByCategory };
  };

  async function loadPosts() {
    // Use activeCompoundId from context (single source of truth)
    const compoundId = activeCompoundId || user?.compound_id;
    
    if (!compoundId) {
      setLoading(false);
      setRefreshing(false);
      setAllPosts([]);
      return;
    }

    try {
      const data = await apiClient.getPosts(compoundId);
      setAllPosts(data || []);
      // Filtering is handled by useMemo hook below
    } catch (error: any) {
      console.error("Failed to load posts:", error);
      // Set empty array on error to prevent stale data
      setAllPosts([]);
      // Don't show alert here - let the empty state handle it
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadAnnouncements() {
    // Use activeCompoundId from context (single source of truth)
    const compoundId = activeCompoundId || user?.compound_id;
    
    if (!compoundId) {
      setAnnouncements([]);
      return;
    }

    try {
      const data = await apiClient.getAnnouncements(5);
      setAnnouncements(data || []);
    } catch (error: any) {
      console.error("Failed to load announcements:", error);
      setAnnouncements([]);
    }
  }

  function applyFilters(data: Post[]) {
    let filtered = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (post) =>
          post.content.toLowerCase().includes(query) ||
          post.author_name.toLowerCase().includes(query) ||
          (post.comments && post.comments.some((c) => c.content.toLowerCase().includes(query)))
      );
    }

    // Apply label filter
    if (selectedLabel) {
      filtered = filtered.filter((post) => {
        const postType = getPostType(post);
        return postType.type === selectedLabel;
      });
    }

    if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setPosts(filtered);
  }

  useEffect(() => {
    applyFilters(allPosts);
  }, [selectedLabel, searchQuery, allPosts, sortBy]);

  function clearFilters() {
    setSearchQuery("");
    setSelectedLabel("");
    setSortBy("newest");
  }

  const sheetFilterCount = sortBy !== "newest" ? 1 : 0;

  async function handleCreateComment(postId: number) {
    const content = newComments[postId];
    if (!content?.trim() || !user?.can_post) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createComment(postId, { content: content.trim() });
      setNewComments({ ...newComments, [postId]: "" });
      await loadPosts(); // Reload to get new comments
    } catch (error: any) {
      console.error("Failed to post comment:", error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadPosts();
    loadAnnouncements();
  }

  const canPost = user?.can_post || false;
  const verificationStatus = user?.verification_status || "UNVERIFIED";

  // Block SERVICE_PROVIDER users from accessing the feed
  if (user && user.role === "SERVICE_PROVIDER") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            backgroundColor: "#FEF3C7", 
            justifyContent: "center", 
            alignItems: "center",
            marginBottom: 24
          }}>
            <Text style={{ fontSize: 64 }}>🚫</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 12, textAlign: "center" }}>
            Access Restricted
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 32, textAlign: "center", lineHeight: 24 }}>
            Service providers are not allowed to browse the community feed. Please manage your services from the Services page.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => router.push("/(tabs)/services")}
          >
            <Ionicons name="construct-outline" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Go to My Services
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Doc-level rejection — send to status page where user can re-upload
  if (verificationStatus === "REJECTED") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.errorLight + "30",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 64 }}>📋</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
            Verification needs attention
          </Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
            One or more documents were not approved. Re-upload them to continue.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => router.replace("/verification-pending")}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Review & re-upload
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state
  if (loading && posts.length === 0 && allPosts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading your community...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state if no compound selected
  if (!activeCompoundId && !user?.compound_id && !loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.primaryLight + "30",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 64 }}>🏠</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
            Select Your Neighbourhood
          </Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
            To see posts from your community, please select a neighbourhood first.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => router.push("/onboarding/compound-select")}
          >
            <Ionicons name="home" size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Select Neighbourhood
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Verification Banner - More Engaging */}
      {verificationStatus !== "APPROVED" && (
        <View
          style={{
            backgroundColor: verificationStatus === "PENDING" ? colors.accent : colors.errorLight,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 2,
            borderBottomColor: verificationStatus === "PENDING" ? colors.accentLight : colors.error,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Text style={{ fontSize: 20 }}>
              {verificationStatus === "PENDING" ? "⏳" : "🔒"}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: verificationStatus === "PENDING" ? colors.textMain : "#FFFFFF",
                textAlign: "center",
              }}
            >
              {verificationStatus === "PENDING"
                ? "Your verification is being reviewed - hang tight! ✨"
                : "Verify your account to unlock all features 🚀"}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={posts.filter((p) => !p.is_urgent && !announcements.some((a) => a.id === p.id))} // Filter out urgent (shown in Alerts) and announcements
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View>
            <Header showLogo={true} />

            {compoundName ? (
              <CompoundHero
                apiClient={apiClient}
                compoundArea={compoundArea}
                compoundName={compoundName}
                heroImageUrl={compoundHeroUrl}
                totalNeighbors={communityStats.neighbours}
                recentPosts={communityStats.posts}
                recentListings={communityStats.listings}
              />
            ) : null}

            <FeedComposer
              name={user?.name || "Neighbor"}
              disabled={!canPost}
              onPress={() => {
                if (canPost) {
                  router.push("/create-post");
                }
              }}
            />
            
            {(() => {
              const urgentPosts = posts.filter((p) => p.is_urgent === true);
              if (urgentPosts.length === 0) return null;
              
              return (
                <View
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingTop: spacing[5],
                    paddingBottom: spacing[4],
                    backgroundColor: colors.errorLight,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.error,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="alert-circle" size={22} color={colors.backgroundWhite} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}>
                        Urgent alerts
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        Important updates from your neighbours
                      </Text>
                    </View>
                  </View>
                  
                  {urgentPosts.map((alert) => (
                    <PostCard
                      key={alert.id}
                      post={alert}
                      canPost={canPost}
                      router={router}
                      newComments={newComments}
                      setNewComments={setNewComments}
                      handleCreateComment={handleCreateComment}
                      submitting={submitting}
                      currentUser={user}
                      apiClient={apiClient}
                      onPostDeleted={(postId) => {
                        setPosts(posts.filter((p) => p.id !== postId));
                      }}
                    />
                  ))}
                </View>
              );
            })()}
            
            <View
              style={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[5],
                paddingBottom: spacing[4],
                backgroundColor: colors.backgroundWhite,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.accentLight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="megaphone-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain }}>
                    {compoundName ? `${formatCompoundName(compoundName)} announcements` : "Neighbourhood announcements"}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    Official updates from your compound
                  </Text>
                </View>
              </View>

              {announcements.length > 0 ? (
                announcements.map((announcement) => (
                  <PostCard
                    key={announcement.id}
                    post={announcement}
                    canPost={canPost}
                    router={router}
                    newComments={newComments}
                    setNewComments={setNewComments}
                    handleCreateComment={handleCreateComment}
                    submitting={submitting}
                  />
                ))
              ) : (
                <View
                  style={{
                    backgroundColor: colors.gray100,
                    borderRadius: radii.medium,
                    padding: spacing[5],
                    alignItems: "center",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.accentLight,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: spacing[3],
                    }}
                  >
                    <Ionicons name="megaphone-outline" size={24} color={colors.accent} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textMain, marginBottom: 4 }}>
                    Nothing new for now
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 }}>
                    When management posts an update, it will show up here first.
                  </Text>
                </View>
              )}
            </View>

            {/* Discussions Section Header */}
            {(() => {
              const regularPosts = posts.filter((p) => !p.is_urgent && !announcements.some((a) => a.id === p.id));
              if (regularPosts.length === 0) return null;
              
              return (
                <View
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingTop: spacing[5],
                    paddingBottom: spacing[3],
                    backgroundColor: colors.background,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: colors.primaryLight,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}>
                        Community discussions
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        Posts from your neighbours, by topic
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
                backgroundColor: colors.background,
              }}
            >
              {/* Search + filter */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.backgroundWhite,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 12,
                  }}
                >
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={{
                      flex: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 11,
                      fontSize: 15,
                      color: colors.textMain,
                    }}
                    placeholder="Search posts..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                  />
                  {searchQuery.trim() ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => setShowFilters(true)}
                  activeOpacity={0.7}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: sheetFilterCount > 0 ? colors.primary : colors.backgroundWhite,
                    borderWidth: 1,
                    borderColor: sheetFilterCount > 0 ? colors.primary : colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="options-outline"
                    size={20}
                    color={sheetFilterCount > 0 ? "#FFFFFF" : colors.textMain}
                  />
                  {sheetFilterCount > 0 ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: colors.accent,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>
                        {sheetFilterCount}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>

              {/* Category tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[2], paddingBottom: spacing[2] }}
              >
                {POST_LABELS.map((label) => {
                  const selected = selectedLabel === label.value;
                  return (
                    <Chip
                      key={label.value}
                      label={label.label}
                      selected={selected}
                      onPress={() => setSelectedLabel(label.value)}
                    />
                  );
                })}
              </ScrollView>

              {sheetFilterCount > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  </Text>
                  <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Filters sheet */}
              <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}>
                  <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilters(false)} />
                  <View
                    style={{
                      backgroundColor: colors.backgroundWhite,
                      borderTopLeftRadius: 24,
                      borderTopRightRadius: 24,
                      paddingHorizontal: 20,
                      paddingTop: 12,
                      paddingBottom: 28,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: colors.gray300,
                        alignSelf: "center",
                        marginBottom: 16,
                      }}
                    />

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}>Filter & sort</Text>
                      <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>Reset</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Category
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                      {POST_LABELS.map((label) => (
                        <SheetOption
                          key={label.value || "all"}
                          label={label.value === "" ? "All posts" : label.label}
                          selected={selectedLabel === label.value}
                          onPress={() => setSelectedLabel(label.value)}
                        />
                      ))}
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Sort by
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                      {SORT_OPTIONS.map((opt) => (
                        <SheetOption
                          key={opt.value}
                          label={opt.label}
                          selected={sortBy === opt.value}
                          onPress={() => setSortBy(opt.value)}
                        />
                      ))}
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 14,
                        paddingVertical: 15,
                        alignItems: "center",
                      }}
                      onPress={() => setShowFilters(false)}
                      activeOpacity={0.85}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Show results</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canPost={canPost}
            router={router}
            newComments={newComments}
            setNewComments={setNewComments}
            handleCreateComment={handleCreateComment}
            submitting={submitting}
            currentUser={user}
            apiClient={apiClient}
            onPostDeleted={(postId) => {
              setPosts(posts.filter((p) => p.id !== postId));
            }}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 32 }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.primaryLight,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing[6],
              }}
            >
              <Ionicons name="chatbubbles-outline" size={40} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain, marginBottom: spacing[2], textAlign: "center" }}>
              {selectedLabel
                ? `No ${POST_LABELS.find((l) => l.value === selectedLabel)?.label.toLowerCase()} posts yet`
                : "Your feed is quiet for now"}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: "center", lineHeight: 22 }}>
              {selectedLabel
                ? "Try another filter, or be the first to share something with your neighbours."
                : "Say hello to your neighbours — share a question, update, or recommendation."}
            </Text>
            {!selectedLabel && canPost && (
              <Button
                size="medium"
                style={{ marginTop: spacing[6], alignSelf: "stretch" }}
                onPress={() => router.push("/create-post")}
              >
                Start a post
              </Button>
            )}
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 20 }}
      />
      {canPost ? (
        <TouchableOpacity
          accessibilityLabel="Create a post"
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => router.push("/create-post")}
          style={{
            position: "absolute",
            right: spacing[5],
            bottom: spacing[5],
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
            shadowColor: colors.textMain,
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.22,
            shadowRadius: 10,
            elevation: 7,
          }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}
