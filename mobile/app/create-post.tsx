import { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { PostCreate } from "@hoodna/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

const POST_CATEGORIES = [
  { value: "GENERAL", label: "General", icon: "💬", color: "#6B7280" },
  { value: "HELP", label: "Help", icon: "🆘", color: "#F59E0B" },
  { value: "LOST_FOUND", label: "Lost & Found", icon: "🔍", color: "#EC4899" },
  { value: "EVENT", label: "Event", icon: "📅", color: "#158074" },
  { value: "MARKETPLACE", label: "Marketplace", icon: "🛒", color: "#10B981" },
  { value: "DISCUSSION", label: "Discussion", icon: "💭", color: "#707070" },
  { value: "ALERT", label: "Alert", icon: "⚠️", color: "#EF4444" },
  { value: "POLL", label: "Poll", icon: "📊", color: "#158074" },
];

export default function CreatePostScreen() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const { apiClient, user } = useAuth();
  const postingEnabled = useFeature("community_posting");
  const { track } = useTelemetry();
  const router = useRouter();

  async function handleSubmit() {
    if (!postingEnabled) {
      Alert.alert("Posting is paused", "Community posting is temporarily unavailable.");
      return;
    }
    if (!content.trim()) {
      Alert.alert("Error", "Please enter some content");
      return;
    }

    if (!category) {
      Alert.alert("Error", "Please select a category");
      return;
    }
    const options = pollOptions.map((label) => label.trim()).filter(Boolean);
    if (category === "POLL" && options.length < 2) {
      Alert.alert("Poll options required", "Add at least two options.");
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
        ...(category === "POLL"
          ? { poll: { question: pollQuestion.trim() || undefined, options: options.map((label) => ({ label })) } }
          : {}),
      };

      const post = await apiClient.createPost(data);
      track("post_created", { post_id: post.id, category, community_id: user.compound_id });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top"]}>
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
          {category === "POLL" ? (
            <View style={{ marginBottom: 20, gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>Poll</Text>
              <TextInput
                style={{ backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 12, color: "#1B1B1B" }}
                placeholder="Question (optional)"
                placeholderTextColor="#9CA3AF"
                value={pollQuestion}
                onChangeText={setPollQuestion}
              />
              {pollOptions.map((option, index) => (
                <View key={index} style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 12, color: "#1B1B1B" }}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor="#9CA3AF"
                    value={option}
                    onChangeText={(value) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
                  />
                  {pollOptions.length > 2 ? <TouchableOpacity onPress={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ justifyContent: "center", padding: 8 }}><Ionicons name="close" size={20} color="#6B7280" /></TouchableOpacity> : null}
                </View>
              ))}
              {pollOptions.length < 4 ? <TouchableOpacity onPress={() => setPollOptions((current) => [...current, ""])}><Text style={{ color: "#158074", fontWeight: "600" }}>+ Add option</Text></TouchableOpacity> : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={{
              backgroundColor: "#158074",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={handleSubmit}
            disabled={loading || !postingEnabled}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{postingEnabled ? "Post" : "Posting paused"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

