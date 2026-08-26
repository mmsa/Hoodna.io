import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { clearPendingReferralCode, getPendingReferralCode, savePendingReferralCode } from "@/lib/referral";
import { useFeatureConfig } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";
import { useTranslation } from "@/contexts/LocaleContext";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { apiClient, login } = useAuth();
  const { isEnabled, loading: configLoading } = useFeatureConfig();
  const { track } = useTelemetry();
  const { t } = useTranslation();
  const [referralCode, setReferralCode] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void (async () => {
      const code = params.ref || (await getPendingReferralCode());
      if (!active || !code) return;
      setReferralCode(code);
      await savePendingReferralCode(code);
    })();
    track("registration_started", { method: "email", referral_present: Boolean(params.ref) });
    return () => {
      active = false;
    };
  }, [params.ref, track]);

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!name || name.length < 2) {
      newErrors.name = t("auth.nameMinLength");
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phone || phoneDigits.length < 7) {
      newErrors.phone = t("auth.enterPhone");
    }
    if (email.trim() && !email.includes("@")) {
      newErrors.email = t("auth.invalidEmail");
    }
    if (!password || password.length < 6) {
      newErrors.password = t("auth.passwordMinLength");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignup() {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await apiClient.signup({
        name,
        phone,
        password,
        ...(email.trim() ? { email: email.trim() } : {}),
        referral_code: referralCode,
      });

      await login(response.access_token, response.refresh_token);
      track("registration_completed", { method: "email" });
      if (referralCode) {
        track("referral_registration_completed", {});
        await clearPendingReferralCode();
      }

      // Match web: OTP first, then choose-role
      router.replace("/auth/verify-contact");
    } catch (error: any) {
      Alert.alert(t("auth.signupFailedTitle"), error.message || t("auth.signupFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (!configLoading && !isEnabled("user_registration")) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center", padding: 24 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: "#1B1B1B", textAlign: "center" }}>
          {t("auth.registrationPaused")}
        </Text>
        <Text style={{ color: "#6C757D", textAlign: "center", marginTop: 10, lineHeight: 22 }}>
          {t("auth.registrationPausedDesc")}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace("/auth/login")}
          style={{ minHeight: 48, marginTop: 24, borderRadius: 12, backgroundColor: "#158074", justifyContent: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", textAlign: "center" }}>{t("auth.backToSignIn")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
          {/* Header */}
          <View style={{ marginBottom: 32 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginBottom: 24 }}
            >
              <Text style={{ fontSize: 16, color: "#158074" }}>← {t("common.back")}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1B1B1B", marginBottom: 8 }}>
              {t("auth.signUp")}
            </Text>
            <Text style={{ fontSize: 16, color: "#6C757D", lineHeight: 24 }}>
              {t("auth.signupSubtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={{ marginBottom: 24 }}>
            {/* Name */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                {t("auth.fullName")}
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: errors.name ? "#E63946" : "#E5E7EB",
                  color: "#1B1B1B",
                }}
                placeholder={t("auth.namePlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                autoCapitalize="words"
              />
              {errors.name && (
                <Text style={{ fontSize: 12, color: "#E63946", marginTop: 4 }}>
                  {errors.name}
                </Text>
              )}
            </View>

            {/* Phone */}
            <View style={{ marginBottom: 16 }}>
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
                  borderColor: errors.phone ? "#E63946" : "#E5E7EB",
                  color: "#1B1B1B",
                }}
                placeholder={t("auth.phonePlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors({ ...errors, phone: "" });
                }}
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={{ fontSize: 12, color: "#E63946", marginTop: 4 }}>
                  {errors.phone}
                </Text>
              )}
            </View>

            {/* Email (Optional) */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                {t("auth.emailOptional")}
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: errors.email ? "#E63946" : "#E5E7EB",
                  color: "#1B1B1B",
                }}
                placeholder={t("auth.emailPlaceholder")}
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && (
                <Text style={{ fontSize: 12, color: "#E63946", marginTop: 4 }}>
                  {errors.email}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                {t("auth.password")}
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: errors.password ? "#E63946" : "#E5E7EB",
                    color: "#1B1B1B",
                    paddingRight: 50,
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: "" });
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 14,
                  }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={{ fontSize: 16, color: "#6C757D" }}>
                    {showPassword ? "🙈" : "👁️"}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={{ fontSize: 12, color: "#E63946", marginTop: 4 }}>
                  {errors.password}
                </Text>
              )}
              <Text style={{ fontSize: 12, color: "#6C757D", marginTop: 4 }}>
                {t("auth.passwordHint")}
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={{
                backgroundColor: "#158074",
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: "center",
                shadowColor: "#158074",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  {loading ? t("auth.signingUp") : t("auth.signUp")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <Text style={{ fontSize: 14, color: "#6C757D" }}>
              {t("auth.alreadyHaveAccount")}{" "}
              <Text
                style={{ color: "#158074", fontWeight: "600" }}
                onPress={() => router.push("/auth/login")}
              >
                {t("auth.signIn")}
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

