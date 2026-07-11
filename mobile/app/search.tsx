import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { formatCompoundName } from "@/utils/formatCompound";
// apiClient is available from useAuth hook

interface SearchResult {
  type: "post" | "listing" | "service";
  id: number;
  title: string;
  content?: string;
  author_name?: string;
  compound_name?: string;
  category?: string;
  price?: number;
  created_at: string;
}

interface SearchResponse {
  query: string;
  posts: SearchResult[];
  listings: SearchResult[];
  services: SearchResult[];
  total_results: number;
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

function SearchResultCard({ result, router }: { result: SearchResult; router: any }) {
  const getTypeIcon = () => {
    switch (result.type) {
      case "post":
        return "chatbubbles";
      case "listing":
        return "storefront";
      case "service":
        return "construct";
      default:
        return "search";
    }
  };

  const getTypeColor = () => {
    switch (result.type) {
      case "post":
        return colors.primary;
      case "listing":
        return colors.purple;
      case "service":
        return colors.accent;
      default:
        return colors.textMuted;
    }
  };

  const getTypeLabel = () => {
    switch (result.type) {
      case "post":
        return "Post";
      case "listing":
        return "Marketplace";
      case "service":
        return "Service";
      default:
        return "Result";
    }
  };

  const getResultUrl = () => {
    switch (result.type) {
      case "post":
        return `/(tabs)/home#post-${result.id}`;
      case "listing":
        return `/listing/${result.id}`;
      case "service":
        return `/listing/${result.id}`;
      default:
        return "/(tabs)/home";
    }
  };

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
      onPress={() => router.push(getResultUrl())}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        {/* Icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: `${getTypeColor()}15`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={getTypeIcon()} size={24} color={getTypeColor()} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <View
              style={{
                backgroundColor: `${getTypeColor()}15`,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: getTypeColor() }}>
                {getTypeLabel()}
              </Text>
            </View>
            {result.category && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {result.category.replace("_", " ")}
              </Text>
            )}
          </View>

          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.textMain,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {result.title}
          </Text>

          {result.content && (
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginBottom: 8,
                lineHeight: 20,
              }}
              numberOfLines={2}
            >
              {result.content}
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {result.author_name && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="person" size={14} color={colors.textMuted} />
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {result.author_name}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {formatTimeAgo(result.created_at)}
                </Text>
              </View>
            </View>

            {result.price && (
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.accent }}>
                {result.price.toLocaleString()} EGP
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, apiClient } = useAuth();
  const [searchQuery, setSearchQuery] = useState((params.q as string) || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [compoundName, setCompoundName] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load compound name
  useEffect(() => {
    async function loadCompoundName() {
      if (!user?.compound_id || !apiClient) return;
      
      try {
        const userCompounds = await apiClient.getUserCompounds();
        const foundCompound = userCompounds.find((c) => c.id === user.compound_id);
        if (foundCompound) {
          setCompoundName(foundCompound.name);
        }
      } catch (error) {
        console.error("Failed to load compound name:", error);
      }
    }
    
    if (user?.compound_id) {
      loadCompoundName();
    }
  }, [user?.compound_id, apiClient]);

  // Perform search
  useEffect(() => {
    async function performSearch() {
      if (!debouncedQuery.trim() || !user?.compound_id || !apiClient) {
        setSearchResults(null);
        return;
      }

      setLoading(true);
      try {
        const response = await apiClient.globalSearch(debouncedQuery.trim());
        setSearchResults(response as SearchResponse);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults(null);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [debouncedQuery, user?.compound_id, apiClient]);

  const allResults: SearchResult[] = [
    ...(searchResults?.posts || []).map((r) => ({ ...r, type: "post" as const })),
    ...(searchResults?.listings || []).map((r) => ({ ...r, type: "listing" as const })),
    ...(searchResults?.services || []).map((r) => ({ ...r, type: "service" as const })),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header title="Search" showLogo={false} showBackButton={true} />

      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Search Input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.backgroundCard,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginTop: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: colors.textMain }}
            placeholder="Search posts, listings, services..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {loading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted }}>
              Searching...
            </Text>
          </View>
        )}

        {!loading && debouncedQuery.trim() && searchResults && (
          <>
            {/* Results Summary */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Found <Text style={{ fontWeight: "700", color: colors.textMain }}>{searchResults.total_results}</Text> result{searchResults.total_results !== 1 ? "s" : ""} for "{debouncedQuery}"
              </Text>
            </View>

            {allResults.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
                <Ionicons name="search-outline" size={64} color={colors.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 16, marginBottom: 8 }}>
                  No results found
                </Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
                  Try different keywords or check your spelling
                </Text>
              </View>
            ) : (
              <FlatList
                data={allResults}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={({ item }) => <SearchResultCard result={item} router={router} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            )}
          </>
        )}

        {!debouncedQuery.trim() && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Ionicons name="search-outline" size={64} color={colors.textMuted} />
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 16, marginBottom: 8 }}>
              Start searching
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 24 }}>
              Search across posts, marketplace items, and services in {compoundName ? formatCompoundName(compoundName) : "your compound"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View
                style={{
                  backgroundColor: `${colors.primary}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Posts</Text>
              </View>
              <View
                style={{
                  backgroundColor: `${colors.purple}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.purple }}>Marketplace</Text>
              </View>
              <View
                style={{
                  backgroundColor: `${colors.accent}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>Services</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

