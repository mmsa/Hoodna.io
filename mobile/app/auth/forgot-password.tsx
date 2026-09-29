import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MIN_PASSWORD_LENGTH, normalizePhone } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";

const fieldStyle = {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  color: "#1B1B1B",
} as const;

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "email" | "phone">("request");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { apiClient } = useAuth();
  const { t } = useTranslation();

  async function handleRecover() {
    const raw = identifier.trim();
    if (!raw) {
      setError(t("auth.enterEmailOrPhone"));
      return;
    }
    const payload = raw.includes("@") ? raw.toLowerCase() : normalizePhone(raw);
    if (!payload) {
      setError(t("auth.enterPhone"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await apiClient.recoverAccount({ identifier: payload });
      if (response.channel === "email") {
        setStep("email");
        return;
      }
      setPhone(payload);
      if (response.otp_code && /^\d{6}$/.test(response.otp_code)) {
        setOtp(response.otp_code);
      }
      setStep("phone");
    } catch (err: any) {
      setError(err.message || t("auth.otpFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneReset() {
    if (!otp.trim()) {
      setError(t("auth.enterOtp"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiClient.resetPasswordPhone({
        phone,
        otp_code: otp.trim(),
        new_password: password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("auth.passwordResetFailed"));
    } finally {
      setLoading(false);
    }
  }

  const done = success || step === "email";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
          <View style={{ marginBottom: 32 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 16, color: "#158074" }}>← {t("common.back")}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1B1B1B", marginBottom: 8 }}>
              {t("auth.forgotPasswordTitle")}
            </Text>
            <Text style={{ fontSize: 16, color: "#6C757D", lineHeight: 24 }}>
              {t("auth.forgotPasswordSubtitle")}
            </Text>
          </View>

          {done ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <View
                style={{
                  backgroundColor: "#D1FAE5",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <Text style={{ fontSize: 14, color: "#065F46", lineHeight: 20 }}>
                  {step === "email" ? t("auth.resetLinkSent") : t("auth.passwordResetSuccess")}
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: "#158074",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={() => router.push("/auth/login")}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  {t("auth.backToLogin")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {error ? (
                <View
                  style={{
                    backgroundColor: "#FEE2E2",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 24,
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#DC2626" }}>{error}</Text>
                </View>
              ) : null}

              {step === "request" ? (
                <>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.emailOrPhone")}
                    </Text>
                    <TextInput
                      style={fieldStyle}
                      placeholder={t("auth.emailOrPhonePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={identifier}
                      onChangeText={(text) => {
                        setIdentifier(text);
                        setError("");
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#158074",
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: "center",
                    }}
                    onPress={handleRecover}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        {t("auth.continueAction")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, color: "#6C757D", marginBottom: 16 }}>
                    {t("auth.resetCodeSent")}
                  </Text>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.enterOtp")}
                    </Text>
                    <TextInput
                      style={{ ...fieldStyle, letterSpacing: 4, textAlign: "center" }}
                      placeholder={t("auth.otpPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.newPassword")}
                    </Text>
                    <TextInput
                      style={fieldStyle}
                      placeholder={t("auth.passwordPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.confirmPassword")}
                    </Text>
                    <TextInput
                      style={fieldStyle}
                      placeholder={t("auth.passwordPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#158074",
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                    onPress={handlePhoneReset}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        {t("auth.resetPassword")}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#158074",
                    }}
                    onPress={() =>
                      router.push({
                        pathname: "/auth/otp-verify",
                        params: {
                          phone,
                          ...(otp ? { otpCode: otp } : {}),
                        },
                      })
                    }
                  >
                    <Text style={{ color: "#158074", fontSize: 16, fontWeight: "600" }}>
                      {t("auth.signInWithCode")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ alignItems: "center", marginTop: 24 }}>
                <TouchableOpacity onPress={() => router.push("/auth/login")}>
                  <Text style={{ fontSize: 14, color: "#158074", fontWeight: "600" }}>
                    {t("auth.backToLogin")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
