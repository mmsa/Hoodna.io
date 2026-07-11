import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
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
  const nameInputRef = useRef<TextInput>(null);

  // Navigate after successful login
  useEffect(() => {
    if (user) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, router]);

  // Normalize phone number to match backend normalization
  const normalizePhone = (phoneNumber: string): string => {
    return phoneNumber.trim().replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  };

  async function handleResend() {
    if (!phone) {
      Alert.alert("Error", "Phone number not found");
      return;
    }

    setLoading(true);
    try {
      await apiClient.phoneAuthStart({ phone: normalizePhone(phone) });
      setOtp("");
      Alert.alert("Success", "A new OTP code has been sent");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!otp.trim()) {
      Alert.alert("Error", "Please enter the OTP code");
      return;
    }

    if (!phone) {
      Alert.alert("Error", "Phone number not found");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneAuthVerify({
        phone: normalizePhone(phone),
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
        Alert.alert("Error", error.message || "Invalid OTP code");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF6FF' }} edges={["top"]}>
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Verify OTP</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          Verify your phone
        </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 32 }}>
        Enter the code sent to {phone || 'your phone'}
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
          placeholder="Your name"
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
        placeholder="000000"
        placeholderTextColor="#6C757D"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!showNameInput}
      />

      <TouchableOpacity
        style={{
          backgroundColor: '#3B82F6',
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
          {loading ? "Verifying..." : "Verify"}
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
        <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '500' }}>
          Resend OTP
        </Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

