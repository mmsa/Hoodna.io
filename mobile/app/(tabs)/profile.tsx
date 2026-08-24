import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import type { Compound } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { Avatar } from "@/components/ui";
import { AppBrandBar } from "@/components/AppBrandBar";
import { ProfileSetupCard } from "@/components/profile-setup-card";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { uploadLocalFileToPresignedUrl } from "@/lib/upload";
import { isSupportedImageType, pickImageSource } from "@/lib/pick-media";
import { formatCompoundName } from "@/utils/formatCompound";

interface ProviderProfile {
  provider_status?: string;
  business_name?: string | null;
}

export default function ProfileScreen() {
  const { user, logout, apiClient, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [compound, setCompound] = useState<Compound | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const invitationsEnabled = useFeature("invitations");

  useEffect(() => {
    let cancelled = false;

    async function loadProfileDetails() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const allCompounds = await apiClient.getCompounds({ limit: 200 });
        if (cancelled) return;

        if (user.role === "SERVICE_PROVIDER") {
          const profile = await apiClient.getProviderProfile().catch(() => null);
          if (cancelled) return;
          setProviderProfile(profile);
          setCompound(null);
          return;
        }

        if (user.compound_id) {
          setCompound(allCompounds.find((item) => item.id === user.compound_id) || null);
        } else {
          setCompound(null);
        }
      } catch (error) {
        console.error("Failed to load profile details:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfileDetails();
    return () => {
      cancelled = true;
    };
  }, [apiClient, user]);

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth");
        },
      },
    ]);
  }

  async function pickAvatar() {
    const image = await pickImageSource({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      title: "Profile picture",
    });
    if (!image) return;

    if (!isSupportedImageType(image.mimeType)) {
      Alert.alert("Unsupported photo", "Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (image.fileSize && image.fileSize > 5 * 1024 * 1024) {
      Alert.alert("Photo too large", "Profile pictures must be 5 MB or smaller.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const presign = await apiClient.getAvatarPresignedUrl({
        file_name: image.fileName,
        file_type: image.mimeType,
      });
      const token = await SecureStore.getItemAsync("accessToken");
      await uploadLocalFileToPresignedUrl(
        presign.presigned_url,
        {
          uri: image.uri,
          mimeType: image.mimeType,
          fileName: image.fileName,
        },
        token ?? undefined,
      );
      await apiClient.updateAvatar(presign.file_url);
      await refreshUser();
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Could not update your profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  const verified = user?.verification_status === "APPROVED";
  const subtitle =
    user?.role === "SERVICE_PROVIDER"
      ? providerProfile?.business_name || "Service provider"
      : compound
        ? `${formatCompoundName(compound.name)}${verified ? " · Verified neighbour" : ""}`
        : verified
          ? "Verified neighbour"
          : "Neighbour";

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppBrandBar compact style={styles.loadingBrand} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const shortcuts = [
    {
      key: "saved",
      label: "Saved",
      icon: "bookmark-outline" as const,
      route: "/saved-listings",
    },
    ...(invitationsEnabled
      ? [
          {
            key: "invites",
            label: "Invites",
            icon: "people-outline" as const,
            route: "/invite-neighbours",
          },
        ]
      : [
          {
            key: "businesses",
            label: "Local",
            icon: "business-outline" as const,
            route: "/businesses",
          },
        ]),
    {
      key: "settings",
      label: "Settings",
      icon: "settings-outline" as const,
      route: "/settings",
    },
  ];

  const activityRows = [
    ...(user?.role === "ADMIN" || user?.role === "MODERATOR"
      ? [{ label: "Admin dashboard", icon: "shield-outline" as const, route: "/admin/dashboard" }]
      : []),
    ...(user?.role === "SERVICE_PROVIDER"
      ? [{ label: "Provider status", icon: "construct-outline" as const, route: "/provider/status" }]
      : []),
    ...(user?.role === "COMPOUND_MOD"
      ? [{ label: "Moderator status", icon: "shield-checkmark-outline" as const, route: "/moderator/status" }]
      : []),
    { label: "Notifications", icon: "notifications-outline" as const, route: "/notifications" },
    { label: "Local businesses", icon: "storefront-outline" as const, route: "/businesses" },
    { label: "All features", icon: "apps-outline" as const, route: "/features" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppBrandBar compact style={styles.brandBar} />
        <ProfileSetupCard />
        <View style={styles.hero}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            disabled={uploadingAvatar}
            onPress={pickAvatar}
            style={styles.avatarWrap}
          >
            <Avatar
              name={user?.name || "Profile"}
              fileUrl={user?.avatar_url}
              apiClient={apiClient}
              size={96}
            />
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name || "Profile"}</Text>
          <View style={styles.subtitleRow}>
            {verified ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            ) : null}
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.shortcutRow}>
          {shortcuts.map((item) => (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              onPress={() => router.push(item.route)}
              style={styles.shortcut}
            >
              <View style={styles.shortcutIcon}>
                <Ionicons name={item.icon} size={24} color={colors.primary} />
              </View>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Your activity</Text>
        <View style={styles.activityCard}>
          {activityRows.map((row, index) => (
            <TouchableOpacity
              key={row.route + row.label}
              activeOpacity={0.75}
              onPress={() => router.push(row.route)}
              style={[
                styles.activityRow,
                index < activityRows.length - 1 && styles.activityRowBorder,
              ]}
            >
              <Ionicons name={row.icon} size={20} color={colors.primary} />
              <Text style={styles.activityLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.surface },
  centered: { alignItems: "center", justifyContent: "center" },
  content: {
    paddingBottom: spacing[12],
  },
  brandBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
  },
  loadingBrand: {
    alignSelf: "stretch",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    marginBottom: spacing[6],
  },
  hero: {
    alignItems: "center",
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    paddingHorizontal: spacing[5],
    backgroundColor: palette.primarySoft,
  },
  avatarWrap: {
    marginBottom: spacing[4],
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: palette.primarySoft,
  },
  name: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    color: colors.textMain,
    marginBottom: spacing[1],
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.textMuted,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  },
  shortcut: {
    flex: 1,
    alignItems: "center",
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.xl,
    paddingVertical: spacing[5],
    minHeight: 104,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  shortcutLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.textMain,
  },
  sectionTitle: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
    color: colors.textMain,
  },
  activityCard: {
    marginHorizontal: spacing[5],
    borderRadius: radii.xl,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: 56,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  activityLabel: {
    flex: 1,
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.textMain,
  },
  logout: {
    marginTop: spacing[6],
    marginHorizontal: spacing[5],
    alignItems: "center",
    paddingVertical: spacing[4],
  },
  logoutText: {
    color: colors.error,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
});
