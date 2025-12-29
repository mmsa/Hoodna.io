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
        router.replace("/auth");
      }
    }
  }, [loading, user]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F7F2' }}>
      <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#2D6A4F', marginBottom: 16 }}>Hoodna</Text>
      <ActivityIndicator size="large" color="#2D6A4F" />
    </View>
  );
}

