import { useEffect, useState } from "react";
import { View, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { BrandWordmark } from "@/components/BrandWordmark";
import { getPostAuthRoute } from "@/lib/resident-routing";

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
        router.replace(getPostAuthRoute(user) as any);
      } else {
        router.replace("/auth");
      }
    }
  }, [loading, user, minSplashShown, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F8F1' }}>
      <Image
        source={require("@/assets/icon.png")}
        style={{
          width: 88,
          height: 88,
          marginBottom: 12,
          resizeMode: "contain",
          borderRadius: 20,
        }}
      />
      <BrandWordmark compact tone="dark" />
      <ActivityIndicator size="large" color="#158074" style={{ marginTop: 20 }} />
    </View>
  );
}

