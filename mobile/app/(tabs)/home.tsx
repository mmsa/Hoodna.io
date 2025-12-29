import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Post } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";

const POST_LABELS = [
  { value: "", label: "All Posts", icon: "📋" },
  { value: "help", label: "Help", icon: "🆘" },
  { value: "lost", label: "Lost & Found", icon: "🔍" },
  { value: "event", label: "Events", icon: "📅" },
  { value: "marketplace", label: "Marketplace", icon: "🛒" },
  { value: "general", label: "General", icon: "💬" },
];

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

function detectPostType(content: string): {
  type: "help" | "lost" | "event" | "marketplace" | "general";
  icon: string;
  color: string;
  badge: string;
} {
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes("lost") ||
    lowerContent.includes("found") ||
    lowerContent.includes("missing")
  ) {
    return {
      type: "lost",
      icon: "🔍",
      color: "#EC4899",
      badge: "LOST & FOUND",
    };
  }

  if (
    lowerContent.includes("help") ||
    lowerContent.includes("need") ||
    lowerContent.includes("urgent") ||
    lowerContent.includes("plumber") ||
    lowerContent.includes("electrician")
  ) {
    return {
      type: "help",
      icon: "🆘",
      color: "#F59E0B",
      badge: "HELP REQUEST",
    };
  }

  if (
    lowerContent.includes("event") ||
    lowerContent.includes("gathering") ||
    lowerContent.includes("meeting") ||
    lowerContent.includes("weekend") ||
    lowerContent.includes("party")
  ) {
    return {
      type: "event",
      icon: "📅",
      color: "#6366F1",
      badge: "COMMUNITY EVENT",
    };
  }

  if (
    lowerContent.includes("sell") ||
    lowerContent.includes("buy") ||
    lowerContent.includes("for sale") ||
    lowerContent.includes("for rent")
  ) {
    return {
      type: "marketplace",
      icon: "🛒",
      color: "#10B981",
      badge: "MARKETPLACE",
    };
  }

  return {
    type: "general",
    icon: "💬",
    color: "#6B7280",
    badge: "",
  };
}

function PostCard({ 
  post, 
  canPost, 
  router,
  newComments,
  setNewComments,
  handleCreateComment,
  submitting,
}: { 
  post: Post; 
  canPost: boolean; 
  router: any;
  newComments: Record<number, string>;
  setNewComments: (comments: Record<number, string>) => void;
  handleCreateComment: (postId: number) => void;
  submitting: boolean;
}) {
  const timeAgo = formatTimeAgo(post.created_at);
  const isNew = new Date().getTime() - new Date(post.created_at).getTime() < 3600000;
  const hasManyComments = post.comments && post.comments.length >= 5;
  const isHighlighted = isNew || hasManyComments;
  const avatarColor = getAvatarColor(post.author_name);
  const initials = getInitials(post.author_name);
  const postType = detectPostType(post.content);

  // Background color based on post type
  const bgColors = {
    help: "#FEF3C7",
    lost: "#FCE7F3",
    event: "#E0E7FF",
    marketplace: "#D1FAE5",
    general: "#FFFFFF",
  };

  return (
    <View
      style={{
        backgroundColor: bgColors[postType.type],
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: isHighlighted ? 2 : 1,
        borderLeftWidth: 4,
        borderLeftColor: postType.color,
        borderColor: isHighlighted ? "#8B5CF6" : "#E5E7EB",
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
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
              {post.author_name}
            </Text>
            {postType.badge && (
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
                  {postType.icon} {postType.badge}
                </Text>
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
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827" }}>
                      {comment.author_name}
                    </Text>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { user, apiClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadPosts();
    loadAnnouncements();
  }, [user?.compound_id]);

  async function loadPosts() {
    if (!user?.compound_id) return;

    try {
      const data = await apiClient.getPosts(user.compound_id);
      setAllPosts(data);
      applyLabelFilter(data);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadAnnouncements() {
    if (!user?.compound_id) return;

    try {
      const data = await apiClient.getAnnouncements(5);
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to load announcements:", error);
    }
  }

  function applyLabelFilter(data: Post[]) {
    if (!selectedLabel) {
      setPosts(data);
      return;
    }

    const filtered = data.filter((post) => {
      const postType = detectPostType(post.content);
      return postType.type === selectedLabel;
    });

    setPosts(filtered);
  }

  useEffect(() => {
    applyLabelFilter(allPosts);
  }, [selectedLabel, allPosts]);

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

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2" }} edges={["top"]}>
      {/* Verification Banner */}
      {verificationStatus !== "APPROVED" && (
        <View
          style={{
            backgroundColor: verificationStatus === "PENDING" ? "#FFB400" : "#FEE2E2",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: verificationStatus === "PENDING" ? "#1F2937" : "#DC2626",
              textAlign: "center",
            }}
          >
            {verificationStatus === "PENDING"
              ? "⏳ Your verification is pending review"
              : "🔒 Verify to participate in the community"}
          </Text>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2D6A4F" />}
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
                    Compound Announcements
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>
                    Official updates from compound management
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
                    Check back later for updates from compound management
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* Label Filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {POST_LABELS.map((label) => (
                    <TouchableOpacity
                      key={label.value}
                      style={{
                        backgroundColor: selectedLabel === label.value ? "#2D6A4F" : "#FFFFFF",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: selectedLabel === label.value ? "#2D6A4F" : "#E5E7EB",
                      }}
                      onPress={() => setSelectedLabel(label.value)}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: selectedLabel === label.value ? "#FFFFFF" : "#111827",
                        }}
                      >
                        {label.icon} {label.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 16, color: "#6B7280", marginBottom: 8 }}>📭</Text>
            <Text style={{ fontSize: 16, color: "#6B7280" }}>
              {selectedLabel ? `No ${POST_LABELS.find((l) => l.value === selectedLabel)?.label.toLowerCase()} posts` : "No posts yet"}
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>
              {selectedLabel ? "Try a different filter" : "Be the first to share something!"}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
