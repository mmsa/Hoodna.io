import { useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";

export default function ProviderStatusScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
      return;
    }

    if (user && user.role !== "SERVICE_PROVIDER") {
      router.replace("/onboarding/choose-role");
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading status...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#DBEAFE",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="construct" size={40} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
            Service Provider Status
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center" }}>
            Your verification status
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 16 }}>
            Profile Information
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
            Status: <Text style={{ fontWeight: "600" }}>Pending Review</Text>
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            Your provider profile is being reviewed by our team. You'll be notified once it's approved.
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 16,
          }}
          onPress={() => router.push("/onboarding/provider")}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Complete Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

