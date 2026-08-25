import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Post, Comment } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ReportModal } from "@/components/ReportModal";
import { AppBrandBar } from "@/components/AppBrandBar";
import { LinkifiedText, LinkPreviewCard } from "@/components/link-preview";
import { colors } from "@/constants/colors";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = ["#8B5CF6", "#158074", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "comment" | "user"; id: number; title: string } | null>(null);
  const { apiClient, user } = useAuth();
  const postingEnabled = useFeature("community_posting");
  const { track } = useTelemetry();
  const router = useRouter();

  useEffect(() => {
    loadPost();
  }, [id]);

  async function loadPost() {
    try {
      // Load post with comments
      const posts = await apiClient.getPosts();
      const foundPost = posts.find((p) => p.id === Number(id));
      if (foundPost) {
        setPost(foundPost);
        setComments(foundPost.comments || []);
      }
    } catch (error) {
      console.error("Failed to load post:", error);
      Alert.alert("Error", "Failed to load post");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitComment() {
    if (!postingEnabled) {
      Alert.alert("Comments are paused", "Community posting is temporarily unavailable.");
      return;
    }
    if (!commentText.trim() || !(user?.can_comment ?? user?.can_post)) {
      Alert.alert("Error", "You need to be verified to comment");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiClient.createComment(Number(id), { content: commentText.trim() });
      track("comment_created", { comment_id: created?.id, post_id: Number(id) });
      setCommentText("");
      await loadPost(); // Reload to get new comments
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !post) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#158074" />
      </SafeAreaView>
    );
  }

  const avatarColor = getAvatarColor(post.author_name);
  const initials = getInitials(post.author_name);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top"]}>
      <AppBrandBar compact style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }} />
      {/* Header with Back Button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 16 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Post</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Moderator Actions */}
          {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
            <>
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
                            await apiClient.banUser(post.author_id, "Moderator action");
                            Alert.alert("Success", "User has been banned");
                            router.back();
                          } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to ban user");
                          }
                        },
                      },
                    ]
                  );
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.errorLight,
                  backgroundColor: colors.errorLight + "20",
                }}
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
                            await apiClient.deletePost(post.id);
                            Alert.alert("Success", "Post deleted successfully");
                            router.back();
                          } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete post");
                          }
                        },
                      },
                    ]
                  );
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.errorLight,
                  backgroundColor: colors.errorLight + "20",
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
          {/* Report Button */}
          {post && user && post.author_id !== user.id && (
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FEE2E2",
              }}
            >
              <Ionicons name="flag-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View
            style={{
              backgroundColor: "#FFFFFF",
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/neighbours/${post.author_id}`)}
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: avatarColor,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 4 }}>
                  {post.author_name}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>{formatTimeAgo(post.created_at)}</Text>
              </View>
            </TouchableOpacity>
              {post.author_id !== user?.id ? (
                <TouchableOpacity
                  accessibilityLabel={`Report ${post.author_name}'s profile`}
                  accessibilityRole="button"
                  style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
                  onPress={() => setReportTarget({ type: "user", id: post.author_id, title: post.author_name })}
                >
                  <Ionicons name="person-remove-outline" size={19} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <LinkifiedText
              text={post.content}
              style={{ fontSize: 16, color: "#1F2937", lineHeight: 24 }}
            />
            <LinkPreviewCard text={post.content} apiClient={apiClient} />
          </View>
        }
        renderItem={({ item }) => {
          const commentAvatarColor = getAvatarColor(item.author_name);
          const commentInitials = getInitials(item.author_name);
          return (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                marginHorizontal: 16,
                marginBottom: 12,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: commentAvatarColor,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>{commentInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>{item.author_name}</Text>
                  <Text style={{ fontSize: 11, color: "#6B7280" }}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                {item.author_id !== user?.id ? (
                  <TouchableOpacity
                    accessibilityLabel="Report comment"
                    accessibilityRole="button"
                    style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                    onPress={() => setReportTarget({ type: "comment", id: item.id, title: item.content.slice(0, 50) })}
                  >
                    <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={{ marginLeft: 40 }}>
                <LinkifiedText
                  text={item.content}
                  style={{ fontSize: 14, color: "#4B5563" }}
                />
                <LinkPreviewCard text={item.content} apiClient={apiClient} />
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          (user?.can_comment ?? user?.can_post) && postingEnabled ? (
            <View style={{ padding: 16 }}>
              <TextInput
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  marginBottom: 12,
                  color: "#1B1B1B",
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
                placeholder="Write a comment..."
                placeholderTextColor="#9CA3AF"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={{
                  backgroundColor: "#158074",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
                onPress={handleSubmitComment}
                disabled={submitting || !commentText.trim()}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Post Comment</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center" }}>No comments yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      {post && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedType="post"
          reportedId={post.id}
          reportedTitle={post.content.substring(0, 50) + "..."}
        />
      )}
      {reportTarget ? (
        <ReportModal
          visible
          onClose={() => setReportTarget(null)}
          reportedType={reportTarget.type}
          reportedId={reportTarget.id}
          reportedTitle={reportTarget.title}
        />
      ) : null}
    </SafeAreaView>
  );
}

