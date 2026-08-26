import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { getPostAuthRoute, needsContactVerification } from "@/lib/resident-routing";
import { SignOutButton } from "@/components/sign-out-button";

export default function VerifyContactScreen() {
  const router = useRouter();
  const { user, loading: userLoading, apiClient, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  const needsPhone = user?.phone_verified === false;
  const needsEmail = user?.email_verified === false;
  const placeholderEmail = Boolean(user?.email?.endsWith("@hoodna.local"));

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (!needsContactVerification(user)) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, userLoading, router]);

  async function afterVerify() {
    const refreshed = await refreshUser();
    if (refreshed && !needsContactVerification(refreshed)) {
      router.replace(getPostAuthRoute(refreshed) as any);
    }
  }

  async function confirmPhone() {
    if (!phoneOtp.trim()) {
      Alert.alert(t("common.error"), t("auth.enterOtp"));
      return;
    }
    setPhoneBusy(true);
    try {
      await apiClient.confirmPhoneOtp({ otp_code: phoneOtp.trim() });
      setPhoneOtp("");
      await afterVerify();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("auth.otpVerifyFailed"));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmEmail() {
    if (!emailOtp.trim()) {
      Alert.alert(t("common.error"), t("auth.enterOtp"));
      return;
    }
    setEmailBusy(true);
    try {
      await apiClient.confirmEmailOtp({ otp_code: emailOtp.trim() });
      setEmailOtp("");
      await afterVerify();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("auth.otpVerifyFailed"));
    } finally {
      setEmailBusy(false);
    }
  }

  async function resendCodes() {
    setResendBusy(true);
    try {
      await apiClient.resendContactOtp();
      Alert.alert(t("common.success"), t("auth.resendCode"));
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("auth.otpFailed"));
    } finally {
      setResendBusy(false);
    }
  }

  if (userLoading || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center" }}>
        <ActivityIndicator color="#158074" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: "#1B1B1B", marginBottom: 8 }}>
          {t("auth.verifyContactTitle")}
        </Text>
        <Text style={{ fontSize: 16, color: "#6C757D", marginBottom: 24, lineHeight: 24 }}>
          {t("auth.verifyContactSubtitle")}
        </Text>

        {needsPhone ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
              {t("auth.phone")}
              {user.phone ? ` (${user.phone})` : ""}
            </Text>
            <TextInput
              value={phoneOtp}
              onChangeText={(v) => setPhoneOtp(v.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              placeholder={t("auth.otpPlaceholder")}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            />
            <TouchableOpacity
              onPress={confirmPhone}
              disabled={phoneBusy}
              style={{
                minHeight: 48,
                borderRadius: 12,
                backgroundColor: "#158074",
                justifyContent: "center",
                opacity: phoneBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600", textAlign: "center" }}>
                {phoneBusy ? t("auth.verifying") : t("auth.verifyPhone")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ color: "#158074", marginBottom: 16 }}>{t("auth.phoneVerified")}</Text>
        )}

        {needsEmail && !placeholderEmail ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
              {t("auth.email")} ({user.email})
            </Text>
            <TextInput
              value={emailOtp}
              onChangeText={(v) => setEmailOtp(v.replace(/\D/g, "").slice(0, 8))}
              keyboardType="number-pad"
              placeholder={t("auth.otpPlaceholder")}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            />
            <TouchableOpacity
              onPress={confirmEmail}
              disabled={emailBusy}
              style={{
                minHeight: 48,
                borderRadius: 12,
                backgroundColor: "#158074",
                justifyContent: "center",
                opacity: emailBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600", textAlign: "center" }}>
                {emailBusy ? t("auth.verifying") : t("auth.verifyEmail")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={resendCodes}
          disabled={resendBusy}
          style={{
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#158074",
            justifyContent: "center",
            marginBottom: 16,
            opacity: resendBusy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#158074", fontWeight: "600", textAlign: "center" }}>
            {resendBusy ? t("common.loading") : t("auth.resendCode")}
          </Text>
        </TouchableOpacity>

        <SignOutButton />
      </ScrollView>
    </SafeAreaView>
  );
}
