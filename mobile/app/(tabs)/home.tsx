import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Post } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { CompoundHero } from "@/components/feed/compound-hero";
import { HomeShortcuts } from "@/components/home/home-shortcuts";
import { NeighbourPostCard } from "@/components/home/neighbour-post-card";
import { AppBrandBar } from "@/components/AppBrandBar";
import { CompoundInviteCard } from "@/components/compound-invite-card";
import { AppPressable, Button } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [compoundName, setCompoundName] = useState<string | null>(null);
  const [compoundArea, setCompoundArea] = useState<string | null>(null);
  const [compoundHeroUrl, setCompoundHeroUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLimit, setPostsLimit] = useState(15);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user, apiClient } = useAuth();
  const { activeCompoundId } = useCompound();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER") {
      setLoading(false);
      return;
    }
    if (!activeCompoundId || !apiClient) return;

    let cancelled = false;
    const compoundId = activeCompoundId;

    setLoading(true);
    setPosts([]);
    setPostsLimit(15);
    setHasMorePosts(true);

    async function loadCompoundData() {
      try {
        const [summary, feedPosts] = await Promise.all([
          apiClient.getFeedSummary(),
          apiClient.getFeed(15),
        ]);
        if (cancelled) return;
        setCompoundName(summary.compound_name);
        setCompoundArea(summary.compound_area);
        setCompoundHeroUrl(summary.compound_hero_image_url ?? null);
        const sorted = [...(feedPosts || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setPosts(sorted);
        setHasMorePosts((feedPosts || []).length >= 15);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load feed:", error);
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadCompoundData();
    return () => {
      cancelled = true;
    };
  }, [activeCompoundId, user?.role, apiClient]);

  async function handleRefresh() {
    const compoundId = activeCompoundId || user?.compound_id;
    if (!compoundId || !apiClient) return;
    setRefreshing(true);
    try {
      const [summary, feedPosts] = await Promise.all([
        apiClient.getFeedSummary(),
        apiClient.getFeed(15),
      ]);
      setCompoundName(summary.compound_name);
      setCompoundArea(summary.compound_area);
      setCompoundHeroUrl(summary.compound_hero_image_url ?? null);
      const sorted = [...(feedPosts || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setPosts(sorted);
      setPostsLimit(15);
      setHasMorePosts((feedPosts || []).length >= 15);
    } catch (error) {
      console.error("Failed to refresh feed:", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (!apiClient || loadingMore || !hasMorePosts || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const nextLimit = postsLimit + 15;
      const feedPosts = await apiClient.getFeed(nextLimit);
      const sorted = [...(feedPosts || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setPosts(sorted);
      setPostsLimit(nextLimit);
      setHasMorePosts((feedPosts || []).length >= nextLimit);
    } catch (error) {
      console.error("Failed to load more feed:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  const canPost = user?.can_post || false;
  const verificationStatus = user?.verification_status || "UNVERIFIED";

  if (user && user.role === "SERVICE_PROVIDER") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppBrandBar compact style={styles.emptyBrand} />
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="construct-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Access restricted</Text>
          <Text style={styles.emptyBody}>
            Service providers manage offerings from the Services tab.
          </Text>
          <Button onPress={() => router.push("/(tabs)/services")} size="medium" style={styles.emptyCta}>
            Go to Services
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (verificationStatus === "REJECTED") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppBrandBar compact style={styles.emptyBrand} />
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.errorLight }]}>
            <Ionicons name="document-text-outline" size={36} color={colors.error} />
          </View>
          <Text style={styles.emptyTitle}>Verification needs attention</Text>
          <Text style={styles.emptyBody}>
            One or more documents were not approved. Re-upload them to continue.
          </Text>
          <Button onPress={() => router.replace("/verification-pending")} size="medium" style={styles.emptyCta}>
            Review & re-upload
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]} edges={["top"]}>
        <AppBrandBar compact style={styles.emptyBrand} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your neighbourhood…</Text>
      </SafeAreaView>
    );
  }

  if (!activeCompoundId && !user?.compound_id && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppBrandBar compact style={styles.emptyBrand} />
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
          <CompoundInviteCard />
        </View>
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="home-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Select your neighbourhood</Text>
          <Text style={styles.emptyBody}>
            Choose a compound to see posts from your neighbours.
          </Text>
          <Button
            onPress={() => router.push("/onboarding/compound-select")}
            size="medium"
            style={styles.emptyCta}
          >
            Select neighbourhood
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {verificationStatus !== "APPROVED" ? (
        <SafeAreaView edges={["top"]} style={styles.bannerSafe}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              router.push(verificationStatus === "PENDING" ? "/verification-pending" : "/verification")
            }
            style={[
              styles.banner,
              verificationStatus === "PENDING" ? styles.bannerPending : styles.bannerAction,
            ]}
          >
            <Text style={styles.bannerText}>
              {verificationStatus === "PENDING"
                ? "Your verification is being reviewed"
                : "Verify your account to unlock all features"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMain} />
          </TouchableOpacity>
        </SafeAreaView>
      ) : null}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: spacing[4], alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View>
            {compoundName ? (
              <CompoundHero
                apiClient={apiClient}
                compoundArea={compoundArea}
                compoundName={compoundName}
                heroImageUrl={compoundHeroUrl}
              />
            ) : (
              <View style={styles.heroFallback}>
                <AppBrandBar compact style={styles.fallbackBrand} tone="light" />
              </View>
            )}

            <HomeShortcuts />

            <View style={{ paddingHorizontal: spacing[5] }}>
              <CompoundInviteCard />
            </View>

            {canPost ? (
              <AppPressable
                accessibilityLabel="Share with neighbours"
                accessibilityRole="button"
                onPress={() => router.push("/create-post")}
                pressedStyle={styles.sharePressed}
                style={styles.shareStrip}
              >
                <View style={styles.shareVisual}>
                  <Ionicons name="people-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.shareCopy}>
                  <Text style={styles.shareTitle}>Share with neighbours</Text>
                  <Text style={styles.shareSubtitle}>Post a message or helpful update</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </AppPressable>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>From neighbours</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <NeighbourPostCard
            post={item}
            apiClient={apiClient}
            currentUser={user}
            onPostDeleted={(postId) => setPosts((prev) => prev.filter((p) => p.id !== postId))}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyFeed}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your feed is quiet for now</Text>
            <Text style={styles.emptyBody}>
              Say hello to your neighbours — share a question, update, or recommendation.
            </Text>
            {canPost ? (
              <Button onPress={() => router.push("/create-post")} size="medium" style={styles.emptyCta}>
                Start a post
              </Button>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  safe: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: typography.size.body,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  bannerSafe: {
    backgroundColor: palette.surface,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  bannerPending: {
    backgroundColor: palette.warningSoft,
  },
  bannerAction: {
    backgroundColor: palette.dangerSoft,
  },
  bannerText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.textMain,
  },
  heroFallback: {
    height: 160,
    backgroundColor: palette.primary,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  fallbackBrand: {
    alignSelf: "flex-start",
  },
  emptyBrand: {
    alignSelf: "flex-start",
    marginBottom: spacing[6],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    width: "100%",
  },
  shareStrip: {
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    marginBottom: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.xl,
    padding: spacing[3],
  },
  sharePressed: {
    opacity: 0.9,
  },
  shareVisual: {
    width: 52,
    height: 52,
    borderRadius: radii.medium,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  shareCopy: {
    flex: 1,
  },
  shareTitle: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  shareSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.size.caption,
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  },
  sectionTitle: {
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  listContent: {
    paddingBottom: spacing[10],
  },
  emptyFeed: {
    alignItems: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[10],
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
  },
  emptyTitle: {
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
    color: colors.textMain,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: spacing[6],
    alignSelf: "stretch",
  },
});
