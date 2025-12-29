import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ListingCreate } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { value: "ITEM", label: "📦 Item", color: "#3B82F6" },
  { value: "CAR", label: "🚗 Car", color: "#10B981" },
  { value: "PROPERTY", label: "🏠 Property", color: "#8B5CF6" },
  { value: "SERVICE", label: "🔧 Service", color: "#F59E0B" },
];

const INTENTS = [
  { value: "SELL", label: "Sell" },
  { value: "RENT", label: "Rent" },
];

export default function CreateListingScreen() {
  const [category, setCategory] = useState<"PROPERTY" | "CAR" | "ITEM" | "SERVICE">("ITEM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [intent, setIntent] = useState<"SELL" | "RENT">("SELL");
  const [loading, setLoading] = useState(false);
  const { apiClient } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    setLoading(true);
    try {
      const data: ListingCreate = {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        intent,
        image_urls: [], // TODO: Add image upload
      };

      await apiClient.createListing(data);
      Alert.alert("Success", "Listing created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  }

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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Create Listing</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>

          {/* Category */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Category
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={{
                  backgroundColor: category === cat.value ? cat.color : "#FFFFFF",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: category === cat.value ? cat.color : "#E5E7EB",
                }}
                onPress={() => setCategory(cat.value as any)}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: category === cat.value ? "#FFFFFF" : "#111827",
                  }}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Intent */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Intent
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {INTENTS.map((int) => (
              <TouchableOpacity
                key={int.value}
                style={{
                  flex: 1,
                  backgroundColor: intent === int.value ? "#2D6A4F" : "#FFFFFF",
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: intent === int.value ? "#2D6A4F" : "#E5E7EB",
                  alignItems: "center",
                }}
                onPress={() => setIntent(int.value as any)}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: intent === int.value ? "#FFFFFF" : "#111827",
                  }}
                >
                  {int.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Title *
          </Text>
          <TextInput
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              marginBottom: 24,
              color: "#1B1B1B",
            }}
            placeholder="Enter listing title"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Description
          </Text>
          <TextInput
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              marginBottom: 24,
              color: "#1B1B1B",
              minHeight: 100,
              textAlignVertical: "top",
            }}
            placeholder="Describe your listing..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          {/* Price */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Price (EGP)
          </Text>
          <TextInput
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              marginBottom: 24,
              color: "#1B1B1B",
            }}
            placeholder="Enter price"
            placeholderTextColor="#9CA3AF"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#2D6A4F",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Create Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

