import { Ionicons } from "@expo/vector-icons";
import type { Listing, ServiceCategory } from "@hoodna/shared";
import { spacing, typography, palette, radii } from "@hoodna/tokens";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatCompoundName } from "@/utils/formatCompound";

interface ProviderProfile {
  provider_status: string;
}

function listingMatchesCategory(listing: Listing, category: ServiceCategory): boolean {
  const haystack = `${listing.title} ${listing.description || ""}`.toLowerCase();
  const name = category.name.toLowerCase();
  if (haystack.includes(name)) return true;
  const tokens = name
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2 && token !== "and" && token !== "the");
  return tokens.some((token) => haystack.includes(token));
}

export default function ServicesScreen() {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [compoundName, setCompoundName] = useState<string | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);

  const isProvider = user?.role === "SERVICE_PROVIDER";

  const loadServices = useCallback(async () => {
    if (!isProvider && !user?.compound_id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params: Record<string, string> = {
        scope: isProvider ? "my" : "compound",
        category: "SERVICE",
        sort_by: "date_desc",
      };
      if (search.trim()) params.search = search.trim();
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
  }, [apiClient, isProvider, router, search, user?.compound_id]);

  const loadCategories = useCallback(async () => {
    if (isProvider) return;
    try {
      setCategories((await apiClient.getServiceCategories()) || []);
    } catch (error) {
      console.error("Failed to load service categories:", error);
    }
  }, [apiClient, isProvider]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (isProvider) {
      apiClient
        .getProviderProfile()
        .then(setProviderProfile)
        .catch((error) => {
          if (error?.status !== 404) console.error("Failed to load provider profile:", error);
        });
    } else if (user?.compound_id) {
      apiClient
        .getUserCompounds()
        .then((compounds) => {
          setCompoundName(compounds.find((item) => item.id === user.compound_id)?.name || null);
        })
        .catch((error) => console.error("Failed to load compound name:", error));
    }
  }, [apiClient, isProvider, user?.compound_id]);

  const canCreate =
    isProvider &&
    providerProfile?.provider_status === "APPROVED" &&
    user?.can_create_listing === true;

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  );

  const visibleServices = useMemo(() => {
    if (!selectedCategory || search.trim()) return services;
    return services.filter((item) => listingMatchesCategory(item, selectedCategory));
  }, [services, selectedCategory, search]);

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <LoadingState label="Loading services" />
      </SafeAreaView>
    );
  }

  if (!isProvider && !user?.compound_id) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
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
        data={visibleServices}
        keyExtractor={(item) => String(item.id)}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <AppBrandBar compact style={styles.brandBar} />
            <Text accessibilityRole="header" style={styles.title}>
              {isProvider ? "My services" : "Services"}
            </Text>
            <Text style={styles.subtitle}>
              {isProvider
                ? "Manage the services residents can discover."
                : `Trusted help inside ${compoundName ? formatCompoundName(compoundName) : "your compound"}`}
            </Text>

            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Search services"
                onChangeText={(value) => {
                  setSearch(value);
                  if (value.trim()) setSelectedCategoryId(null);
                }}
                placeholder="Search services"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
              />
            </View>

            {!isProvider && categories.length > 0 ? (
              <View style={styles.categoriesSection}>
                <Text style={styles.sectionLabel}>Categories</Text>
                <View style={styles.categoryGrid}>
                  {categories.map((category) => {
                    const active = selectedCategoryId === category.id;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSearch("");
                          setSelectedCategoryId(active ? null : category.id);
                        }}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                      >
                        <Text style={styles.categoryIcon}>{category.icon || "🔧"}</Text>
                        <Text
                          numberOfLines={2}
                          style={[styles.categoryName, active && styles.categoryNameActive]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.listHeading}>
              {selectedCategory
                ? selectedCategory.name
                : search.trim()
                  ? "Results"
                  : "All services"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            actionLabel={canCreate && !search ? "Create a service" : undefined}
            description={
              search || selectedCategory
                ? "Try another search or category."
                : isProvider
                  ? "Your published services will appear here."
                  : "No approved providers have published a service yet."
            }
            icon={<Ionicons color={colors.textMuted} name="construct-outline" size={36} />}
            onAction={canCreate ? () => router.push("/create-listing?category=SERVICE") : undefined}
            title={search || selectedCategory ? "No services found" : "No services yet"}
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              void Promise.all([loadServices(), loadCategories()]);
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
      {canCreate ? (
        <TouchableOpacity
          accessibilityLabel="Offer a service"
          accessibilityRole="button"
          activeOpacity={0.9}
          onPress={() => router.push("/create-listing?category=SERVICE")}
          style={styles.offerFab}
        >
          <Text style={styles.offerFabText}>Offer a service</Text>
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
    paddingBottom: spacing[2],
  },
  brandBar: {
    marginBottom: spacing[3],
  },
  title: {
    color: colors.text,
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing[1],
    marginBottom: spacing[4],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
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
    marginBottom: spacing[5],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.textMain,
    paddingVertical: spacing[3],
  },
  categoriesSection: {
    marginBottom: spacing[4],
  },
  sectionLabel: {
    marginBottom: spacing[3],
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  categoryChip: {
    width: "31%",
    minHeight: 88,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[3],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: palette.primarySoft,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryName: {
    textAlign: "center",
    color: colors.textMain,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: typography.weight.semibold,
  },
  categoryNameActive: {
    color: colors.primary,
  },
  listHeading: {
    marginTop: spacing[1],
    marginBottom: spacing[3],
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  card: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  offerFab: {
    position: "absolute",
    alignSelf: "center",
    bottom: spacing[5],
    minHeight: 48,
    paddingHorizontal: spacing[6],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  offerFabText: {
    color: palette.onPrimary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
});
