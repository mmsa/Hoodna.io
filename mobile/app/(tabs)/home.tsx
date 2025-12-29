import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Post } from "@hoodna/shared";

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, apiClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadPosts();
  }, [user?.compound_id]);

  async function loadPosts() {
    if (!user?.compound_id) return;

    try {
      const data = await apiClient.getPosts(user.compound_id);
      setPosts(data);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadPosts();
  }

  const canPost = user?.can_post || false;
  const verificationStatus = user?.verification_status || "UNVERIFIED";

  return (
    <View className="flex-1 bg-background">
      {/* Verification Banner */}
      {verificationStatus !== "APPROVED" && (
        <View className={`px-4 py-3 ${
          verificationStatus === "PENDING" ? "bg-accent" : "bg-error/10"
        }`}>
          <Text className={`text-sm font-medium ${
            verificationStatus === "PENDING" ? "text-text-main" : "text-error"
          }`}>
            {verificationStatus === "PENDING"
              ? "Your verification is pending review"
              : "Verify to participate in the community"}
          </Text>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <View className="px-4 py-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-text-main">
                Community Feed
              </Text>
              <TouchableOpacity
                className={`px-4 py-2 rounded-button ${
                  canPost ? "bg-primary" : "bg-gray-300"
                }`}
                onPress={() => {
                  if (canPost) {
                    router.push("/create-post");
                  }
                }}
                disabled={!canPost}
              >
                <Text className="text-white text-sm font-semibold">Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white mx-4 my-2 rounded-card p-4 border border-gray-200">
            <Text className="text-sm font-semibold text-text-main mb-2">
              {item.author_name}
            </Text>
            <Text className="text-base text-text-main mb-3">{item.content}</Text>
            {item.comments.length > 0 && (
              <View className="border-t border-gray-100 pt-3 mt-3">
                <Text className="text-sm text-text-muted mb-2">
                  {item.comments.length} comment{item.comments.length !== 1 ? "s" : ""}
                </Text>
                {item.comments.slice(0, 2).map((comment) => (
                  <View key={comment.id} className="mb-2">
                    <Text className="text-sm font-semibold text-text-main">
                      {comment.author_name}
                    </Text>
                    <Text className="text-sm text-text-muted">{comment.content}</Text>
                  </View>
                ))}
              </View>
            )}
            {canPost && (
              <TouchableOpacity
                className="mt-3 pt-3 border-t border-gray-100"
                onPress={() => router.push(`/post/${item.id}`)}
              >
                <Text className="text-sm text-primary">Comment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted">No posts yet</Text>
          </View>
        }
      />
    </View>
  );
}

