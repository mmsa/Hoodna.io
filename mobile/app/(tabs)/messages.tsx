import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { formatRelativeTime } from "@hoodna/i18n";
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

const TAB_KEYS = [
  { value: "all", labelKey: "messages.filterAll" as const },
  { value: "unread", labelKey: "messages.filterUnread" as const },
];

const SORT_KEYS = [
  { value: "recent", labelKey: "messages.sortRecent" as const },
  { value: "unread_first", labelKey: "messages.sortUnreadFirst" as const },
  { value: "name", labelKey: "messages.sortName" as const },
];

function SheetOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: selected ? colors.primary : colors.gray100,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: selected ? "600" : "500",
          color: selected ? "#FFFFFF" : colors.textMain,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function formatTime(dateString: string, locale: "en" | "ar"): string {
  return formatRelativeTime(locale, dateString);
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

export default function MessagesTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [listingOnly, setListingOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();

  useEffect(() => {
    // Only load if user is approved
    if (user?.status === "APPROVED") {
      loadConversations();
      // Poll for new messages every 10 seconds (only if approved)
      const interval = setInterval(loadConversations, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user?.status]);

  async function loadConversations() {
    // Don't make API calls if user is not approved
    if (user?.status !== "APPROVED") {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await apiClient.getConversations();
      setConversations(data);
    } catch (error: any) {
      // Stop polling on 403 errors (user not approved)
      if (error?.message?.includes("403") || error?.message?.includes("Forbidden")) return;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadConversations();
  }

  function clearFilters() {
    setSearchQuery("");
    setSelectedTab("all");
    setSortBy("recent");
    setListingOnly(false);
  }

  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  const sheetFilterCount = [sortBy !== "recent" ? sortBy : "", listingOnly ? "listing" : ""].filter(Boolean).length;

  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    if (selectedTab === "unread") {
      list = list.filter((c) => (c.unread_count || 0) > 0);
    }

    if (listingOnly) {
      list = list.filter((c) => !!c.listing_id || !!c.listing_title);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.other_user_name.toLowerCase().includes(q) ||
          c.listing_title?.toLowerCase().includes(q) ||
          c.last_message?.content.toLowerCase().includes(q)
      );
    }

    if (sortBy === "unread_first") {
      list.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === "name") {
      list.sort((a, b) => a.other_user_name.localeCompare(b.other_user_name));
    } else {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    return list;
  }, [conversations, selectedTab, listingOnly, searchQuery, sortBy]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading {t("messages.title").toLowerCase()}…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header showLogo={true} />

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            {/* Search + filter */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.backgroundWhite,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                }}
              >
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={{
                    flex: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 11,
                    fontSize: 15,
                    color: colors.textMain,
                  }}
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

              <TouchableOpacity
                onPress={() => setShowFilters(true)}
                activeOpacity={0.7}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: sheetFilterCount > 0 ? colors.primary : colors.backgroundWhite,
                  borderWidth: 1,
                  borderColor: sheetFilterCount > 0 ? colors.primary : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={sheetFilterCount > 0 ? "#FFFFFF" : colors.textMain}
                />
                {sheetFilterCount > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>
                      {sheetFilterCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {TAB_KEYS.map((tab) => {
                const selected = selectedTab === tab.value;
                const label =
                  tab.value === "unread" && unreadCount > 0
                    ? `${t("messages.filterUnread")} (${unreadCount})`
                    : t(tab.labelKey);
                return (
                  <TouchableOpacity
                    key={tab.value}
                    onPress={() => setSelectedTab(tab.value)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderBottomWidth: 2,
                      borderBottomColor: selected ? colors.primary : "transparent",
                      marginBottom: -1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: selected ? "700" : "500",
                        color: selected ? colors.primary : colors.textMuted,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active filter summary */}
            {sheetFilterCount > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 10,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {[
                    sortBy !== "recent" ? t(SORT_KEYS.find((o) => o.value === sortBy)?.labelKey ?? "messages.sortRecent") : null,
                    listingOnly ? "Listing chats" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
                    Reset
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Filters sheet */}
            <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
              <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFilters(false)} />
                <View
                  style={{
                    backgroundColor: colors.backgroundWhite,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 28,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.gray300,
                      alignSelf: "center",
                      marginBottom: 16,
                    }}
                  />

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}>Filter & sort</Text>
                    <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>Reset</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Sort by
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
                    {SORT_KEYS.map((opt) => (
                      <SheetOption
                        key={opt.value}
                        label={t(opt.labelKey)}
                        selected={sortBy === opt.value}
                        onPress={() => setSortBy(opt.value)}
                      />
                    ))}
                  </View>

                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Show
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                    <SheetOption
                      label="All chats"
                      selected={!listingOnly}
                      onPress={() => setListingOnly(false)}
                    />
                    <SheetOption
                      label="Listing chats"
                      selected={listingOnly}
                      onPress={() => setListingOnly(true)}
                    />
                  </View>

                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 14,
                      paddingVertical: 15,
                      alignItems: "center",
                    }}
                    onPress={() => setShowFilters(false)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Show results</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        }
        renderItem={({ item }) => {
          const hasUnread = item.unread_count > 0;
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
              }}
              onPress={() => router.push(`/messages/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ position: "relative" }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: avatarColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
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

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: hasUnread ? "700" : "600",
                        color: colors.textMain,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.other_user_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 8 }}>
                      {formatTime(item.updated_at, locale)}
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
                      <Ionicons name="bag-outline" size={13} color={colors.purple} />
                      <Text
                        style={{ fontSize: 12, color: colors.textMuted, flex: 1 }}
                        numberOfLines={1}
                      >
                        {item.listing_title}
                      </Text>
                    </View>
                  )}

                  {item.last_message && (
                    <Text
                      style={{
                        fontSize: 14,
                        color: hasUnread ? colors.textMain : colors.textMuted,
                        fontWeight: hasUnread ? "500" : "400",
                      }}
                      numberOfLines={2}
                    >
                      {item.last_message.content}
                    </Text>
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
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: colors.purpleLight + "20",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={48} color={colors.purple} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain, marginBottom: 8, textAlign: "center" }}>
              {searchQuery.trim() || selectedTab === "unread" || sheetFilterCount > 0
                ? t("messages.noConversations")
                : t("messages.emptyInbox")}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 24 }}>
              {searchQuery.trim() || selectedTab === "unread" || sheetFilterCount > 0
                ? "Try adjusting your search or filters"
                : "Message a seller from a listing to start a conversation"}
            </Text>
            {!searchQuery.trim() && selectedTab === "all" && sheetFilterCount === 0 ? (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderRadius: 14,
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
            ) : (
              <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>
                  Reset filters
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
