import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography, palette, radii } from "@hoodna/tokens";
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
import { useCompound } from "@/contexts/CompoundContext";
import { useTranslation } from "@/contexts/LocaleContext";

const CATEGORY_KEYS = [
  { value: "", labelKey: "marketplace.allCategories" as const },
  { value: "PROPERTY", labelKey: "marketplace.categories.PROPERTY" as const },
  { value: "CAR", labelKey: "marketplace.categories.CAR" as const },
  { value: "ITEM", labelKey: "marketplace.categories.ITEM" as const },
];

export default function MarketScreen() {
  const { apiClient, user } = useAuth();
  const { activeCompoundId } = useCompound();
  const { t } = useTranslation();
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
    const compoundId = activeCompoundId || user?.compound_id;
    if (!compoundId || user?.role === "SERVICE_PROVIDER") {
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
      if (compoundId !== (activeCompoundId || user?.compound_id)) return;
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
  }, [activeCompoundId, user?.compound_id, user?.role, search, category, intent, sortBy, minPrice, maxPrice]);

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

  function selectCategory(value: string) {
    setCategory(value);
    if (value !== "PROPERTY") setIntent("");
  }

  function openCreateListing() {
    router.push(category ? `/create-listing?category=${category}` : "/create-listing");
  }

  if (user?.role === "SERVICE_PROVIDER") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <EmptyState
          actionLabel={t("marketplace.goToServices")}
          description={t("marketplace.providerMarketDesc")}
          icon={<Ionicons color={colors.textMuted} name="storefront-outline" size={36} />}
          onAction={() => router.push("/(tabs)/services")}
          title={t("marketplace.providerMarketTitle")}
        />
      </SafeAreaView>
    );
  }

  if (user?.verification_status === "REJECTED") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <EmptyState
          actionLabel={t("marketplace.reviewDocuments")}
          description={t("marketplace.verificationRejectedDesc")}
          onAction={() => router.replace("/verification-pending")}
          title={t("marketplace.verificationNeedsAttention")}
        />
      </SafeAreaView>
    );
  }

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showLogo />
        <LoadingState label={t("marketplace.loadingMarketplace")} />
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
              rightAction={user?.can_create_listing ? {
                label: t("marketplace.newListing"),
                onPress: openCreateListing,
              } : undefined}
              showLogo
            />
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Ionicons color={colors.primary} name="sparkles" size={14} />
                <Text style={styles.heroBadgeText}>{t("marketplace.yourNeighbours")}</Text>
              </View>
              <Text accessibilityRole="header" style={styles.heading}>
                {t("marketplace.title")}
              </Text>
              <Text style={styles.subheading}>
                {t("marketplace.marketSubtitle")}
              </Text>
              {user?.can_create_listing ? (
                <Button onPress={openCreateListing} size="medium" style={styles.heroCta}>
                  {t("marketplace.postListing")}
                </Button>
              ) : null}
            </View>
            <View style={styles.searchRow}>
              <TextField
                accessibilityLabel="Search marketplace"
                containerStyle={styles.search}
                onChangeText={setSearch}
                placeholder={t("marketplace.searchPlaceholder")}
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
              {CATEGORY_KEYS.map((item) => (
                <Chip
                  key={item.value}
                  label={t(item.labelKey)}
                  onPress={() => selectCategory(item.value)}
                  selected={category === item.value}
                />
              ))}
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {listings.length === 1
                  ? t("marketplace.listingCountOne")
                  : t("marketplace.listingCount", { count: listings.length })}
              </Text>
              {activeFilterCount ? (
                <Button onPress={resetFilters} size="small" variant="ghost">{t("marketplace.clearFilters")}</Button>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            actionLabel={user?.can_create_listing ? t("marketplace.postFirstListing") : undefined}
            description={t("marketplace.nothingListedDesc")}
            icon={<Ionicons color={colors.primary} name="camera-outline" size={36} />}
            onAction={user?.can_create_listing ? openCreateListing : undefined}
            title={t("marketplace.nothingListedYet")}
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
        category={category}
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
      {user?.can_create_listing ? (
        <AppPressable
          accessibilityLabel="Post listing"
          accessibilityRole="button"
          onPress={openCreateListing}
          style={styles.fab}
        >
          <Ionicons color={palette.onPrimary} name="add" size={28} />
        </AppPressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing[8] },
  hero: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[2],
    borderRadius: radii.large,
    backgroundColor: palette.primarySoft,
    padding: spacing[4],
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    borderRadius: radii.full,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    marginBottom: spacing[2],
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
  },
  subheading: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  heroCta: { marginTop: spacing[4], alignSelf: "flex-start" },
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
  fab: {
    position: "absolute",
    right: spacing[4],
    bottom: spacing[4],
    width: 56,
    height: 56,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
