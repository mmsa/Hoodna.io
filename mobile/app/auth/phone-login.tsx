import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { apiClient } = useAuth();
  const router = useRouter();

  async function handleStart() {
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneAuthStart({ phone });
      router.push({
        pathname: "/auth/otp-verify",
        params: { phone, otpCode: response.otp_code || "" },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background px-6 pt-20">
      <Text className="text-3xl font-bold text-text-main mb-2">
        Welcome to Hoodna
      </Text>
      <Text className="text-base text-text-muted mb-8">
        Enter your phone number to continue
      </Text>

      <TextInput
        className="bg-white rounded-button px-4 py-4 text-base border border-gray-200 mb-6"
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoFocus
      />

      <TouchableOpacity
        className="bg-primary rounded-button py-4 items-center"
        onPress={handleStart}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? "Sending..." : "Continue"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

