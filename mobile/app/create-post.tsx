import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { PostCreate } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const POST_CATEGORIES = [
  { value: "GENERAL", label: "General", icon: "💬", color: "#6B7280" },
  { value: "HELP", label: "Help", icon: "🆘", color: "#F59E0B" },
  { value: "LOST_FOUND", label: "Lost & Found", icon: "🔍", color: "#EC4899" },
  { value: "EVENT", label: "Event", icon: "📅", color: "#6366F1" },
  { value: "MARKETPLACE", label: "Marketplace", icon: "🛒", color: "#10B981" },
  { value: "DISCUSSION", label: "Discussion", icon: "💭", color: "#8B5CF6" },
  { value: "ALERT", label: "Alert", icon: "⚠️", color: "#EF4444" },
];

export default function CreatePostScreen() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    if (!content.trim()) {
      Alert.alert("Error", "Please enter some content");
      return;
    }

    if (!category) {
      Alert.alert("Error", "Please select a category");
      return;
    }

    if (!user?.compound_id) {
      Alert.alert("Error", "Please select a compound first");
      return;
    }

    setLoading(true);
    try {
      const data: PostCreate = {
        content: content.trim(),
        category: category as any,
        is_urgent: isUrgent || category === "ALERT", // Auto-set urgent for ALERT category
      };

      await apiClient.createPost(data);
      Alert.alert("Success", "Post created successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create post");
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Create Post</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>

          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            What's on your mind?
          </Text>
          
          {/* Category Selection - REQUIRED */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 12 }}>
              Category <Text style={{ color: "#EF4444" }}>*</Text>
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {POST_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => {
                    setCategory(cat.value);
                    if (cat.value === "ALERT") {
                      setIsUrgent(true); // Auto-set urgent for alerts
                    }
                  }}
                  style={{
                    backgroundColor: category === cat.value ? cat.color : "#F3F4F6",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: category === cat.value ? cat.color : "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: category === cat.value ? "#FFFFFF" : "#374151",
                    }}
                  >
                    {cat.icon} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Urgent Toggle - Only show if not ALERT category */}
          {category !== "ALERT" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#FFFFFF",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                    Mark as Urgent
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>
                    This post will appear in the Alerts section
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsUrgent(!isUrgent)}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isUrgent ? "#EF4444" : "#D1D5DB",
                  justifyContent: "center",
                  paddingHorizontal: 2,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "#FFFFFF",
                    alignSelf: isUrgent ? "flex-end" : "flex-start",
                  }}
                />
              </TouchableOpacity>
            </View>
          )}

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
              minHeight: 150,
              textAlignVertical: "top",
            }}
            placeholder="Share something with your community..."
            placeholderTextColor="#9CA3AF"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={8}
            autoFocus
          />

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
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

