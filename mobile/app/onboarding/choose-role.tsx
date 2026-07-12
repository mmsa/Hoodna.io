import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { getPostAuthRoute, getRoleOnboardingRoute } from "@/lib/resident-routing";

export default function ChooseRoleScreen() {
  const router = useRouter();
  const { user, loading: userLoading, apiClient, refreshUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if user already has a role
  useEffect(() => {
    if (!userLoading && user && user.role) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, userLoading, router]);

  const handleSelectRole = async (role: string) => {
    if (submitting) return;
    
    setSelectedRole(role);
    setSubmitting(true);

    try {
      // Update user role
      await apiClient.request("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      // Refresh user data to get updated role
      await refreshUser();

      router.replace(
        getRoleOnboardingRoute(
          role as "RESIDENT" | "SERVICE_PROVIDER" | "COMPOUND_MOD",
        ) as any,
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to select role. Please try again."
      );
      setSelectedRole(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    router.replace("/auth");
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ marginBottom: 32, alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
            Choose Your Account Type
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center" }}>
            Select the type of account that best describes you
          </Text>
        </View>

        {/* Resident Card */}
        <TouchableOpacity
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: selectedRole === "RESIDENT" ? colors.primary : "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={() => handleSelectRole("RESIDENT")}
          disabled={submitting}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#DBEAFE",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="home" size={32} color={colors.primary} />
            </View>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center", marginBottom: 8 }}>
            Resident
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 16 }}>
            I live in a compound and want to connect with my neighbors
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Post and comment in community feed
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Buy and sell items in marketplace
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Access verified community content
              </Text>
            </View>
          </View>
          {submitting && selectedRole === "RESIDENT" && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        {/* Service Provider Card */}
        <TouchableOpacity
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: selectedRole === "SERVICE_PROVIDER" ? "#10B981" : "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={() => handleSelectRole("SERVICE_PROVIDER")}
          disabled={submitting}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#D1FAE5",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="construct" size={32} color="#10B981" />
            </View>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center", marginBottom: 8 }}>
            Service Provider
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 16 }}>
            I provide services to residents and want to list my business
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                List services in multiple compounds
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Receive service requests
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Build your reputation with reviews
              </Text>
            </View>
          </View>
          {submitting && selectedRole === "SERVICE_PROVIDER" && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          )}
        </TouchableOpacity>

        {/* Compound Moderator Card */}
        <TouchableOpacity
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: selectedRole === "COMPOUND_MOD" ? "#A855F7" : "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={() => handleSelectRole("COMPOUND_MOD")}
          disabled={submitting}
        >
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#E9D5FF",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="shield-checkmark" size={32} color="#A855F7" />
            </View>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center", marginBottom: 8 }}>
            Compound Moderator
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 16 }}>
            I'm authorized to moderate content for my compound
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#A855F7" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Approve and remove posts
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#A855F7" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Pin announcements
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color="#A855F7" />
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Handle reports and moderation
              </Text>
            </View>
          </View>
          {submitting && selectedRole === "COMPOUND_MOD" && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#A855F7" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: 16 }}>
          Choose carefully so we can guide you through the right setup.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

