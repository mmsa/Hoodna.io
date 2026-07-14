import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { formatRelativeTime } from "@hoodna/i18n";
import { colors } from "@/constants/colors";
import { getNotificationRoute, Notification, NotificationListResponse } from "@hoodna/shared";
import { useTelemetry } from "@/contexts/TelemetryContext";

function formatTime(dateString: string, locale: "en" | "ar"): string {
  return formatRelativeTime(locale, dateString);
}

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    MESSAGE: "chatbubbles",
    COMMENT: "chatbubble",
    POST_LIKE: "heart",
    VERIFICATION_APPROVED: "checkmark-circle",
    VERIFICATION_REJECTED: "close-circle",
    VERIFICATION_REQUEST_MORE: "alert-circle",
    LISTING_INQUIRY: "bag",
    LISTING_SAVED: "bookmark",
    MENTION: "at",
  };
  return icons[type] || "notifications";
}

function getNotificationColor(type: string): string {
  const palette: Record<string, string> = {
    MESSAGE: colors.primary,
    COMMENT: colors.purple,
    POST_LIKE: colors.pink,
    VERIFICATION_APPROVED: colors.success,
    VERIFICATION_REJECTED: colors.error,
    VERIFICATION_REQUEST_MORE: colors.accent,
    LISTING_INQUIRY: colors.accent,
    LISTING_SAVED: colors.purple,
    MENTION: colors.primary,
  };
  return palette[type] || colors.textMuted;
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.backgroundCard,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#FFFFFF" : colors.textMain }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const { track } = useTelemetry();
  const { t, locale } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busyNotificationId, setBusyNotificationId] = useState<number | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiClient.getNotifications({
        limit: 50,
        unread_only: filter === "unread",
      });
      const response = data as NotificationListResponse;
      setNotifications(response.items || []);
      setUnreadCount(response.unread_count || 0);
    } catch (error: any) {
      console.error("Failed to load notifications:", error);
      if (error?.message) {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiClient, filter]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiClient.getUnreadNotificationCount();
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Failed to load unread notification count:", error);
    }
  }, [apiClient]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadNotifications();
    loadUnreadCount();

    const interval = setInterval(() => {
      loadNotifications();
      loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadNotifications, loadUnreadCount, user]);

  const stats = useMemo(() => {
    const unreadItems = notifications.filter((item) => !item.read).length;
    const readItems = notifications.length - unreadItems;
    return {
      total: notifications.length,
      unread: unreadItems,
      read: readItems,
    };
  }, [notifications]);

  async function handleNotificationPress(notification: Notification) {
    try {
      if (!notification.read) {
        await apiClient.markNotificationRead(notification.id);
      }
      track("notification_opened", { notification_id: notification.id, notification_type: notification.type });
      const destination = getNotificationRoute(notification);
      if (destination.type === "post") {
        router.push(`/post/${destination.id}`);
      } else if (destination.type === "listing") {
        router.push(`/listing/${destination.id}`);
      } else if (destination.type === "business") {
        router.push(`/businesses/${destination.slug}`);
      } else if (destination.type === "digest") {
        router.push("/digest");
      } else if (notification.related_type === "message" && notification.related_id) {
        router.push(`/messages/${notification.related_id}`);
      } else if (notification.type.startsWith("VERIFICATION")) {
        router.push("/verification");
      }

      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error("Failed to open notification:", error);
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.markAllNotificationsRead();
      loadNotifications();
      loadUnreadCount();
      Alert.alert(t("common.success"), t("notifications.markAllRead"));
    } catch (error) {
      Alert.alert(t("common.error"), t("common.error"));
    }
  }

  async function handleDelete(notificationId: number) {
    try {
      setBusyNotificationId(notificationId);
      await apiClient.deleteNotification(notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      Alert.alert("Error", "Failed to delete notification");
    } finally {
      setBusyNotificationId(null);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} showBackButton={true} title={t("notifications.title")} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 8 }}>
            {t("auth.pleaseSignIn")}
          </Text>
          <Text style={{ fontSize: 14, textAlign: "center", color: colors.textMuted }}>
            Notifications are only available for signed-in users.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} showBackButton={true} title={t("notifications.title")} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            {t("common.loading")}
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
        title={unreadCount > 0 ? `${t("notifications.title")} (${unreadCount})` : t("notifications.title")}
        rightAction={
          unreadCount > 0
            ? {
                label: t("notifications.markAllRead"),
                onPress: handleMarkAllRead,
                icon: "checkmark-done",
              }
            : undefined
        }
      />

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.backgroundCard,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textMain }}>{stats.total}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Loaded</Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: `${colors.primary}12`,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>{unreadCount}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Unread</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <FilterChip label={t("notifications.filterAll")} active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterChip label={t("notifications.filterUnread")} active={filter === "unread"} onPress={() => setFilter("unread")} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
              loadUnreadCount();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.backgroundCard,
              padding: 26,
              alignItems: "center",
            }}
          >
            <Ionicons name="notifications-off-outline" size={38} color={colors.textMuted} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginTop: 12, marginBottom: 8 }}>
              {t("notifications.empty")}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: "center" }}>
              {t("notifications.emptyDesc")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = getNotificationIcon(item.type);
          const iconColor = getNotificationColor(item.type);

          return (
            <View
              style={{
                backgroundColor: item.read ? colors.backgroundCard : `${iconColor}10`,
                marginHorizontal: 16,
                marginVertical: 6,
                borderRadius: 18,
                padding: 16,
                borderLeftWidth: 4,
                borderLeftColor: iconColor,
                borderWidth: 1,
                borderColor: item.read ? colors.border : `${iconColor}30`,
              }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", gap: 12 }}
                  activeOpacity={0.8}
                  onPress={() => handleNotificationPress(item)}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: `${iconColor}18`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={icon} size={24} color={iconColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: item.read ? "600" : "800",
                          color: colors.textMain,
                          flex: 1,
                        }}
                      >
                        {item.title}
                      </Text>
                      {!item.read ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: iconColor,
                          }}
                        />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: 8 }}>
                      {item.message}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: iconColor }}>{formatTime(item.created_at, locale)}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  activeOpacity={0.82}
                  onPress={() =>
                    Alert.alert("Delete notification", "Remove this notification from your list?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDelete(item.id),
                      },
                    ])
                  }
                  disabled={busyNotificationId === item.id}
                >
                  {busyNotificationId === item.id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
