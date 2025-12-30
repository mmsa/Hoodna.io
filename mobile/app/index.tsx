import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [minSplashShown, setMinSplashShown] = useState(false);

  // Show splash for minimum 500ms for better UX (prevents flash)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashShown(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only navigate after minimum splash time AND auth is loaded
    if (!loading && minSplashShown) {
      if (user) {
        // Check if user has selected a role
        if (!user.role) {
          router.replace("/onboarding/choose-role");
        } else if (user.role === "RESIDENT" || user.role === "USER") {
          if (!user.compound_id) {
            router.replace("/onboarding/compound-select");
          } else if (user.status !== "APPROVED") {
            router.replace("/verification");
          } else {
            router.replace("/(tabs)/home");
          }
        } else if (user.role === "SERVICE_PROVIDER") {
          router.replace("/provider/status");
        } else if (user.role === "COMPOUND_MOD") {
          router.replace("/moderator/status");
        } else {
          router.replace("/(tabs)/home");
        }
      } else {
        router.replace("/auth");
      }
    }
  }, [loading, user, minSplashShown, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: '#3B82F6',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          shadowColor: '#9333EA',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' }}>🏠</Text>
      </View>
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#2563EB', marginBottom: 16 }}>eljiran.com</Text>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

