import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ListingCreate } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { uploadToPresignedUrl } from "@/lib/upload";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const { apiClient } = useAuth();
  const router = useRouter();

  async function pickImages() {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert("Image limit", `You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow photo access to add listing images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) return;

    const valid = result.assets.filter((asset) => {
      const supported = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
        asset.mimeType || "image/jpeg",
      );
      const withinLimit = !asset.fileSize || asset.fileSize <= MAX_IMAGE_BYTES;
      return supported && withinLimit;
    });
    if (valid.length !== result.assets.length) {
      Alert.alert(
        "Some images were skipped",
        "Images must be JPG, PNG, or WebP and no larger than 5 MB.",
      );
    }
    setImages((current) => [...current, ...valid].slice(0, MAX_IMAGES));
  }

  async function uploadImages(): Promise<string[]> {
    const token = await SecureStore.getItemAsync("accessToken");
    return Promise.all(
      images.map(async (image, index) => {
        const mimeType = image.mimeType || "image/jpeg";
        const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
        const fileName = image.fileName || `listing-${Date.now()}-${index}.${extension}`;
        const presign = await apiClient.getListingImagePresignedUrl({
          file_name: fileName,
          file_type: mimeType,
        });
        const response = await fetch(image.uri);
        const blob = await response.blob();
        await uploadToPresignedUrl(
          presign.presigned_url,
          blob,
          mimeType,
          token ?? undefined,
        );
        return presign.file_url;
      }),
    );
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    setLoading(true);
    try {
      const imageUrls = await uploadImages();
      const data: ListingCreate = {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        currency: "EGP",
        intent,
        image_urls: imageUrls,
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
                  backgroundColor: intent === int.value ? "#3B82F6" : "#FFFFFF",
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: intent === int.value ? "#3B82F6" : "#E5E7EB",
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

          {/* Images */}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Photos ({images.length}/{MAX_IMAGES})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, marginBottom: 24 }}
          >
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={{ position: "relative" }}>
                <Image
                  source={{ uri: image.uri }}
                  style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: "#E5E7EB" }}
                />
                <TouchableOpacity
                  onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                  accessibilityLabel="Remove image"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                onPress={pickImages}
                accessibilityRole="button"
                accessibilityLabel="Add listing photos"
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: "#3B82F6",
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <Ionicons name="camera-outline" size={26} color="#3B82F6" />
                <Text style={{ color: "#3B82F6", fontSize: 12, fontWeight: "600" }}>Add photos</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Submit Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#3B82F6",
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

