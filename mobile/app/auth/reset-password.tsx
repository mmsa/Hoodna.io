import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { apiClient } = useAuth();

  useEffect(() => {
    const tokenParam = params.token as string;
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.");
    } else {
      try {
        const decodedToken = decodeURIComponent(tokenParam);
        setToken(decodedToken);
      } catch (e) {
        setError("Invalid reset link format. Please request a new password reset.");
      }
    }
  }, [params]);

  async function handleSubmit() {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiClient.resetPassword({
        token,
        new_password: password,
      });
      setSuccess(true);
      setTimeout(() => {
        router.replace("/auth/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token && !error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
        <Text style={{ marginTop: 16, color: "#6C757D" }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F7F2" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 32 }}>
          {/* Header */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1B1B1B", marginBottom: 8 }}>
              Reset Password
            </Text>
            <Text style={{ fontSize: 16, color: "#6C757D", lineHeight: 24 }}>
              Enter your new password
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
                  Password has been reset successfully! Redirecting to login...
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {error && (
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
              )}

              {/* Password Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                  New Password
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
                      borderColor: error ? "#E63946" : "#E5E7EB",
                      color: "#1B1B1B",
                      paddingRight: 50,
                    }}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError("");
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
              </View>

              {/* Confirm Password Input */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1B1B1B", marginBottom: 8 }}>
                  Confirm Password
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
                      borderColor: error ? "#E63946" : "#E5E7EB",
                      color: "#1B1B1B",
                      paddingRight: 50,
                    }}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setError("");
                    }}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={{
                      position: "absolute",
                      right: 16,
                      top: 14,
                    }}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Text style={{ fontSize: 16, color: "#6C757D" }}>
                      {showConfirmPassword ? "🙈" : "👁️"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#2D6A4F",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  shadowColor: "#2D6A4F",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                onPress={handleSubmit}
                disabled={loading || !token}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                    Reset Password
                  </Text>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <TouchableOpacity onPress={() => router.push("/auth/login")}>
                  <Text style={{ fontSize: 14, color: "#2D6A4F", fontWeight: "600" }}>
                    Back to login
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

