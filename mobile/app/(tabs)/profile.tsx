import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Compound } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { useFeature } from "@/contexts/FeatureConfigContext";

interface ProviderProfile {
  provider_status?: string;
  provider_type?: string | null;
  business_name?: string | null;
  service_area_compound_ids?: number[];
  category?: {
    id: number;
    name: string;
    icon?: string;
  } | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatLabel(value?: string | null): string {
  if (!value) return "Not available";
  return value.toLowerCase().replace(/_/g, " ");
}

function formatRole(role?: string): string {
  switch (role) {
    case "SERVICE_PROVIDER":
      return "Service Provider";
    case "COMPOUND_MOD":
      return "Compound Moderator";
    case "ADMIN":
      return "Administrator";
    case "MODERATOR":
      return "Moderator";
    case "RESIDENT":
    case "USER":
      return "Resident";
    default:
      return role || "User";
  }
}

function InfoRow({
  icon,
  label,
  value,
  accentColor = "#9CA3AF",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <Ionicons name={icon} size={20} color={accentColor} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 3 }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textMain, textTransform: "capitalize" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  description,
  color,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.backgroundCard,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
      }}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${color}18`,
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textMain, flex: 1 }}>
            {title}
          </Text>
          {!!badge && (
            <View
              style={{
                backgroundColor: `${color}15`,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color }}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textMuted }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} style={{ marginLeft: 12 }} />
    </TouchableOpacity>
  );
}

type ActionItem = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  route: string;
};

export default function ProfileScreen() {
  const { user, logout, apiClient } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [compound, setCompound] = useState<Compound | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [serviceAreaCompounds, setServiceAreaCompounds] = useState<Compound[]>([]);
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

          if (profile?.service_area_compound_ids?.length) {
            const serviceAreas = profile.service_area_compound_ids
              .map((compoundId: number) => allCompounds.find((item) => item.id === compoundId))
              .filter(Boolean) as Compound[];
            setServiceAreaCompounds(serviceAreas);
          } else {
            setServiceAreaCompounds([]);
          }
          setCompound(null);
          return;
        }

        if (user.compound_id) {
          const activeCompound = allCompounds.find((item) => item.id === user.compound_id) || null;
          setCompound(activeCompound);
        } else {
          setCompound(null);
        }
      } catch (error) {
        console.error("Failed to load profile details:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

  const initials = user?.name ? getInitials(user.name) : "U";
  const verificationStatus = user?.verification_status ? formatLabel(user.verification_status) : "unverified";
  const accountStatus = user?.status ? formatLabel(user.status) : "unknown";
  const accountType = formatRole(user?.role);
  const providerStatus = providerProfile?.provider_status ? formatLabel(providerProfile.provider_status) : null;

  const quickActions = useMemo(() => {
    const actions: ActionItem[] = [
      ...(invitationsEnabled ? [{
        icon: "people-outline" as const,
        title: "Invite neighbours",
        description: "Share your personal invitation and see who joined.",
        color: colors.success,
        route: "/invite-neighbours",
      }] : []),
      {
        icon: "business-outline" as const,
        title: "Local businesses",
        description: "Browse verified businesses and manage your claims.",
        color: colors.accent,
        route: "/businesses",
      },
      {
        icon: "chatbubbles" as const,
        title: "Messages",
        description: "Open your conversations with neighbors, buyers, and providers.",
        color: colors.primary,
        route: "/(tabs)/messages",
      },
      {
        icon: "notifications" as const,
        title: "Notifications",
        description: "Review unread activity and verification updates.",
        color: colors.purple,
        route: "/notifications",
      },
      {
        icon: "bookmark" as const,
        title: "Saved Listings",
        description: "Jump back into the listings you bookmarked from any device.",
        color: "#D97706",
        route: "/saved-listings",
      },
      {
        icon: "settings" as const,
        title: "Settings",
        description: "Update your account information and phone number.",
        color: "#158074",
        route: "/settings",
      },
      {
        icon: "apps" as const,
        title: "All Features",
        description: "Browse every major capability available in Hoodna.",
        color: "#0EA5E9",
        route: "/features",
      },
    ];

    if (user?.role === "SERVICE_PROVIDER") {
      actions.unshift({
        icon: "construct" as const,
        title: "Provider Status",
        description: "Track approval and service-provider verification details.",
        color: colors.accent,
        route: "/provider/status",
      });
    }

    if (user?.role === "COMPOUND_MOD") {
      actions.unshift({
        icon: "shield-checkmark" as const,
        title: "Moderator Status",
        description: "Review your moderator approval state and any admin feedback.",
        color: colors.purple,
        route: "/moderator/status",
      });
    }

    if (user?.role === "ADMIN") {
      actions.unshift({
        icon: "shield" as const,
        title: "Admin Dashboard",
        description: "Approve resident, provider, and moderator applications from mobile.",
        color: colors.error,
        route: "/admin/dashboard",
      });
    }

    return actions;
  }, [invitationsEnabled, user?.role]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header showLogo={true} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 }}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800" }}>{initials}</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: "800", color: colors.textMain, marginBottom: 6 }}>
              {user?.name || "Profile"}
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted }}>{user?.email}</Text>
          </View>

          <View
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 22,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 18,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain, marginBottom: 18 }}>
              Account Information
            </Text>

            <View style={{ gap: 16 }}>
              <InfoRow icon="mail-outline" label="Email" value={user?.email || "Not available"} />
              {user?.phone ? <InfoRow icon="call-outline" label="Phone" value={user.phone} /> : null}
              <InfoRow icon="person-outline" label="Account Type" value={accountType} accentColor={colors.primary} />
              <InfoRow icon="shield-checkmark-outline" label="Account Status" value={accountStatus} accentColor={colors.success} />
              <InfoRow icon="checkmark-done-circle-outline" label="Verification" value={verificationStatus} accentColor={colors.purple} />

              {compound && user?.role !== "SERVICE_PROVIDER" ? (
                <InfoRow
                  icon="home-outline"
                  label="Compound"
                  value={compound.area ? `${compound.name} • ${compound.area}` : compound.name}
                  accentColor={colors.accent}
                />
              ) : null}

              {providerProfile?.provider_type ? (
                <InfoRow icon="briefcase-outline" label="Provider Type" value={formatLabel(providerProfile.provider_type)} accentColor={colors.accent} />
              ) : null}

              {providerProfile?.business_name ? (
                <InfoRow icon="business-outline" label="Business Name" value={providerProfile.business_name} accentColor={colors.accent} />
              ) : null}

              {providerProfile?.category?.name ? (
                <InfoRow icon="pricetags-outline" label="Service Category" value={providerProfile.category.name} accentColor={colors.accent} />
              ) : null}

              {providerStatus ? (
                <InfoRow icon="construct-outline" label="Provider Status" value={providerStatus} accentColor={colors.accent} />
              ) : null}

              {serviceAreaCompounds.length > 0 ? (
                <InfoRow
                  icon="map-outline"
                  label="Service Areas"
                  value={serviceAreaCompounds.map((item) => item.name).join(", ")}
                  accentColor={colors.accent}
                />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "#FFFFFF",
                }}
                activeOpacity={0.82}
                onPress={() => router.push(user?.role === "SERVICE_PROVIDER" ? "/provider/status" : "/verification")}
              >
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                  {user?.role === "SERVICE_PROVIDER" ? "Provider Status" : "Verification"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: "center",
                  backgroundColor: colors.primary,
                }}
                activeOpacity={0.82}
                onPress={() => router.push("/settings")}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain, marginBottom: 14 }}>
            Quick Access
          </Text>
          <View style={{ gap: 14, marginBottom: 18 }}>
            {quickActions.map((action) => (
              <ActionCard
                key={action.title}
                icon={action.icon}
                title={action.title}
                description={action.description}
                color={action.color}
                badge={action.title === "Admin Dashboard" ? "Admin" : providerStatus && action.title === "Provider Status" ? providerStatus : undefined}
                onPress={() => router.push(action.route)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: "#FEF2F2",
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: "#FECACA",
              flexDirection: "row",
              alignItems: "center",
            }}
            activeOpacity={0.82}
            onPress={handleLogout}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: "#FEE2E2",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.error, marginBottom: 4 }}>
                Log out
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: "#991B1B" }}>
                Clear your current session on this device.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
