import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { apiClient } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  // Normalize phone number to match backend normalization
  const normalizePhone = (phoneNumber: string): string => {
    return phoneNumber.trim().replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  };

  async function handleStart() {
    if (!phone.trim()) {
      Alert.alert(t("common.error"), t("auth.enterPhone"));
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
      Alert.alert(t("common.error"), error.message || t("auth.otpFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F8F1' }} edges={["top"]}>
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>{t("auth.phoneLogin")}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          {t("auth.welcomeTo")}
        </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 32 }}>
        {t("auth.enterPhoneSubtitle")}
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
        placeholder={t("auth.phonePlaceholder")}
        placeholderTextColor="#6C757D"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoFocus
      />

      <TouchableOpacity
        style={{
          backgroundColor: '#158074',
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
          {loading ? t("auth.signingIn") : t("auth.sendCode")}
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
          {t("auth.signInWithEmail")}
        </Text>
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

