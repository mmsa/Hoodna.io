import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography, palette, radii } from "@hoodna/tokens";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ImageBackground,
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

const CATEGORY_CARDS = [
  {
    key: "cleaning",
    label: "Home cleaning",
    search: "clean",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
  },
  {
    key: "handyman",
    label: "Handyman",
    search: "repair",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
  },
  {
    key: "tutoring",
    label: "Tutoring",
    search: "tutor",
    image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80",
  },
] as const;

type BrowseFilter = "categories" | "all" | (typeof CATEGORY_CARDS)[number]["key"];

export default function ServicesScreen() {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [browse, setBrowse] = useState<BrowseFilter>("categories");
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
  }

  useEffect(() => {
    loadServices();
  }, [user?.compound_id, user?.role, search]);

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

  const showList = isProvider || browse !== "categories" || !!search.trim();

  const visibleServices = useMemo(() => {
    if (!showList) return [];
    if (browse === "all" || browse === "categories" || search.trim()) return services;
    const card = CATEGORY_CARDS.find((c) => c.key === browse);
    if (!card) return services;
    const q = card.search.toLowerCase();
    return services.filter((item) => item.title.toLowerCase().includes(q));
  }, [services, browse, search, showList]);

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
                  if (value.trim()) setBrowse("all");
                }}
                placeholder="Search services"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
              />
            </View>

            {!isProvider ? (
              <View style={styles.cards}>
                {CATEGORY_CARDS.map((card) => {
                  const active = browse === card.key;
                  return (
                    <TouchableOpacity
                      key={card.key}
                      activeOpacity={0.9}
                      onPress={() => {
                        setSearch("");
                        setBrowse(active ? "categories" : card.key);
                      }}
                      style={[styles.categoryCard, active && styles.categoryCardActive]}
                    >
                      <ImageBackground
                        source={{ uri: card.image }}
                        style={styles.categoryImage}
                        imageStyle={styles.categoryImageInner}
                      >
                        <View style={styles.categoryScrim} />
                        <Text style={styles.categoryLabel}>{card.label}</Text>
                      </ImageBackground>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {!isProvider ? (
              <TouchableOpacity
                onPress={() => {
                  setSearch("");
                  setBrowse(browse === "all" ? "categories" : "all");
                }}
                style={styles.seeAllLink}
              >
                <Text style={styles.seeAllText}>
                  {browse === "all" ? "Show categories only" : "See all services"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {showList && visibleServices.length > 0 ? (
              <Text style={styles.listHeading}>
                {browse !== "all" && browse !== "categories"
                  ? CATEGORY_CARDS.find((c) => c.key === browse)?.label
                  : search.trim()
                    ? "Results"
                    : "All services"}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          showList ? (
            <EmptyState
              actionLabel={canCreate && !search ? "Create a service" : undefined}
              description={
                search || (browse !== "all" && browse !== "categories")
                  ? "Try another search or category."
                  : isProvider
                    ? "Your published services will appear here."
                    : "No approved providers have published a service yet."
              }
              icon={<Ionicons color={colors.textMuted} name="construct-outline" size={36} />}
              onAction={canCreate ? () => router.push("/create-listing?category=SERVICE") : undefined}
              title={search || browse !== "all" ? "No services found" : "No services yet"}
            />
          ) : (
            <View style={styles.browseHint}>
              <Text style={styles.browseHintText}>
                Tap a category above, or search for the help you need.
              </Text>
            </View>
          )
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
  cards: {
    gap: spacing[4],
    marginBottom: spacing[3],
  },
  categoryCard: {
    height: 140,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  categoryCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  categoryImage: {
    flex: 1,
    justifyContent: "flex-end",
  },
  categoryImageInner: {
    borderRadius: radii.xl,
  },
  categoryScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  categoryLabel: {
    color: "#FFFFFF",
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
    padding: spacing[4],
  },
  seeAllLink: {
    alignSelf: "flex-start",
    paddingVertical: spacing[2],
    marginBottom: spacing[2],
  },
  seeAllText: {
    color: colors.primary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  listHeading: {
    marginTop: spacing[2],
    marginBottom: spacing[3],
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  card: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  browseHint: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
  },
  browseHintText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
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
