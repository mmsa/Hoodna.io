import { useState, useEffect } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    ITEM: "📦",
    CAR: "🚗",
    PROPERTY: "🏠",
    SERVICE: "🔧",
  };
  return icons[category] || "📦";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    ITEM: "#3B82F6",
    CAR: "#10B981",
    PROPERTY: "#8B5CF6",
    SERVICE: "#F59E0B",
  };
  return colors[category] || "#6B7280";
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadListing();
  }, [id]);

  async function loadListing() {
    try {
      const data = await apiClient.getListing(Number(id));
      setListing(data);
    } catch (error) {
      console.error("Failed to load listing:", error);
      Alert.alert("Error", "Failed to load listing");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  if (loading || !listing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </SafeAreaView>
    );
  }

  const categoryColor = getCategoryColor(listing.category || "ITEM");
  const categoryIcon = getCategoryIcon(listing.category || "ITEM");
  const images = listing.image_urls || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2" }} edges={["top"]}>
      {/* Header with Back Button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Listing</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Images */}
        {images.length > 0 ? (
          <View style={{ position: "relative", height: 300 }}>
            <Image source={{ uri: images[imageIndex] }} style={{ width: width, height: 300 }} resizeMode="cover" />
            {images.length > 1 && (
              <View style={{ position: "absolute", bottom: 16, alignSelf: "center", flexDirection: "row", gap: 8 }}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: idx === imageIndex ? "#FFFFFF" : "#FFFFFF80",
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View
            style={{
              width: width,
              height: 300,
              backgroundColor: "#F3F4F6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 64 }}>{categoryIcon}</Text>
          </View>
        )}

        <View style={{ padding: 16 }}>
          {/* Category Badge */}
          <View
            style={{
              backgroundColor: `${categoryColor}15`,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              alignSelf: "flex-start",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: categoryColor }}>
              {categoryIcon} {listing.category}
            </Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
            {listing.title}
          </Text>

          {/* Price */}
          {listing.price && (
            <Text style={{ fontSize: 28, fontWeight: "bold", color: "#2D6A4F", marginBottom: 16 }}>
              {listing.price.toLocaleString()} {listing.currency || "EGP"}
            </Text>
          )}

          {/* Description */}
          {listing.description && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
                Description
              </Text>
              <Text style={{ fontSize: 15, color: "#4B5563", lineHeight: 22 }}>
                {listing.description}
              </Text>
            </View>
          )}

          {/* Owner Info */}
          {listing.owner_name && (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 4 }}>Listed by</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>{listing.owner_name}</Text>
            </View>
          )}

          {/* Contact Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#2D6A4F",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={() => {
              Alert.alert("Contact", "Contact feature coming soon!");
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>💬 Contact Seller</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

