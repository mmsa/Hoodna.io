import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { getRoleOnboardingRoute } from "@/lib/resident-routing";
import { clearPendingReferralCode, getPendingReferralCode, savePendingReferralCode } from "@/lib/referral";
import { useFeatureConfig } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"RESIDENT" | "SERVICE_PROVIDER" | "COMPOUND_MOD" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { apiClient, login } = useAuth();
  const { isEnabled, loading: configLoading } = useFeatureConfig();
  const { track } = useTelemetry();
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
      newErrors.name = "Name must be at least 2 characters";
    }
    if (!email || !email.includes("@")) {
      newErrors.email = "Invalid email address";
    }
    if (!password || password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!selectedRole) {
      newErrors.role = "Please select an account type";
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
        email,
        password,
        phone: phone || undefined,
        role: selectedRole!,
        referral_code: referralCode,
      });

      await login(response.access_token, response.refresh_token);
      track("registration_completed", { method: "email", role: selectedRole! });
      if (referralCode) {
        track("referral_registration_completed", {});
        await clearPendingReferralCode();
      }

      router.replace(getRoleOnboardingRoute(selectedRole!) as any);
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!configLoading && !isEnabled("user_registration")) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center", padding: 24 }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: "#1B1B1B", textAlign: "center" }}>
          Registration is temporarily paused
        </Text>
        <Text style={{ color: "#6C757D", textAlign: "center", marginTop: 10, lineHeight: 22 }}>
          Eljiran is opening access gradually. Please try again later.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace("/auth/login")}
          style={{ minHeight: 48, marginTop: 24, borderRadius: 12, backgroundColor: "#158074", justifyContent: "center" }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "600", textAlign: "center" }}>Back to sign in</Text>
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
              <Text style={{ fontSize: 16, color: "#158074" }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1B1B1B", marginBottom: 8 }}>
              Create Account
            </Text>
            <Text style={{ fontSize: 16, color: "#6C757D", lineHeight: 24 }}>
              Join your community and start connecting
            </Text>
          </View>

          {/* Form */}
          <View style={{ marginBottom: 24 }}>
            {/* Name */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                Full Name
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
                placeholder="Enter your name"
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

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                Email
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
                placeholder="you@example.com"
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

            {/* Phone (Optional) */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                Phone (Optional)
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
                placeholder="+1234567890"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                Password
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
                Must be at least 6 characters
              </Text>
            </View>

            {/* Role Selection */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 12 }}>
                Account Type <Text style={{ color: "#E63946" }}>*</Text>
              </Text>
              {errors.role && (
                <Text style={{ fontSize: 12, color: "#E63946", marginBottom: 8 }}>
                  {errors.role}
                </Text>
              )}
              
              {/* Resident */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: selectedRole === "RESIDENT" ? "#158074" : "#E5E7EB",
                }}
                onPress={() => {
                  setSelectedRole("RESIDENT");
                  if (errors.role) setErrors({ ...errors, role: "" });
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selectedRole === "RESIDENT" ? "#E6F3F1" : "#F3F4F6",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="home"
                      size={20}
                      color={selectedRole === "RESIDENT" ? "#158074" : "#6C757D"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1B1B1B" }}>
                      Resident
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6C757D" }}>
                      Live in a compound
                    </Text>
                  </View>
                  {selectedRole === "RESIDENT" && (
                    <Ionicons name="checkmark-circle" size={24} color="#158074" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Service Provider */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: selectedRole === "SERVICE_PROVIDER" ? "#10B981" : "#E5E7EB",
                }}
                onPress={() => {
                  setSelectedRole("SERVICE_PROVIDER");
                  if (errors.role) setErrors({ ...errors, role: "" });
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selectedRole === "SERVICE_PROVIDER" ? "#D1FAE5" : "#F3F4F6",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="construct"
                      size={20}
                      color={selectedRole === "SERVICE_PROVIDER" ? "#10B981" : "#6C757D"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1B1B1B" }}>
                      Service Provider
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6C757D" }}>
                      Provide services to residents
                    </Text>
                  </View>
                  {selectedRole === "SERVICE_PROVIDER" && (
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Compound Moderator */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: selectedRole === "COMPOUND_MOD" ? "#158074" : "#E5E7EB",
                }}
                onPress={() => {
                  setSelectedRole("COMPOUND_MOD");
                  if (errors.role) setErrors({ ...errors, role: "" });
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selectedRole === "COMPOUND_MOD" ? "#E6F3F1" : "#F3F4F6",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color={selectedRole === "COMPOUND_MOD" ? "#158074" : "#6C757D"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1B1B1B" }}>
                      Compound Moderator
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6C757D" }}>
                      Moderate content for your compound
                    </Text>
                  </View>
                  {selectedRole === "COMPOUND_MOD" && (
                    <Ionicons name="checkmark-circle" size={24} color="#158074" />
                  )}
                </View>
              </TouchableOpacity>
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
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <Text style={{ fontSize: 14, color: "#6C757D" }}>
              Already have an account?{" "}
              <Text
                style={{ color: "#158074", fontWeight: "600" }}
                onPress={() => router.push("/auth/login")}
              >
                Sign in
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

