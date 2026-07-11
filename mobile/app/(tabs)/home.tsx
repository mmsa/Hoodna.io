import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView, TextInput, Alert, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { Post } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { formatCompoundName } from "@/utils/formatCompound";

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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: selected ? colors.primary : colors.gray100,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: selected ? "600" : "500",
          color: selected ? "#FFFFFF" : colors.textMain,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "#8B5CF6", // purple
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#EC4899", // pink
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Category mapping for display
const CATEGORY_INFO: Record<string, { icon: string; color: string; label: string; type: string }> = {
  GENERAL: { icon: "💬", color: "#6B7280", label: "General", type: "general" },
  HELP: { icon: "🆘", color: "#F59E0B", label: "Help", type: "help" },
  LOST_FOUND: { icon: "🔍", color: "#EC4899", label: "Lost & Found", type: "lost" },
  EVENT: { icon: "📅", color: "#6366F1", label: "Event", type: "event" },
  MARKETPLACE: { icon: "🛒", color: "#10B981", label: "Marketplace", type: "marketplace" },
  ANNOUNCEMENT: { icon: "🔔", color: "#F59E0B", label: "Announcement", type: "general" },
  ALERT: { icon: "⚠️", color: "#EF4444", label: "Alert", type: "general" },
  DISCUSSION: { icon: "💭", color: "#8B5CF6", label: "Discussion", type: "general" },
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
  const avatarColor = getAvatarColor(post.author_name);
  const initials = getInitials(post.author_name);
  const postType = getPostType(post);

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
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: isHighlighted ? 2 : 1,
        borderLeftWidth: 5,
        borderLeftColor: postType.color,
        borderColor: isHighlighted ? colors.purple : colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* "Just now" or "Hot discussion" badge */}
      {isNew && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              backgroundColor: "#D1FAE5",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
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
                backgroundColor: "#10B981",
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#065F46" }}>
              Just now
            </Text>
          </View>
        </View>
      )}
      {hasManyComments && !isNew && (
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              backgroundColor: "#DBEAFE",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 12 }}>💬</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: "#1E40AF" }}>
              Hot discussion ({post.comments.length} comments)
            </Text>
          </View>
        </View>
      )}

      {/* Header: Avatar + Name + Time */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
        <View style={{ position: "relative" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: avatarColor,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#F3F4F6",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>
              {initials}
            </Text>
          </View>
          {isNew && (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#EF4444",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {/* Compound Name - Prominently displayed */}
          {post.compound_name && (
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="home" size={12} color={colors.textMuted} />
                <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textMuted }}>
                  {formatCompoundName(post.compound_name)}
                </Text>
              </View>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", flex: 1 }}>
              <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
                  {post.author_name}
                </Text>
              </TouchableOpacity>
              {/* Verified Resident Badge */}
              {post.author_status === "APPROVED" && (
                <View
                  style={{
                    backgroundColor: "#D1FAE5",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={12} color="#065F46" />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#065F46" }}>
                    Verified
                  </Text>
                </View>
              )}
              {/* Category Badge - Always show */}
              <View
                style={{
                  backgroundColor: `${postType.color}15`,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  marginLeft: 8,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "600", color: postType.color }}>
                  {postType.icon} {postType.label}
                </Text>
              </View>
              {/* Urgent Badge */}
              {post.is_urgent && (
                <View
                  style={{
                    backgroundColor: "#FEE2E2",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Ionicons name="alert-circle" size={12} color="#DC2626" />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#DC2626" }}>
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>🕐 {timeAgo}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <Text
        style={{
          fontSize: 15,
          color: "#1F2937",
          lineHeight: 22,
          marginBottom: 12,
        }}
      >
        {post.content}
      </Text>

      {/* Reactions and Actions */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: 12,
          marginBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        {/* Reaction buttons */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>❤️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>😮</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>🙏</Text>
          </TouchableOpacity>
        </View>

        {/* Comment button */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginLeft: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
          onPress={() => router.push(`/post/${post.id}`)}
        >
          <Text style={{ fontSize: 14 }}>💬</Text>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>
            {post.comments?.length || 0}
          </Text>
        </TouchableOpacity>

        {/* Share button */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginLeft: "auto",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>📤</Text>
          <Text style={{ fontSize: 13, color: "#6B7280" }}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Section */}
      {post.comments && post.comments.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
            {post.comments.map((comment) => {
              const commentAvatarColor = getAvatarColor(comment.author_name);
              const commentInitials = getInitials(comment.author_name);
              return (
                <View
                  key={comment.id}
                  style={{
                    paddingLeft: 12,
                    borderLeftWidth: 2,
                    borderLeftColor: "#C084FC",
                    backgroundColor: "#F3E8FF",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: commentAvatarColor,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                        borderWidth: 1,
                        borderColor: "#E9D5FF",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
                        {commentInitials}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827" }}>
                        {comment.author_name}
                      </Text>
                      {/* Verified Resident Badge for Comments */}
                      {comment.author_status === "APPROVED" && (
                        <View
                          style={{
                            backgroundColor: "#D1FAE5",
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                            borderRadius: 3,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={10} color="#065F46" />
                          <Text style={{ fontSize: 9, fontWeight: "600", color: "#065F46" }}>
                            Verified
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                      {formatTimeAgo(comment.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#374151", marginLeft: 36, lineHeight: 18 }}>
                    {comment.content}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Inline Comment Input */}
      {canPost && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: "#F9FAFB",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              color: "#1B1B1B",
            }}
            placeholder="Write a comment..."
            placeholderTextColor="#9CA3AF"
            value={newComments[post.id] || ""}
            onChangeText={(text) =>
              setNewComments({ ...newComments, [post.id]: text })
            }
            multiline
          />
          <TouchableOpacity
            style={{
              backgroundColor: "#8B5CF6",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              justifyContent: "center",
            }}
            onPress={() => handleCreateComment(post.id)}
            disabled={submitting || !newComments[post.id]?.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 16 }}>📤</Text>
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

  // Load compound name
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER") return;

    async function loadCompoundName() {
      const compoundId = activeCompoundId || user?.compound_id;
      if (!compoundId || !apiClient) return;
      
      try {
        const userCompounds = await apiClient.getUserCompounds();
        const foundCompound = userCompounds.find((c) => c.id === compoundId);
        if (foundCompound) {
          setCompoundName(foundCompound.name);
        }
      } catch (error) {
        console.error("Failed to load compound name:", error);
      }
    }
    
    if (activeCompoundId || user?.compound_id) {
      loadCompoundName();
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
            Loading your community... ✨
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary, colors.purple]} />}
        ListHeaderComponent={
          <View>
            {/* Header with Logo */}
            <Header
              showLogo={true}
              rightAction={{
                label: "+ Post",
                onPress: () => {
                  if (canPost) {
                    router.push("/create-post");
                  }
                },
                disabled: !canPost,
              }}
            />
            
            {/* ALERTS SECTION - Urgent Posts */}
            {(() => {
              const urgentPosts = posts.filter((p) => p.is_urgent === true);
              if (urgentPosts.length === 0) return null;
              
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 20,
                    paddingBottom: 16,
                    backgroundColor: "#FEF2F2",
                    borderBottomWidth: 2,
                    borderBottomColor: "#FCA5A5",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#EF4444",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#991B1B" }}>
                        ⚠️ Urgent Alerts
                      </Text>
                      <Text style={{ fontSize: 12, color: "#DC2626" }}>
                        Time-sensitive updates requiring immediate attention
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
            
            {/* Compound Announcements Section */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 16,
                backgroundColor: "#FFFFFF",
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#F59E0B",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
                    {compoundName ? `${formatCompoundName(compoundName)} Official Announcement${announcements.length !== 1 ? 's' : ''}` : 'Neighbourhood Announcements'}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>
                    Official updates from neighbourhood management
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
                    backgroundColor: "#FEF3C7",
                    borderRadius: 12,
                    padding: 20,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#FDE68A",
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "#FEF3C7",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontSize: 32 }}>🔔</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 4 }}>
                    No announcements
                  </Text>
                  <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>
                    Check back later for updates from neighbourhood management
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
                    paddingHorizontal: 16,
                    paddingTop: 20,
                    paddingBottom: 12,
                    backgroundColor: "#F9FAFB",
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: "#8B5CF6",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                        Community Discussions
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>
                        Posts from your neighbors, organized by category
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
                contentContainerStyle={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                {POST_LABELS.map((label) => {
                  const selected = selectedLabel === label.value;
                  return (
                    <TouchableOpacity
                      key={label.value}
                      onPress={() => setSelectedLabel(label.value)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderBottomWidth: 2,
                        borderBottomColor: selected ? colors.primary : "transparent",
                        marginBottom: -1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: selected ? "700" : "500",
                          color: selected ? colors.primary : colors.textMuted,
                        }}
                      >
                        {label.label}
                      </Text>
                    </TouchableOpacity>
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
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: colors.purpleLight + "20",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 64 }}>📭</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain, marginBottom: 8, textAlign: "center" }}>
              {selectedLabel ? `No ${POST_LABELS.find((l) => l.value === selectedLabel)?.label.toLowerCase()} posts yet` : "Your feed is waiting! 🎉"}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 4, textAlign: "center", lineHeight: 22 }}>
              {selectedLabel 
                ? "Try a different filter or be the first to post! ✨" 
                : "Share something awesome with your community! Your neighbors are waiting to connect. 💫"}
            </Text>
            {!selectedLabel && canPost && (
              <TouchableOpacity
                style={{
                  marginTop: 24,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                onPress={() => router.push("/create-post")}
              >
                <Text style={{ fontSize: 18 }}>✨</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
                  Create Your First Post
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
