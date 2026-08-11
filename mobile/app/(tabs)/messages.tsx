import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "@hoodna/i18n";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppBrandBar } from "@/components/AppBrandBar";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function MessagesTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  useEffect(() => {
    if (user?.status === "APPROVED") {
      loadConversations();
      const interval = setInterval(loadConversations, 10000);
      return () => clearInterval(interval);
    }
    setLoading(false);
  }, [user?.status]);

  async function loadConversations() {
    if (user?.status !== "APPROVED") {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await apiClient.getConversations();
      setConversations(data);
    } catch (error: any) {
      if (error?.message?.includes("403") || error?.message?.includes("Forbidden")) return;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredConversations = useMemo(() => {
    let list = [...conversations];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.other_user_name.toLowerCase().includes(q) ||
          c.listing_title?.toLowerCase().includes(q) ||
          c.last_message?.content.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [conversations, searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading messages…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadConversations();
          }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppBrandBar compact style={styles.brandBar} />
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={styles.title}>
                Messages
              </Text>
            </View>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("messages.searchPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.trim() ? (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const hasUnread = item.unread_count > 0;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/messages/${item.id}`)}
              style={styles.row}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.other_user_name)}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
                    {item.other_user_name}
                  </Text>
                  <Text style={styles.time}>
                    {formatRelativeTime(locale, item.updated_at)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[styles.preview, hasUnread && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {item.listing_title
                      ? `${item.listing_title} · ${item.last_message?.content || ""}`
                      : item.last_message?.content || "No messages yet"}
                  </Text>
                  {hasUnread ? <View style={styles.unreadDot} /> : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? t("messages.noConversations") : t("messages.emptyInbox")}
            </Text>
            <Text style={styles.emptyBody}>
              {searchQuery.trim()
                ? "Try a different name or message"
                : "Message a seller from a listing to start a conversation"}
            </Text>
            {!searchQuery.trim() ? (
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push("/(tabs)/market")}
              >
                <Text style={styles.emptyCtaText}>Browse Marketplace</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: typography.size.body,
    color: colors.textMuted,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  brandBar: {
    marginBottom: spacing[3],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  title: {
    color: colors.text,
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    minHeight: 48,
    marginBottom: spacing[3],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.textMain,
    paddingVertical: spacing[3],
  },
  listContent: {
    paddingBottom: spacing[10],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    gap: spacing[3],
    minHeight: 84,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.textMain,
  },
  nameUnread: {
    fontWeight: typography.weight.bold,
  },
  time: {
    marginLeft: spacing[2],
    fontSize: typography.size.caption,
    color: colors.textMuted,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  preview: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.textMuted,
  },
  previewUnread: {
    color: colors.textMain,
    fontWeight: typography.weight.medium,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing[5] + 56 + spacing[3],
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[12],
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
  },
  emptyTitle: {
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
    color: colors.textMain,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontSize: typography.size.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: typography.lineHeight.bodySmall,
    marginBottom: spacing[5],
  },
  emptyCta: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.button,
  },
  emptyCtaText: {
    color: "#FFFFFF",
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
});
