import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "@/contexts/LocaleContext";
import { palette, spacing, typography } from "@hoodna/tokens";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getPostAuthRoute, isResidentRole } from "@/lib/resident-routing";
import { LoadingState } from "@/components/ui";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    // Block unapproved residents from all tabs
    if (isResidentRole(user.role) && user.status !== "APPROVED") {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, loading, router]);

  if (loading || !user || (isResidentRole(user.role) && user.status !== "APPROVED")) {
    return (
      <View style={styles.loading}>
        <LoadingState label={t("common.loadingCommunity")} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: spacing[2],
          paddingBottom: spacing[3],
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t("nav.market"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t("nav.services"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "construct" : "construct-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("nav.messages"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  tabItem: {
    minHeight: 44,
  },
  tabLabel: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
  },
});
