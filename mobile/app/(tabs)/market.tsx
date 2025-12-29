import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";

export default function MarketScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, apiClient } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadListings();
  }, [user?.compound_id]);

  async function loadListings() {
    if (!user?.compound_id) return;

    try {
      const data = await apiClient.getListings({ scope: "compound" });
      setListings(data);
    } catch (error) {
      console.error("Failed to load listings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadListings();
  }

  const canCreateListing = user?.can_create_listing || false;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <View className="px-4 py-4 border-b border-gray-200">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-text-main">Marketplace</Text>
              <TouchableOpacity
                className={`px-4 py-2 rounded-button ${
                  canCreateListing ? "bg-primary" : "bg-gray-300"
                }`}
                onPress={() => {
                  if (canCreateListing) {
                    router.push("/create-listing");
                  }
                }}
                disabled={!canCreateListing}
              >
                <Text className="text-white text-sm font-semibold">Sell</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white mx-4 my-2 rounded-card overflow-hidden border border-gray-200"
            onPress={() => router.push(`/listing/${item.id}`)}
          >
            {item.image_urls.length > 0 && (
              <Image
                source={{ uri: item.image_urls[0] }}
                className="w-full h-48"
                resizeMode="cover"
              />
            )}
            <View className="p-4">
              <Text className="text-lg font-semibold text-text-main mb-1">
                {item.title}
              </Text>
              {item.price && (
                <Text className="text-xl font-bold text-primary mb-2">
                  {item.price.toLocaleString()} {item.currency}
                </Text>
              )}
              <Text className="text-sm text-text-muted">{item.category}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-text-muted">No listings yet</Text>
          </View>
        }
      />
    </View>
  );
}

