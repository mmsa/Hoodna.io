import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography } from "@hoodna/tokens";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { MarketplaceFilterSheet } from "@/components/marketplace/filter-sheet";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Header } from "@/components/Header";
import { AppPressable, Button, Chip, EmptyState, LoadingState, TextField } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "PROPERTY", label: "Property" },
  { value: "CAR", label: "Cars" },
  { value: "ITEM", label: "Items" },
];

export default function MarketScreen() {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [intent, setIntent] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function loadListings() {
    if (user?.role === "SERVICE_PROVIDER") {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params: Record<string, string> = { scope: "compound", sort_by: sortBy };
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (intent) params.intent = intent;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      const data = await apiClient.getListings(params);
      setListings((data || []).filter((item) => item.category !== "SERVICE"));
    } catch (error: any) {
      console.error("Failed to load listings:", error);
      if (error?.message?.includes("403") || error?.response?.status === 403) {
        router.push("/verification");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, [user?.compound_id, user?.role, search, category, intent, sortBy, minPrice, maxPrice]);

  const activeFilterCount = useMemo(
    () => [intent, minPrice, maxPrice, sortBy !== "date_desc" ? sortBy : ""].filter(Boolean).length,
    [intent, minPrice, maxPrice, sortBy],
  );

  function resetFilters() {
    setIntent("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("date_desc");
  }

  if (user?.role === "SERVICE_PROVIDER") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <EmptyState
          actionLabel="Go to services"
          description="Provider accounts manage their offers from Services and do not browse resident marketplace listings."
          icon={<Ionicons color={colors.textMuted} name="storefront-outline" size={36} />}
          onAction={() => router.push("/(tabs)/services")}
          title="Marketplace is for residents"
        />
      </SafeAreaView>
    );
  }

  if (user?.verification_status === "REJECTED") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <EmptyState
          actionLabel="Review documents"
          description="One or more documents need attention before you can use the marketplace."
          onAction={() => router.replace("/verification-pending")}
          title="Verification needs attention"
        />
      </SafeAreaView>
    );
  }

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <LoadingState label="Loading marketplace" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <FlatList
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        data={listings}
        keyExtractor={(item) => String(item.id)}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Header
              rightAction={{
                label: "New listing",
                disabled: !user?.can_create_listing,
                onPress: () => router.push("/create-listing"),
              }}
              showLogo
            />
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.heading}>Marketplace</Text>
              <Text style={styles.subheading}>Buy, sell and rent within your compound.</Text>
            </View>
            <View style={styles.searchRow}>
              <TextField
                accessibilityLabel="Search marketplace"
                containerStyle={styles.search}
                onChangeText={setSearch}
                placeholder="Search listings"
                returnKeyType="search"
                value={search}
              />
              <AppPressable
                accessibilityLabel={`Open filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
                accessibilityRole="button"
                onPress={() => setFiltersOpen(true)}
                style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              >
                <Ionicons
                  color={activeFilterCount ? colors.primary : colors.text}
                  name="options-outline"
                  size={21}
                />
                {activeFilterCount ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}
              </AppPressable>
            </View>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  onPress={() => setCategory(item.value)}
                  selected={category === item.value}
                />
              ))}
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {listings.length} {listings.length === 1 ? "listing" : "listings"}
              </Text>
              {activeFilterCount ? (
                <Button onPress={resetFilters} size="small" variant="ghost">Clear filters</Button>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            description="Try a different search, category or price range."
            icon={<Ionicons color={colors.textMuted} name="search-outline" size={34} />}
            title="No listings found"
          />
        }
        numColumns={2}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              loadListings();
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cardCell}>
            <ListingCard
              apiClient={apiClient}
              listing={item}
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          </View>
        )}
      />
      <MarketplaceFilterSheet
        intent={intent}
        maxPrice={maxPrice}
        minPrice={minPrice}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
        setIntent={setIntent}
        setMaxPrice={setMaxPrice}
        setMinPrice={setMinPrice}
        setSortBy={setSortBy}
        sortBy={sortBy}
        visible={filtersOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing[8] },
  intro: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  heading: {
    color: colors.text,
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
  },
  subheading: { marginTop: spacing[1], color: colors.textSecondary, fontSize: typography.size.bodySmall },
  searchRow: { flexDirection: "row", gap: spacing[2], padding: spacing[4], paddingBottom: spacing[3] },
  search: { flex: 1 },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.backgroundWhite,
  },
  filterButtonActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  filterCount: { position: "absolute", top: 3, right: 6, color: colors.primaryDark, fontSize: 11, fontWeight: "700" },
  categoryRow: { flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  resultRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
  },
  resultText: { color: colors.textSecondary, fontSize: typography.size.bodySmall },
  columns: { paddingHorizontal: spacing[4], gap: spacing[3] },
  cardCell: { flex: 1, maxWidth: "50%", marginBottom: spacing[3] },
});
