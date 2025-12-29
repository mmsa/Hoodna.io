import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function OTPVerifyScreen() {
  const { phone, otpCode } = useLocalSearchParams<{
    phone: string;
    otpCode?: string;
  }>();
  const [otp, setOtp] = useState(otpCode || "");
  const [name, setName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const { apiClient, login } = useAuth();
  const router = useRouter();
  const nameInputRef = useRef<TextInput>(null);

  async function handleVerify() {
    if (!otp.trim()) {
      Alert.alert("Error", "Please enter the OTP code");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.phoneAuthVerify({
        phone: phone!,
        otp_code: otp,
        name: showNameInput ? name : undefined,
      });

      await login(response.access_token, response.refresh_token);

      // Check if user needs to select compound
      const user = await apiClient.getMe();
      if (user.compound_id) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/onboarding/compound-select");
      }
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
    <View className="flex-1 bg-background px-6 pt-20">
      <Text className="text-3xl font-bold text-text-main mb-2">
        Verify your phone
      </Text>
      <Text className="text-base text-text-muted mb-8">
        Enter the code sent to {phone}
      </Text>

      {showNameInput && (
        <TextInput
          ref={nameInputRef}
          className="bg-white rounded-button px-4 py-4 text-base border border-gray-200 mb-4"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoFocus
        />
      )}

      <TextInput
        className="bg-white rounded-button px-4 py-4 text-base border border-gray-200 mb-6 text-center text-2xl tracking-widest"
        placeholder="000000"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!showNameInput}
      />

      <TouchableOpacity
        className="bg-primary rounded-button py-4 items-center"
        onPress={handleVerify}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? "Verifying..." : "Verify"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

