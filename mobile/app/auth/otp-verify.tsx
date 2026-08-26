import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { normalizePhone } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPostAuthRoute } from "@/lib/resident-routing";

export default function OTPVerifyScreen() {
  const { phone, otpCode } = useLocalSearchParams<{
    phone: string;
    otpCode?: string;
  }>();
  // Initialize OTP state - only use otpCode if it's a valid 6-digit code
  const initialOtp = otpCode && /^\d{6}$/.test(otpCode) ? otpCode : "";
  const [otp, setOtp] = useState(initialOtp);
  const [name, setName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const { apiClient, login, user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const nameInputRef = useRef<TextInput>(null);

  // Navigate after successful login
  useEffect(() => {
    if (user) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, router]);

  async function handleResend() {
    if (!phone) {
      Alert.alert(t("common.error"), t("auth.enterPhone"));
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      Alert.alert(t("common.error"), t("auth.enterPhone"));
      return;
    }

    setLoading(true);
    try {
      await apiClient.phoneAuthStart({ phone: normalizedPhone });
      setOtp("");
      Alert.alert(t("common.success"), t("auth.resendCode"));
    } catch (error: any) {
      const message = String(error?.message || "");
      const lower = message.toLowerCase();
      let detail = t("auth.otpFailed");
      if (lower.includes("too many") || lower.includes("429")) {
        detail = t("auth.otpRateLimited");
      } else if (
        lower.includes("not configured") ||
        lower.includes("unavailable") ||
        lower.includes("503")
      ) {
        detail = t("auth.otpNotConfigured");
      } else if (message.trim()) {
        detail = message;
      }
      Alert.alert(t("common.error"), detail);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!otp.trim()) {
      Alert.alert(t("common.error"), t("auth.enterOtp"));
      return;
    }

    if (!phone) {
      Alert.alert(t("common.error"), t("auth.enterPhone"));
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      Alert.alert(t("common.error"), t("auth.enterPhone"));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneAuthVerify({
        phone: normalizedPhone,
        otp_code: otp.trim(),
        name: showNameInput ? name.trim() : undefined,
      });

      // login() already calls getMe() and sets the user
      // Navigation will happen automatically via useEffect when user state updates
      await login(response.access_token, response.refresh_token);
    } catch (error: any) {
      if (error.message?.includes("Name is required")) {
        setShowNameInput(true);
        setTimeout(() => nameInputRef.current?.focus(), 100);
      } else {
        Alert.alert(t("common.error"), error.message || t("auth.otpVerifyFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F8F1' }} edges={["top"]}>
      {/* Header with Back Button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>{t("auth.verifyCode")}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          {t("auth.enterOtp")}
        </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 32 }}>
        {t("auth.otpSentTo", { phone: phone || "…" })}
      </Text>

      {showNameInput && (
        <TextInput
          ref={nameInputRef}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#E5E5E5',
            marginBottom: 16,
            color: '#1B1B1B',
          }}
          placeholder={t("auth.fullNamePlaceholder")}
          placeholderTextColor="#6C757D"
          value={name}
          onChangeText={setName}
          autoFocus
        />
      )}

      <TextInput
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 16,
          fontSize: 24,
          borderWidth: 1,
          borderColor: '#E5E5E5',
          marginBottom: 24,
          textAlign: 'center',
          letterSpacing: 8,
          color: '#1B1B1B',
        }}
        placeholder={t("auth.otpPlaceholder")}
        placeholderTextColor="#6C757D"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!showNameInput}
      />

      <TouchableOpacity
        style={{
          backgroundColor: '#158074',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
          marginBottom: 16,
        }}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {loading ? t("auth.signingIn") : t("auth.verifyCode")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          paddingVertical: 12,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
        onPress={handleResend}
        disabled={loading}
      >
        <Text style={{ color: '#158074', fontSize: 14, fontWeight: '500' }}>
          {t("auth.resendCode")}
        </Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

