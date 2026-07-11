import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { apiClient } = useAuth();

  async function handleSubmit() {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiClient.forgotPassword({ email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }}>
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
              <Text style={{ fontSize: 16, color: "#3B82F6" }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1B1B1B", marginBottom: 8 }}>
              Forgot Password
            </Text>
            <Text style={{ fontSize: 16, color: "#6C757D", lineHeight: 24 }}>
              Enter your email to receive a password reset link
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
                  If an account with that email exists, a password reset link has been sent.
                  Please check your email.
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={() => router.push("/auth/login")}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  Back to Login
                </Text>
              </TouchableOpacity>
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

              {/* Email Input */}
              <View style={{ marginBottom: 24 }}>
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
                    borderColor: error ? "#E63946" : "#E5E7EB",
                    color: "#1B1B1B",
                  }}
                  placeholder="you@example.com"
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

              {/* Submit Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  shadowColor: "#3B82F6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <View style={{ alignItems: "center", marginTop: 24 }}>
                <TouchableOpacity onPress={() => router.push("/auth/login")}>
                  <Text style={{ fontSize: 14, color: "#3B82F6", fontWeight: "600" }}>
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

