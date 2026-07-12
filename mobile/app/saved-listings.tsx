import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { spacing, typography } from "@hoodna/tokens";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Header } from "@/components/Header";
import { ListingCard } from "@/components/marketplace/listing-card";
import { EmptyState, LoadingState } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function SavedListingsScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadSavedListings = useCallback(async () => {
    try {
      setListings((await apiClient.getSavedListings()) || []);
    } catch (error) {
      console.error("Failed to load saved listings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiClient]);

  useEffect(() => {
    loadSavedListings();
  }, [loadSavedListings]);

  async function remove(listingId: number) {
    setRemovingId(listingId);
    try {
      await apiClient.unsaveListing(listingId);
      setListings((current) => current.filter((listing) => listing.id !== listingId));
    } catch (error) {
      console.error("Failed to remove saved listing:", error);
    } finally {
      setRemovingId(null);
    }
  }

  if (!user) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showBackButton title="Saved listings" />
        <EmptyState description="Saved listings are tied to your account." title="Sign in required" />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <Header showBackButton title="Saved listings" />
        <LoadingState label="Loading saved listings" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={listings}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View>
            <Header showBackButton title="Saved listings" />
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.heading}>Saved for later</Text>
              <Text style={styles.subheading}>
                {listings.length
                  ? `${listings.length} ${listings.length === 1 ? "listing" : "listings"} from marketplace and services.`
                  : "Listings you bookmark will stay easy to find here."}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            actionLabel="Browse marketplace"
            description="Use the bookmark button on a listing to keep it here."
            icon={<Ionicons color={colors.textMuted} name="bookmark-outline" size={38} />}
            onAction={() => router.push("/(tabs)/market")}
            title="Nothing saved yet"
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              loadSavedListings();
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
              onRemove={() => remove(item.id)}
              removing={removingId === item.id}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: spacing[8] },
  intro: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[5] },
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
  card: { paddingHorizontal: spacing[4], marginBottom: spacing[3] },
});
