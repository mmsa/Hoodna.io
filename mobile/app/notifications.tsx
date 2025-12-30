import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Notification } from "@hoodna/shared";

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

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    MESSAGE: "chatbubbles",
    COMMENT: "chatbubble",
    POST_LIKE: "heart",
    VERIFICATION_APPROVED: "checkmark-circle",
    VERIFICATION_REJECTED: "close-circle",
    LISTING_INQUIRY: "bag",
    LISTING_SAVED: "bookmark",
    MENTION: "at",
  };
  return icons[type] || "notifications";
}

function getNotificationColor(type: string): string {
  const colors_map: Record<string, string> = {
    MESSAGE: colors.primary,
    COMMENT: colors.purple,
    POST_LIKE: colors.pink,
    VERIFICATION_APPROVED: colors.success,
    VERIFICATION_REJECTED: colors.error,
    LISTING_INQUIRY: colors.accent,
    LISTING_SAVED: colors.purple,
    MENTION: colors.primary,
  };
  return colors_map[type] || colors.textMuted;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only load if user is approved
    if (user?.status === "APPROVED") {
      loadNotifications();
      loadUnreadCount();
      // Poll for new notifications every 30 seconds (only if approved)
      const interval = setInterval(() => {
        loadNotifications();
        loadUnreadCount();
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user?.status]);

  async function loadNotifications() {
    // Don't make API calls if user is not approved
    if (user?.status !== "APPROVED") {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const data = await apiClient.getNotifications({ limit: 50 });
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error: any) {
      // Stop polling on 403 errors (user not approved)
      if (error?.message?.includes("403") || error?.message?.includes("Forbidden")) {
        console.log("User not approved, stopping notification polling");
        return;
      }
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadUnreadCount() {
    // Don't make API calls if user is not approved
    if (user?.status !== "APPROVED") {
      return;
    }
    
    try {
      const data = await apiClient.getUnreadNotificationCount();
      setUnreadCount(data.unread_count || 0);
    } catch (error: any) {
      // Silently fail on 403 errors (user not approved)
      if (error?.message?.includes("403") || error?.message?.includes("Forbidden")) {
        return;
      }
      console.error("Failed to load unread count:", error);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadNotifications();
    loadUnreadCount();
  }

  async function handleNotificationPress(notification: Notification) {
    if (!notification.read) {
      try {
        await apiClient.markNotificationRead(notification.id);
        await loadNotifications();
        await loadUnreadCount();
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Navigate based on notification type
    if (notification.related_type === "post" && notification.related_id) {
      router.push(`/post/${notification.related_id}`);
    } else if (notification.related_type === "listing" && notification.related_id) {
      router.push(`/listing/${notification.related_id}`);
    } else if (notification.related_type === "message" && notification.related_id) {
      router.push(`/messages/${notification.related_id}`);
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.markAllNotificationsRead();
      await loadNotifications();
      await loadUnreadCount();
      Alert.alert("Success", "All notifications marked as read");
    } catch (error) {
      Alert.alert("Error", "Failed to mark all as read");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header showLogo={true} showBackButton={true} title="Notifications" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading notifications... 🔔
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
        title={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
        rightAction={
          unreadCount > 0
            ? {
                label: "Mark all read",
                onPress: handleMarkAllRead,
                icon: "checkmark-done",
              }
            : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const icon = getNotificationIcon(item.type);
          const iconColor = getNotificationColor(item.type);

          return (
            <TouchableOpacity
              style={{
                backgroundColor: item.read ? colors.backgroundCard : colors.primary + "08",
                marginHorizontal: 16,
                marginVertical: 6,
                borderRadius: 16,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: iconColor,
                borderWidth: item.read ? 1 : 2,
                borderColor: item.read ? colors.border : iconColor,
                shadowColor: item.read ? "#000" : iconColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: item.read ? 0.05 : 0.1,
                shadowRadius: 8,
                elevation: item.read ? 1 : 3,
              }}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: iconColor + "20",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={icon} size={24} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: item.read ? "600" : "700",
                        color: colors.textMain,
                        flex: 1,
                      }}
                    >
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: iconColor,
                        }}
                      />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.textMuted,
                      lineHeight: 20,
                      marginBottom: 4,
                    }}
                  >
                    {item.message}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {formatTime(item.created_at)}
                  </Text>
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
              <Ionicons name="notifications-outline" size={64} color={colors.purple} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textMain, marginBottom: 12, textAlign: "center" }}>
              No notifications yet 🔔
            </Text>
            <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", lineHeight: 24 }}>
              You're all caught up! We'll notify you when there's something new.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

