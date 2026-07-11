import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompoundProvider } from "@/contexts/CompoundContext";
import { ResidentVerificationGuard } from "@/components/resident-verification-guard";
import { DeepLinkHandler } from "@/components/deep-link-handler";
import { I18nManager } from "react-native";
import "../global.css";

// Enable RTL for Arabic
I18nManager.allowRTL(true);
I18nManager.forceRTL(false); // Set to true for Arabic-first

export default function RootLayout() {
  return (
    <AuthProvider>
      <CompoundProvider>
        <ResidentVerificationGuard />
        <DeepLinkHandler />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </CompoundProvider>
    </AuthProvider>
  );
}
