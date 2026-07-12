import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography } from "@hoodna/tokens";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Header } from "@/components/Header";
import { MarketplaceFilterSheet } from "@/components/marketplace/filter-sheet";
import { ListingCard } from "@/components/marketplace/listing-card";
import { AppPressable, Button, EmptyState, LoadingState, TextField } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { formatCompoundName } from "@/utils/formatCompound";

interface ProviderProfile {
  provider_status: string;
}

export default function ServicesScreen() {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [intent, setIntent] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compoundName, setCompoundName] = useState<string | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);

  const isProvider = user?.role === "SERVICE_PROVIDER";

  async function loadServices() {
    if (!isProvider && !user?.compound_id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params: Record<string, string> = {
        scope: isProvider ? "my" : "compound",
        category: "SERVICE",
        sort_by: sortBy,
      };
      if (search.trim()) params.search = search.trim();
      if (intent) params.intent = intent;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      setServices((await apiClient.getListings(params)) || []);
    } catch (error: any) {
      console.error("Failed to load services:", error);
      if (!isProvider && (error?.message?.includes("403") || error?.response?.status === 403)) {
        router.push("/verification");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, [user?.compound_id, user?.role, search, intent, sortBy, minPrice, maxPrice]);

  useEffect(() => {
    if (isProvider) {
      apiClient.getProviderProfile().then(setProviderProfile).catch((error) => {
        if (error?.status !== 404) console.error("Failed to load provider profile:", error);
      });
    } else if (user?.compound_id) {
      apiClient.getUserCompounds().then((compounds) => {
        setCompoundName(compounds.find((item) => item.id === user.compound_id)?.name || null);
      }).catch((error) => console.error("Failed to load compound name:", error));
    }
  }, [apiClient, isProvider, user?.compound_id]);

  const activeFilterCount = useMemo(
    () => [intent, minPrice, maxPrice, sortBy !== "date_desc" ? sortBy : ""].filter(Boolean).length,
    [intent, minPrice, maxPrice, sortBy],
  );

  function resetFilters() {
    setIntent("");
    setSortBy("date_desc");
    setMinPrice("");
    setMaxPrice("");
  }

  const canCreate = isProvider && providerProfile?.provider_status === "APPROVED";

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header title={isProvider ? "My services" : "Services"} />
        <LoadingState label="Loading services" />
      </SafeAreaView>
    );
  }

  if (!isProvider && !user?.compound_id) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header title="Services" />
        <EmptyState
          actionLabel="Select compound"
          description="Choose your compound to find approved providers serving your community."
          onAction={() => router.push("/onboarding/compound-select")}
          title="Select your compound"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={services}
        keyExtractor={(item) => String(item.id)}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
            <Header
              rightAction={canCreate ? {
                label: "New service",
                onPress: () => router.push("/create-listing?category=SERVICE"),
              } : undefined}
              title={isProvider ? "My services" : "Services"}
            />
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.heading}>
                {isProvider ? "Your services" : "Trusted local services"}
              </Text>
              <Text style={styles.subheading}>
                {isProvider
                  ? "Manage the services residents can discover."
                  : `Approved providers serving ${compoundName ? formatCompoundName(compoundName) : "your compound"}.`}
              </Text>
              {isProvider && !canCreate ? (
                <Text style={styles.notice}>New services become available after provider approval.</Text>
              ) : null}
            </View>
            <View style={styles.searchRow}>
              <TextField
                accessibilityLabel="Search services"
                containerStyle={styles.search}
                onChangeText={setSearch}
                placeholder="Search services"
                returnKeyType="search"
                value={search}
              />
              <AppPressable
                accessibilityLabel={`Open filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
                accessibilityRole="button"
                onPress={() => setFiltersOpen(true)}
                style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
              >
                <Ionicons color={activeFilterCount ? colors.primary : colors.text} name="options-outline" size={21} />
                {activeFilterCount ? <Text style={styles.filterCount}>{activeFilterCount}</Text> : null}
              </AppPressable>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultText}>{services.length} {services.length === 1 ? "service" : "services"}</Text>
              {activeFilterCount ? <Button onPress={resetFilters} size="small" variant="ghost">Clear filters</Button> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            actionLabel={canCreate && !search && !activeFilterCount ? "Create a service" : undefined}
            description={
              search || activeFilterCount
                ? "Try a different search or price range."
                : isProvider
                  ? "Your published services will appear here."
                  : "No approved providers have published a service yet."
            }
            icon={<Ionicons color={colors.textMuted} name="construct-outline" size={36} />}
            onAction={canCreate ? () => router.push("/create-listing?category=SERVICE") : undefined}
            title={search || activeFilterCount ? "No services found" : "No services yet"}
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              loadServices();
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <ListingCard
              apiClient={apiClient}
              layout="row"
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
        service
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
  intro: { paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] },
  heading: {
    color: colors.text,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
  },
  subheading: { marginTop: spacing[1], color: colors.textSecondary, fontSize: typography.size.bodySmall, lineHeight: 20 },
  notice: { marginTop: spacing[3], color: colors.primaryDark, fontSize: typography.size.bodySmall, lineHeight: 20 },
  searchRow: { flexDirection: "row", gap: spacing[2], padding: spacing[4], paddingBottom: spacing[2] },
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
  resultRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
  },
  resultText: { color: colors.textSecondary, fontSize: typography.size.bodySmall },
  card: { paddingHorizontal: spacing[4], marginBottom: spacing[3] },
});
