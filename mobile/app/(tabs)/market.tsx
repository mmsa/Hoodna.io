import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator, TextInput, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";

const CATEGORIES = [
  { value: "", label: "All Categories", icon: "🛒" },
  { value: "PROPERTY", label: "Property", icon: "🏠" },
  { value: "CAR", label: "Cars", icon: "🚗" },
  { value: "ITEM", label: "Items", icon: "📦" },
  // SERVICE removed - now has dedicated Services tab
];

const INTENTS = [
  { value: "", label: "All Types" },
  { value: "SELL", label: "For Sale" },
  { value: "RENT", label: "For Rent" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

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
  const categoryColors: Record<string, string> = {
    ITEM: colors.primary,
    CAR: colors.success,
    PROPERTY: colors.purple,
    SERVICE: colors.accent,
  };
  return categoryColors[category] || colors.textMuted;
}

function ListingCard({ listing, router }: { listing: Listing; router: any }) {
  const categoryColor = getCategoryColor(listing.category || "ITEM");
  const categoryIcon = getCategoryIcon(listing.category || "ITEM");

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
      activeOpacity={0.8}
      onPress={() => router.push(`/listing/${listing.id}`)}
      activeOpacity={0.9}
    >
      {listing.image_urls && listing.image_urls.length > 0 ? (
        <Image
          source={{ uri: listing.image_urls[0] }}
          style={{ width: "100%", height: 140 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 140,
            backgroundColor: "#F3F4F6",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 36 }}>{categoryIcon}</Text>
        </View>
      )}

      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <View
            style={{
              backgroundColor: `${categoryColor}15`,
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "600", color: categoryColor }}>
              {categoryIcon} {listing.category}
            </Text>
          </View>
          {listing.intent && (
            <View
              style={{
                backgroundColor: listing.intent === "SELL" ? "#EF4444" : "#3B82F6",
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "600", color: "#FFFFFF" }}>
                {listing.intent === "SELL" ? "Sale" : "Rent"}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#111827",
            marginBottom: 4,
            lineHeight: 18,
          }}
          numberOfLines={2}
        >
          {listing.title}
        </Text>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: "#3B82F6",
            marginTop: 4,
          }}
        >
          {listing.price?.toLocaleString()} {listing.currency || "EGP"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedIntent, setSelectedIntent] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { user, apiClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadListings();
  }, [user?.compound_id, searchQuery, selectedCategory, selectedIntent, sortBy, minPrice, maxPrice]);

  async function loadListings() {
    try {
      const params: any = { scope: "compound" };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (selectedIntent) params.intent = selectedIntent;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      params.sort_by = sortBy;

      const data = await apiClient.getListings(params);
      // Filter out SERVICES - they have their own tab now
      const filteredData = (data || []).filter((listing: Listing) => listing.category !== "SERVICE");
      setListings(filteredData);
    } catch (error: any) {
      console.error("Failed to load listings:", error);
      // Redirect to verification if user is not verified for compound
      if (error?.message?.includes("403") || error?.response?.status === 403) {
        router.push("/verification");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadListings();
  }

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedIntent("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("date_desc");
  }

  const canCreateListing = user?.can_create_listing || false;
  const hasActiveFilters = selectedCategory || selectedIntent || minPrice || maxPrice || searchQuery;
  const verificationStatus = user?.verification_status || "UNVERIFIED";

  // Block REJECTED users from accessing the marketplace
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
            <Text style={{ fontSize: 64 }}>🚫</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
            Verification Not Granted
          </Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
            Your verification request has been rejected. You cannot access the marketplace at this time.
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
            onPress={() => router.push("/verification")}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Review Verification Status
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Group listings into rows of 2
  const renderRow = (rowItems: Listing[]) => {
    return (
      <View style={{ flexDirection: "row", paddingHorizontal: 12, marginBottom: 12 }}>
        {rowItems.map((item) => (
          <View key={item.id} style={{ flex: 1, marginHorizontal: 4 }}>
            <ListingCard listing={item} router={router} />
          </View>
        ))}
        {rowItems.length === 1 && <View style={{ flex: 1, marginHorizontal: 4 }} />}
      </View>
    );
  };

  const listingRows: Listing[][] = [];
  for (let i = 0; i < listings.length; i += 2) {
    listingRows.push(listings.slice(i, i + 2));
  }

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading marketplace... 🛒
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <FlatList
        data={listingRows}
        keyExtractor={(_, index) => `row-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
        ListHeaderComponent={
          <View>
            {/* Header with Logo */}
            <Header
              showLogo={true}
              rightAction={{
                label: "+ Sell",
                onPress: () => {
                  if (canCreateListing) {
                    router.push("/create-listing");
                  }
                },
                disabled: !canCreateListing,
              }}
            />
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
              }}
            >

              {/* Search */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.gray50,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: colors.border,
                    color: colors.textMain,
                  }}
                  placeholder="Search listings..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.trim() ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.gray300,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      justifyContent: "center",
                    }}
                    onPress={() => setSearchQuery("")}
                  >
                    <Text style={{ fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      justifyContent: "center",
                    }}
                    onPress={() => setShowFilters(!showFilters)}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>🔍</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={{
                        backgroundColor: selectedCategory === cat.value ? "#8B5CF6" : "#FFFFFF",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: selectedCategory === cat.value ? "#8B5CF6" : "#E5E7EB",
                      }}
                      onPress={() => setSelectedCategory(cat.value)}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: selectedCategory === cat.value ? "#FFFFFF" : "#111827",
                        }}
                      >
                        {cat.icon} {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Intent Pills */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {INTENTS.map((int) => (
                  <TouchableOpacity
                    key={int.value}
                    style={{
                      flex: 1,
                      backgroundColor: selectedIntent === int.value ? "#3B82F6" : "#FFFFFF",
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selectedIntent === int.value ? "#3B82F6" : "#E5E7EB",
                      alignItems: "center",
                    }}
                    onPress={() => setSelectedIntent(int.value)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: selectedIntent === int.value ? "#FFFFFF" : "#111827",
                      }}
                    >
                      {int.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort */}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
                <Text style={{ fontSize: 13, color: "#6B7280", marginRight: 8 }}>Sort:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {SORT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={{
                          backgroundColor: sortBy === opt.value ? "#3B82F6" : "#F3F4F6",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                        onPress={() => setSortBy(opt.value)}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "500",
                            color: sortBy === opt.value ? "#FFFFFF" : "#6B7280",
                          }}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {hasActiveFilters && (
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    paddingVertical: 8,
                    alignItems: "center",
                  }}
                  onPress={clearFilters}
                >
                  <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "500" }}>
                    ✕ Clear Filters
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filters Modal */}
            <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "70%" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#111827" }}>Filters</Text>
                    <TouchableOpacity onPress={() => setShowFilters(false)}>
                      <Text style={{ fontSize: 18, color: "#6B7280" }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>Price Range</Text>
                    <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>Min Price</Text>
                        <TextInput
                          style={{
                            backgroundColor: "#F9FAFB",
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 15,
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            color: "#1B1B1B",
                          }}
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          value={minPrice}
                          onChangeText={setMinPrice}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>Max Price</Text>
                        <TextInput
                          style={{
                            backgroundColor: "#F9FAFB",
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            fontSize: 15,
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            color: "#1B1B1B",
                          }}
                          placeholder="No limit"
                          placeholderTextColor="#9CA3AF"
                          value={maxPrice}
                          onChangeText={setMaxPrice}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: "#3B82F6",
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                      onPress={() => setShowFilters(false)}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Apply Filters</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </View>
        }
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
            <Text style={{ fontSize: 16, color: "#6B7280", marginBottom: 8 }}>
              {hasActiveFilters ? "No listings match your filters" : "No listings yet"}
            </Text>
            <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
              {hasActiveFilters ? "Try adjusting your filters" : "Be the first to list something!"}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
