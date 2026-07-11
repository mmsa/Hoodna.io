import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator, TextInput, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "PROPERTY", label: "Property" },
  { value: "CAR", label: "Cars" },
  { value: "ITEM", label: "Items" },
];

const INTENTS = [
  { value: "", label: "Any" },
  { value: "SELL", label: "For Sale" },
  { value: "RENT", label: "For Rent" },
];

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
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
      activeOpacity={0.9}
      onPress={() => router.push(`/listing/${listing.id}`)}
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
    if (user?.role === "SERVICE_PROVIDER") {
      setLoading(false);
      return;
    }
    loadListings();
  }, [user?.compound_id, user?.role, searchQuery, selectedCategory, selectedIntent, sortBy, minPrice, maxPrice]);

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
  const sheetFilterCount = [selectedIntent, minPrice, maxPrice, sortBy !== "date_desc" ? sortBy : ""].filter(Boolean).length;
  const hasActiveFilters = !!(selectedCategory || selectedIntent || minPrice || maxPrice || searchQuery || sortBy !== "date_desc");
  const verificationStatus = user?.verification_status || "UNVERIFIED";
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Newest";
  const intentLabel = INTENTS.find((o) => o.value === selectedIntent)?.label;

  // Block SERVICE_PROVIDER users from accessing the marketplace
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
            Service providers are not allowed to browse the marketplace. Please manage your services from the Services page.
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
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.background }}>
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
                    placeholder="Search listings..."
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
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {CATEGORIES.map((cat) => {
                  const selected = selectedCategory === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => setSelectedCategory(cat.value)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: "center",
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
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Active filter summary */}
              {sheetFilterCount > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 10,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                    {[
                      selectedIntent ? intentLabel : null,
                      sortBy !== "date_desc" ? sortLabel : null,
                      minPrice || maxPrice
                        ? `${minPrice || "0"}–${maxPrice || "∞"} EGP`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

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
                    Listing type
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                    {INTENTS.map((int) => (
                      <SheetOption
                        key={int.value}
                        label={int.label}
                        selected={selectedIntent === int.value}
                        onPress={() => setSelectedIntent(int.value)}
                      />
                    ))}
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Sort by
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                    {SORT_OPTIONS.map((opt) => (
                      <SheetOption
                        key={opt.value}
                        label={opt.label}
                        selected={sortBy === opt.value}
                        onPress={() => setSortBy(opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Price (EGP)
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={{
                          backgroundColor: colors.gray50,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          fontSize: 15,
                          borderWidth: 1,
                          borderColor: colors.border,
                          color: colors.textMain,
                        }}
                        placeholder="Min"
                        placeholderTextColor={colors.textMuted}
                        value={minPrice}
                        onChangeText={setMinPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ justifyContent: "center" }}>
                      <Text style={{ color: colors.textMuted }}>–</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={{
                          backgroundColor: colors.gray50,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          fontSize: 15,
                          borderWidth: 1,
                          borderColor: colors.border,
                          color: colors.textMain,
                        }}
                        placeholder="Max"
                        placeholderTextColor={colors.textMuted}
                        value={maxPrice}
                        onChangeText={setMaxPrice}
                        keyboardType="numeric"
                      />
                    </View>
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
