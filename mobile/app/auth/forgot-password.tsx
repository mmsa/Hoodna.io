import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { normalizePhone } from "@hoodna/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";

export default function ForgotPasswordScreen() {
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneStep, setPhoneStep] = useState<"request" | "reset">("request");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { apiClient } = useAuth();
  const { t } = useTranslation();

  async function handleEmailSubmit() {
    if (!email || !email.includes("@")) {
      setError(t("auth.validEmailRequired"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiClient.forgotPassword({ email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("auth.resetEmailFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPhoneCode() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError(t("auth.enterPhone"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiClient.phoneAuthStart({ phone: normalized });
      setPhone(normalized);
      setPhoneStep("reset");
    } catch (err: any) {
      const message = String(err?.message || "");
      const lower = message.toLowerCase();
      if (lower.includes("too many") || lower.includes("429")) {
        setError(t("auth.otpRateLimited"));
      } else if (lower.includes("not configured") || lower.includes("503")) {
        setError(t("auth.otpNotConfigured"));
      } else {
        setError(message.trim() || t("auth.otpFailed"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneReset() {
    if (!otp.trim()) {
      setError(t("auth.enterOtp"));
      return;
    }
    if (password.length < 6) {
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

          {success ? (
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
                  {method === "email" ? t("auth.resetLinkSent") : t("auth.passwordResetSuccess")}
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
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: method === "phone" ? "#158074" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: method === "phone" ? "#158074" : "#E5E7EB",
                  }}
                  onPress={() => {
                    setMethod("phone");
                    setError("");
                    setSuccess(false);
                  }}
                >
                  <Text style={{ color: method === "phone" ? "#FFFFFF" : "#1B1B1B", fontWeight: "600" }}>
                    {t("auth.usePhone")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: method === "email" ? "#158074" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: method === "email" ? "#158074" : "#E5E7EB",
                  }}
                  onPress={() => {
                    setMethod("email");
                    setError("");
                    setSuccess(false);
                  }}
                >
                  <Text style={{ color: method === "email" ? "#FFFFFF" : "#1B1B1B", fontWeight: "600" }}>
                    {t("auth.useEmail")}
                  </Text>
                </TouchableOpacity>
              </View>

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

              {method === "email" ? (
                <>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.email")}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        color: "#1B1B1B",
                      }}
                      placeholder={t("auth.emailPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        setError("");
                      }}
                      keyboardType="email-address"
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
                    onPress={handleEmailSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        {t("auth.sendResetLink")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : phoneStep === "request" ? (
                <>
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                      {t("auth.phone")}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        color: "#1B1B1B",
                      }}
                      placeholder={t("auth.phonePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={(text) => {
                        setPhone(text);
                        setError("");
                      }}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#158074",
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: "center",
                    }}
                    onPress={handleSendPhoneCode}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        {t("auth.sendResetCode")}
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
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        color: "#1B1B1B",
                        letterSpacing: 4,
                        textAlign: "center",
                      }}
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
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        color: "#1B1B1B",
                      }}
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
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                        color: "#1B1B1B",
                      }}
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
