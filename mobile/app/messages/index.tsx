import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  listing_id?: number;
  listing_title?: string;
  last_message?: {
    id: number;
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count: number;
  updated_at: string;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colorList = [
    colors.purple,
    colors.primary,
    colors.success,
    colors.accent,
    colors.error,
    colors.pink,
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorList[Math.abs(hash) % colorList.length];
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadConversations();
    // Poll for new messages every 10 seconds
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadConversations() {
    try {
      const data = await apiClient.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadConversations();
  }

  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  const hasUnread = unreadCount > 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header showLogo={true} showBackButton={true} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading messages... 💬
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header
        showLogo={true}
        showBackButton={true}
        title="Messages"
        rightAction={
          hasUnread
            ? {
                label: `${unreadCount} unread`,
                onPress: () => {},
                disabled: true,
                icon: "notifications",
              }
            : undefined
        }
      />

      {/* Stats Cards */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.primary + "15",
            borderRadius: 12,
            padding: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.primary }}>
            {conversations.length}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Conversations</Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.errorLight + "30",
            borderRadius: 12,
            padding: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.error }}>
            {unreadCount}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Unread</Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.success + "15",
            borderRadius: 12,
            padding: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.success }}>
            {conversations.filter((c) => c.last_message).length}
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Active</Text>
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const hasUnread = item.unread_count > 0;
          const isRecent =
            (new Date().getTime() - new Date(item.updated_at).getTime()) / 3600000 < 24;
          const avatarColor = getAvatarColor(item.other_user_name);
          const initials = getInitials(item.other_user_name);

          return (
            <TouchableOpacity
              style={{
                backgroundColor: colors.backgroundCard,
                marginHorizontal: 16,
                marginVertical: 6,
                borderRadius: 16,
                padding: 16,
                borderWidth: hasUnread ? 2 : 1,
                borderColor: hasUnread ? colors.primary : colors.border,
                shadowColor: hasUnread ? colors.primary : "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: hasUnread ? 0.2 : 0.05,
                shadowRadius: 8,
                elevation: hasUnread ? 4 : 2,
              }}
              onPress={() => router.push(`/messages/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                {/* Avatar */}
                <View style={{ position: "relative" }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: avatarColor,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: hasUnread ? 3 : 2,
                      borderColor: hasUnread ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>
                      {initials}
                    </Text>
                  </View>
                  {hasUnread && (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        backgroundColor: colors.error,
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: colors.backgroundCard,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                        {item.unread_count > 9 ? "9+" : item.unread_count}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: hasUnread ? "700" : "600",
                        color: colors.textMain,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.other_user_name}
                    </Text>
                    {isRecent && (
                      <View
                        style={{
                          backgroundColor: colors.success + "20",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          marginLeft: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "600", color: colors.success }}>
                          Recent
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>
                      {formatTime(item.updated_at)}
                    </Text>
                  </View>

                  {item.listing_title && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 6,
                        gap: 6,
                      }}
                    >
                      <Ionicons name="bag" size={14} color={colors.purple} />
                      <Text
                        style={{ fontSize: 13, color: colors.textMuted, flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.listing_title}
                      </Text>
                    </View>
                  )}

                  {item.last_message && (
                    <View
                      style={{
                        backgroundColor: hasUnread ? colors.primary + "10" : colors.gray50,
                        borderRadius: 12,
                        padding: 10,
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: hasUnread ? colors.textMain : colors.textMuted,
                          fontWeight: hasUnread ? "500" : "400",
                        }}
                        numberOfLines={2}
                      >
                        <Text style={{ fontWeight: "600", color: colors.primary }}>
                          {item.last_message.sender_name}:
                        </Text>{" "}
                        {item.last_message.content}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 32 }}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: colors.purpleLight + "20",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={64} color={colors.purple} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
              No messages yet 💬
            </Text>
            <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
              Start a conversation by messaging a seller from a listing page. Connect with your neighbors and build your community! ✨
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                onPress={() => router.push("/(tabs)/market")}
              >
                <Ionicons name="bag-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>
                  Browse Marketplace
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.backgroundCard,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
                onPress={() => router.push("/(tabs)/home")}
              >
                <Ionicons name="home-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}>
                  Explore Feed
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

