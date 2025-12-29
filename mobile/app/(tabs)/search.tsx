import { useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Post, Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
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

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    ITEM: "📦",
    CAR: "🚗",
    PROPERTY: "🏠",
    SERVICE: "🔧",
  };
  return icons[category] || "📦";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    ITEM: "#3B82F6",
    CAR: "#10B981",
    PROPERTY: "#8B5CF6",
    SERVICE: "#F59E0B",
  };
  return colors[category] || "#6B7280";
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ posts: Post[]; listings: Listing[] }>({
    posts: [],
    listings: [],
  });
  const [loading, setLoading] = useState(false);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults({ posts: [], listings: [] });
      return;
    }

    setLoading(true);
    try {
      const [posts, listings] = await Promise.all([
        apiClient.getPosts(user?.compound_id).catch(() => []),
        apiClient.getListings().catch(() => []),
      ]);

      const query = searchQuery.toLowerCase().trim();
      const filteredPosts = posts.filter(
        (post) =>
          post.content.toLowerCase().includes(query) ||
          post.author_name.toLowerCase().includes(query)
      );
      const filteredListings = listings.filter(
        (listing) =>
          listing.title.toLowerCase().includes(query) ||
          listing.description?.toLowerCase().includes(query) ||
          listing.category?.toLowerCase().includes(query)
      );

      setSearchResults({ posts: filteredPosts, listings: filteredListings });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }

  const hasResults = searchResults.posts.length > 0 || searchResults.listings.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2" }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* Header with Logo */}
        <Header showLogo={true} />
        
        {/* Search Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            backgroundColor: "#FFFFFF",
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
          }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                color: "#1B1B1B",
              }}
              placeholder="Search posts, listings..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={{
                backgroundColor: "#2D6A4F",
                borderRadius: 12,
                paddingHorizontal: 20,
                justifyContent: "center",
              }}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>🔍</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {searchQuery.trim() && (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {!hasResults && !loading && (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
                <Text style={{ fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 4 }}>
                  No results found
                </Text>
                <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
                  Try a different search term
                </Text>
              </View>
            )}

            {searchResults.posts.length > 0 && (
              <View style={{ marginTop: 16, marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#111827",
                    paddingHorizontal: 16,
                    marginBottom: 12,
                  }}
                >
                  Posts ({searchResults.posts.length})
                </Text>
                {searchResults.posts.map((post) => {
                  const avatarColor = getAvatarColor(post.author_name);
                  const initials = getInitials(post.author_name);
                  return (
                    <TouchableOpacity
                      key={post.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        marginHorizontal: 16,
                        marginBottom: 12,
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 1,
                      }}
                      onPress={() => router.push(`/post/${post.id}`)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: avatarColor,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                          }}
                        >
                          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                            {initials}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                            {post.author_name}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#6B7280" }}>
                            {formatTimeAgo(post.created_at)}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{
                          fontSize: 15,
                          color: "#1F2937",
                          lineHeight: 22,
                        }}
                        numberOfLines={3}
                      >
                        {post.content}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {searchResults.listings.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#111827",
                    paddingHorizontal: 16,
                    marginBottom: 12,
                  }}
                >
                  Listings ({searchResults.listings.length})
                </Text>
                {searchResults.listings.map((listing) => {
                  const categoryColor = getCategoryColor(listing.category || "ITEM");
                  const categoryIcon = getCategoryIcon(listing.category || "ITEM");
                  return (
                    <TouchableOpacity
                      key={listing.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        marginHorizontal: 16,
                        marginBottom: 12,
                        borderRadius: 16,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 1,
                      }}
                      onPress={() => router.push(`/listing/${listing.id}`)}
                      activeOpacity={0.8}
                    >
                      {listing.image_urls && listing.image_urls.length > 0 ? (
                        <View style={{ height: 120, backgroundColor: "#F3F4F6" }}>
                          {/* Image would go here */}
                        </View>
                      ) : (
                        <View
                          style={{
                            height: 120,
                            backgroundColor: "#F3F4F6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 36 }}>{categoryIcon}</Text>
                        </View>
                      )}
                      <View style={{ padding: 16 }}>
                        <View
                          style={{
                            backgroundColor: `${categoryColor}15`,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            alignSelf: "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "600", color: categoryColor }}>
                            {categoryIcon} {listing.category}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: "#111827",
                            marginBottom: 4,
                          }}
                          numberOfLines={2}
                        >
                          {listing.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#2D6A4F",
                            marginTop: 4,
                          }}
                        >
                          {listing.price?.toLocaleString()} {listing.currency || "EGP"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {!searchQuery.trim() && (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 64, marginBottom: 24 }}>🔍</Text>
            <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
              Search Community
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#6B7280",
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Find posts, listings, and more in your community
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
