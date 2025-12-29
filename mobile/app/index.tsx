import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.compound_id) {
          router.replace("/(tabs)/home");
        } else {
          router.replace("/onboarding/compound-select");
        }
      } else {
        router.replace("/auth/phone-login");
      }
    }
  }, [loading, user]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-4xl font-bold text-primary mb-4">Hoodna</Text>
      <ActivityIndicator size="large" color="#2D6A4F" />
    </View>
  );
}

