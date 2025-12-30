import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Image } from "react-native";
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
      <Image
        source={require('@/assets/logo_light.jpg')}
        style={{
          width: 200,
          height: 80,
          marginBottom: 16,
          resizeMode: 'contain',
        }}
      />
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

