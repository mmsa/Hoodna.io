import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { Listing } from "@hoodna/shared";

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    PROPERTY: "home",
    CAR: "car-sport",
    ITEM: "cube",
    SERVICE: "construct",
  };
  return icons[category] || "storefront";
}

function getCategoryColor(category: string): string {
  const palette: Record<string, string> = {
    PROPERTY: colors.primary,
    CAR: colors.success,
    ITEM: colors.purple,
    SERVICE: colors.accent,
  };
  return palette[category] || colors.textMuted;
}

export default function SavedListingsScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadSavedListings = useCallback(async () => {
    try {
      const data = await apiClient.getSavedListings();
      setListings(data || []);
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

  async function handleRemove(listingId: number) {
    try {
      setRemovingId(listingId);
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} showBackButton={true} title="Saved Listings" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 8 }}>
            Sign in required
          </Text>
          <Text style={{ fontSize: 14, textAlign: "center", color: colors.textMuted }}>
            Saved listings are tied to your account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} showBackButton={true} title="Saved Listings" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textMuted }}>Loading saved listings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header showLogo={true} showBackButton={true} title="Saved Listings" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSavedListings();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ padding: 16, paddingBottom: 40 }}>
          <View
            style={{
              backgroundColor: "#FFF7ED",
              borderRadius: 20,
              padding: 18,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: "#FED7AA",
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#C2410C", marginBottom: 6 }}>
              Your saved items
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>
              Quick access to the listings you bookmarked on mobile or web.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  backgroundColor: "#FDBA74",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#7C2D12" }}>
                  {listings.length}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#9A3412" }}>
                Saved listings
              </Text>
            </View>
          </View>

          {listings.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.backgroundCard,
                borderRadius: 20,
                padding: 28,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Ionicons name="bookmark-outline" size={44} color={colors.textMuted} />
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain, marginTop: 14, marginBottom: 8 }}>
                Nothing saved yet
              </Text>
              <Text style={{ fontSize: 14, textAlign: "center", lineHeight: 21, color: colors.textMuted, marginBottom: 18 }}>
                Bookmark listings from the marketplace and they will appear here.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                }}
                onPress={() => router.push("/(tabs)/market")}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Browse marketplace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {listings.map((listing) => {
                const categoryColor = getCategoryColor(listing.category || "ITEM");
                const previewImage = listing.image_urls?.[0];

                return (
                  <TouchableOpacity
                    key={listing.id}
                    style={{
                      backgroundColor: colors.backgroundCard,
                      borderRadius: 18,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/listing/${listing.id}`)}
                  >
                    {previewImage ? (
                      <Image source={{ uri: previewImage }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
                    ) : (
                      <View
                        style={{
                          height: 180,
                          backgroundColor: `${categoryColor}18`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name={getCategoryIcon(listing.category || "ITEM")} size={40} color={categoryColor} />
                      </View>
                    )}

                    <View style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 6 }} numberOfLines={2}>
                            {listing.title}
                          </Text>
                          {!!listing.description && (
                            <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textMuted }} numberOfLines={2}>
                              {listing.description}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: "#FEE2E2",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onPress={() => handleRemove(listing.id)}
                          disabled={removingId === listing.id}
                        >
                          {removingId === listing.id ? (
                            <ActivityIndicator size="small" color={colors.error} />
                          ) : (
                            <Ionicons name="heart" size={20} color={colors.error} />
                          )}
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <View
                          style={{
                            backgroundColor: `${categoryColor}18`,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 999,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: categoryColor }}>
                            {listing.category}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: listing.intent === "SELL" ? "#FEE2E2" : "#DBEAFE",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 999,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: listing.intent === "SELL" ? colors.error : colors.primary,
                            }}
                          >
                            {listing.intent === "SELL" ? "For Sale" : "For Rent"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.success }}>
                            {listing.price?.toLocaleString()} {listing.currency || "EGP"}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }} numberOfLines={1}>
                            {listing.compound_name}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
