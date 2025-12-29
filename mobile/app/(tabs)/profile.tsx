import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { Compound } from "@hoodna/shared";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfileScreen() {
  const { user, logout, apiClient } = useAuth();
  const [loading, setLoading] = useState(false);
  const [compound, setCompound] = useState<Compound | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user?.compound_id) {
      loadCompound();
    }
  }, [user?.compound_id]);

  async function loadCompound() {
    if (!user?.compound_id) return;
    try {
      const compounds = await apiClient.getCompounds({ limit: 200 });
      const foundCompound = compounds.find((c) => c.id === user.compound_id);
      if (foundCompound) {
        setCompound(foundCompound);
      }
    } catch (error) {
      console.error("Failed to load compound:", error);
    }
  }

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
  const statusText = user?.verification_status || "UNVERIFIED";
  const statusDisplay = statusText.toLowerCase().replace("_", " ");

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header with Logo */}
      <Header showLogo={true} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 }}>
          {/* Header Section */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons name="person" size={32} color="#FFFFFF" />
              </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: "#111827",
                marginBottom: 8,
              }}
            >
              Profile
            </Text>
          </View>

          {/* Profile Card */}
            <View
              style={{
                backgroundColor: colors.backgroundCard,
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                borderWidth: 2,
                borderColor: colors.border,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
            {/* Card Header */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827", marginBottom: 4 }}>
                Account Information
              </Text>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>Your profile details</Text>
            </View>

            {/* Avatar and Name */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "bold" }}>
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 4 }}>
                  {user?.name}
                </Text>
                {(user?.role === "ADMIN" || user?.role === "MODERATOR") && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.purple} />
                    <Text style={{ fontSize: 14, color: colors.purple, fontWeight: "500" }}>
                      {user.role}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Account Details */}
            <View style={{ gap: 16 }}>
              {/* Email */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Email</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#111827" }}>
                    {user?.email}
                  </Text>
                </View>
              </View>

              {/* Phone */}
              {user?.phone && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Ionicons name="call-outline" size={20} color="#9CA3AF" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Phone</Text>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#111827" }}>
                      {user.phone}
                    </Text>
                  </View>
                </View>
              )}

              {/* Status */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Status</Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#111827", textTransform: "capitalize" }}>
                    {statusDisplay}
                  </Text>
                </View>
              </View>

              {/* Compound */}
              {compound && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Ionicons name="home-outline" size={20} color="#9CA3AF" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Compound</Text>
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#111827" }}>
                      {compound.name}
                    </Text>
                    {compound.area && (
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                        {compound.area}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
                onPress={() => router.push("/verification")}
                activeOpacity={0.7}
              >
                <Text style={{ color: "#111827", fontSize: 14, fontWeight: "600" }}>
                  Verification Status
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
                onPress={() => router.push("/settings")}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages Card */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 2,
              borderColor: colors.border,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
            onPress={() => router.push("/messages")}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Ionicons name="chatbubbles" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 4 }}>
                Messages 💬
              </Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Connect with neighbors and sellers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Notifications Card */}
          <TouchableOpacity
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 2,
              borderColor: colors.border,
              shadowColor: colors.purple,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
            onPress={() => router.push("/notifications")}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.purple,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.purple,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Ionicons name="notifications" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginBottom: 4 }}>
                Notifications 🔔
              </Text>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Stay updated with your community
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
