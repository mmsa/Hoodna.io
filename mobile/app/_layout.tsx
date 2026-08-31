import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompoundProvider } from "@/contexts/CompoundContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ResidentVerificationGuard } from "@/components/resident-verification-guard";
import { DeepLinkHandler } from "@/components/deep-link-handler";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { AppVersionBadge } from "@/components/app-version-badge";
import { AppLocaleProvider } from "@/contexts/LocaleContext";
import { FeatureConfigProvider } from "@/contexts/FeatureConfigContext";
import { TelemetryProvider } from "@/contexts/TelemetryContext";
import "../global.css";

export default function RootLayout() {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <FeatureConfigProvider>
          <AppErrorBoundary>
            <AppLocaleProvider>
              <CompoundProvider>
                <NotificationsProvider>
                  <ResidentVerificationGuard />
                  <DeepLinkHandler />
                  <StatusBar style="auto" />
                  <Stack screenOptions={{ headerShown: false }} />
                  <AppVersionBadge />
                </NotificationsProvider>
              </CompoundProvider>
            </AppLocaleProvider>
          </AppErrorBoundary>
        </FeatureConfigProvider>
      </TelemetryProvider>
    </AuthProvider>
  );
}
