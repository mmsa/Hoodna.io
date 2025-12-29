import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

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
    <View style={{ flex: 1, backgroundColor: '#F9F7F2', paddingHorizontal: 24, paddingTop: 80 }}>
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
          backgroundColor: '#2D6A4F',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
        }}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {loading ? "Verifying..." : "Verify"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

