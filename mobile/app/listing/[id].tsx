import { useState, useEffect } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Listing } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ReportModal } from "@/components/ReportModal";

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
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

  async function handleSave() {
    if (!user) {
      Alert.alert("Login Required", "Please login to save listings");
      return;
    }

    setSaving(true);
    try {
      if (listing?.is_saved) {
        await apiClient.unsaveListing(Number(id));
      } else {
        await apiClient.saveListing(Number(id));
      }
      // Reload listing to get updated is_saved status
      await loadListing();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update saved status");
    } finally {
      setSaving(false);
    }
  }

  async function handleMessage() {
    if (!user) {
      Alert.alert("Login Required", "Please login to message sellers");
      return;
    }

    if (!listing?.owner_id) {
      Alert.alert("Error", "Owner information not available");
      return;
    }

    try {
      // Create a new message/conversation
      await apiClient.sendMessage({
        recipient_id: listing.owner_id,
        content: `Hi! I'm interested in your listing: ${listing.title}`,
        listing_id: listing.id,
      });
      
      // Fetch conversations to find the new one (only if user is approved)
      if (user?.status !== "APPROVED") {
        Alert.alert("Verification Required", "Please complete verification to send messages");
        return;
      }
      const conversations = await apiClient.getConversations();
      const conversation = conversations.find(
        (c: any) => c.other_user_id === listing.owner_id && c.listing_id === listing.id
      );
      
      if (conversation) {
        router.push(`/messages/${conversation.id}`);
      } else {
        // If conversation not found, go to messages list
        router.push("/messages");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send message");
    }
  }

  async function handleShare() {
    try {
      const result = await Share.share({
        message: `${listing?.title}\n${listing?.description || ""}\nPrice: ${listing?.price} ${listing?.currency}`,
        title: listing?.title,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }

  if (loading || !listing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 16, color: "#6B7280" }}>Loading listing...</Text>
      </SafeAreaView>
    );
  }

  const categoryColor = getCategoryColor(listing.category || "ITEM");
  const categoryIcon = getCategoryIcon(listing.category || "ITEM");
  const images = listing.image_urls || [];
  const isOwner = user && listing.owner_id === user.id;
  const isModerator = user && (user.role === "MODERATOR" || user.role === "ADMIN");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }} edges={["top"]}>
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
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setImageIndex(idx)}
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
          {/* Title */}
          <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827", marginBottom: 12 }}>
            {listing.title}
          </Text>

          {/* Price */}
          {listing.price && (
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#10B981", marginBottom: 16 }}>
              {listing.price.toLocaleString()} {listing.currency || "EGP"}
            </Text>
          )}

          {/* Category & Intent Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <View
              style={{
                backgroundColor: `${categoryColor}15`,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: categoryColor,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: categoryColor }}>
                {categoryIcon} {listing.category}
              </Text>
            </View>
            {listing.intent && (
              <View
                style={{
                  backgroundColor: listing.intent === "SELL" ? "#FEE2E2" : "#DBEAFE",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: listing.intent === "SELL" ? "#EF4444" : "#3B82F6",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: listing.intent === "SELL" ? "#DC2626" : "#1E40AF",
                  }}
                >
                  {listing.intent === "SELL" ? "For Sale" : "For Rent"}
                </Text>
              </View>
            )}
          </View>

          {/* Details */}
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
            {listing.compound_name && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Ionicons name="location" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Location</Text>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                    {listing.compound_name}
                  </Text>
                </View>
              </View>
            )}

            {listing.owner_name && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Ionicons name="person" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Listed by</Text>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                    {listing.owner_name}
                  </Text>
                </View>
              </View>
            )}

            {listing.created_at && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="calendar" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Listed on</Text>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                    {formatDate(listing.created_at)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {listing.description && (
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
              <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
                Description
              </Text>
              <Text style={{ fontSize: 15, color: "#4B5563", lineHeight: 22 }}>
                {listing.description}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={{ gap: 12 }}>
            {/* Message Seller Button */}
            {!isOwner && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  shadowColor: "#3B82F6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                onPress={handleMessage}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Message Seller</Text>
              </TouchableOpacity>
            )}

            {/* Save/Unsave Button */}
            <TouchableOpacity
              style={{
                backgroundColor: listing.is_saved ? "#EF4444" : "#FFFFFF",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                borderWidth: listing.is_saved ? 0 : 1,
                borderColor: "#E5E7EB",
              }}
              onPress={handleSave}
              disabled={saving || !user}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={listing.is_saved ? "#FFFFFF" : "#3B82F6"} />
              ) : (
                <>
                  <Ionicons
                    name={listing.is_saved ? "heart" : "bookmark-outline"}
                    size={20}
                    color={listing.is_saved ? "#FFFFFF" : "#3B82F6"}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: listing.is_saved ? "#FFFFFF" : "#3B82F6",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    {listing.is_saved ? "Saved" : "Save Listing"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Promote Button (Owner Only) */}
            {isOwner && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#9333EA",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
                onPress={() => {
                  Alert.alert("Promote Listing", "Promotion feature coming soon!");
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trending-up" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Promote Listing</Text>
              </TouchableOpacity>
            )}

            {/* Share Button */}
            <TouchableOpacity
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
              <Text style={{ color: "#3B82F6", fontSize: 16, fontWeight: "600" }}>Share Listing</Text>
            </TouchableOpacity>

            {/* Moderator Actions */}
            {isModerator && (
              <>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#FEE2E2",
                  }}
                  onPress={() => {
                    Alert.alert(
                      "Ban User",
                      `Are you sure you want to ban ${listing.owner_name}?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Ban",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiClient.banUser(listing.owner_id, "Moderator action");
                              Alert.alert("Success", "User has been banned");
                            } catch (error: any) {
                              Alert.alert("Error", error.message || "Failed to ban user");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="ban-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "600" }}>Ban User</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#FEE2E2",
                  }}
                  onPress={() => {
                    Alert.alert(
                      "Delete Listing",
                      "Are you sure you want to delete this listing?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await apiClient.deleteListing(listing.id);
                              Alert.alert("Success", "Listing deleted successfully");
                              router.back();
                            } catch (error: any) {
                              Alert.alert("Error", error.message || "Failed to delete listing");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "600" }}>Delete Listing</Text>
                </TouchableOpacity>
              </>
            )}
            {/* Report Button */}
            {!isOwner && !isModerator && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#FEE2E2",
                }}
                onPress={() => setShowReportModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="flag-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "600" }}>Report Listing</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedType="listing"
        reportedId={listing.id}
        reportedTitle={listing.title}
      />
    </SafeAreaView>
  );
}
