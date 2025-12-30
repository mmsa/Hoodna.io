import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { apiClient } = useAuth();
  const router = useRouter();

  // Normalize phone number to match backend normalization
  const normalizePhone = (phoneNumber: string): string => {
    return phoneNumber.trim().replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  };

  async function handleStart() {
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      const response = await apiClient.phoneAuthStart({ phone: normalizedPhone });
      router.push({
        pathname: "/auth/otp-verify",
        params: { phone: normalizedPhone },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send OTP");
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Phone Login</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          Welcome to eljiran
        </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 32 }}>
        Enter your phone number to continue
      </Text>

      <TextInput
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 16,
          fontSize: 16,
          borderWidth: 1,
          borderColor: '#E5E5E5',
          marginBottom: 24,
          color: '#1B1B1B',
        }}
        placeholder="Phone number"
        placeholderTextColor="#6C757D"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoFocus
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
        onPress={handleStart}
        disabled={loading}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {loading ? "Sending..." : "Continue"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          paddingVertical: 12,
          alignItems: 'center',
        }}
        onPress={() => router.push("/auth/login")}
      >
        <Text style={{ color: '#6C757D', fontSize: 14 }}>
          Or sign in with email
        </Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

