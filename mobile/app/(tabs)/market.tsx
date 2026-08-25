import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography, palette, radii } from "@hoodna/tokens";
import { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ListingCard } from "@/components/marketplace/listing-card";
import { AppBrandBar } from "@/components/AppBrandBar";
import { EmptyState, LoadingState } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { useTranslation } from "@/contexts/LocaleContext";

const SEGMENTS = [
  { value: "", label: "All" },
  { value: "sale", label: "For sale" },
  { value: "free", label: "Free" },
] as const;

export default function MarketScreen() {
  const { apiClient, user } = useAuth();
  const { activeCompoundId } = useCompound();
  const { t } = useTranslation();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]["value"]>("");

  async function loadListings() {
    const compoundId = activeCompoundId || user?.compound_id;
    if (!compoundId || user?.role === "SERVICE_PROVIDER") {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params: Record<string, string> = { scope: "compound", sort_by: "date_desc" };
      if (search.trim()) params.search = search.trim();
      if (segment === "free") params.intent = "FREE";
      if (segment === "sale") params.intent = "SELL";
      const data = await apiClient.getListings(params);
      if (compoundId !== (activeCompoundId || user?.compound_id)) return;
      let items = (data || []).filter((item) => item.category !== "SERVICE");
      setListings(items);
    } catch (error: any) {
      console.error("Failed to load listings:", error);
      const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR";
      if (
        !isStaff &&
        (error?.message?.includes("403") || error?.response?.status === 403)
      ) {
        router.push("/verification");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, [activeCompoundId, user?.compound_id, user?.role, search, segment]);

  function openCreateListing() {
    router.push("/create-listing");
  }

  if (user?.role === "SERVICE_PROVIDER") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
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
        <AppBrandBar compact style={styles.loadingBrand} />
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
          <View style={styles.header}>
            <AppBrandBar compact style={styles.brandBar} />
            <Text accessibilityRole="header" style={styles.title}>
              Marketplace
            </Text>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Search marketplace"
                onChangeText={setSearch}
                placeholder="Search marketplace"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
              />
            </View>
            <View style={styles.segments}>
              {SEGMENTS.map((item) => {
                const active = segment === item.value;
                return (
                  <TouchableOpacity
                    key={item.value || "all"}
                    activeOpacity={0.7}
                    onPress={() => setSegment(item.value)}
                    style={styles.segment}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {item.label}
                    </Text>
                    {active ? <View style={styles.segmentUnderline} /> : null}
                  </TouchableOpacity>
                );
              })}
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
      {user?.can_create_listing ? (
        <TouchableOpacity
          accessibilityLabel="Sell something"
          accessibilityRole="button"
          activeOpacity={0.9}
          onPress={openCreateListing}
          style={styles.sellFab}
        >
          <Text style={styles.sellFabText}>Sell</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface },
  content: { paddingBottom: spacing[16] },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  brandBar: {
    marginBottom: spacing[3],
  },
  loadingBrand: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  title: {
    color: colors.text,
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing[4],
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    minHeight: 48,
    backgroundColor: palette.surface,
    marginBottom: spacing[4],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.textMain,
    paddingVertical: spacing[3],
  },
  segments: {
    flexDirection: "row",
    gap: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  segment: {
    paddingBottom: spacing[3],
    minWidth: 64,
  },
  segmentText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },
  segmentUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  columns: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  cardCell: {
    flex: 1,
    maxWidth: "50%",
    marginBottom: spacing[5],
  },
  sellFab: {
    position: "absolute",
    right: spacing[5],
    bottom: spacing[5],
    minWidth: 72,
    height: 48,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  sellFabText: {
    color: palette.onPrimary,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
