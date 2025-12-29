import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { apiClient, login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.login({
        email: email.trim().toLowerCase(),
        password: password,
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
      Alert.alert("Error", error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#EFF6FF' }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
        Welcome back
      </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 32 }}>
        Sign in to your account
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
          marginBottom: 16,
          color: '#1B1B1B',
        }}
        placeholder="Email"
        placeholderTextColor="#6C757D"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      <View style={{ position: 'relative', marginBottom: 24 }}>
        <TextInput
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 16,
            fontSize: 16,
            borderWidth: 1,
            borderColor: '#E5E5E5',
            color: '#1B1B1B',
            paddingRight: 50,
          }}
          placeholder="Password"
          placeholderTextColor="#6C757D"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
          }}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '500' }}>
            {showPassword ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: '#3B82F6',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: loading ? 0.6 : 1,
          marginBottom: 16,
        }}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          paddingVertical: 8,
          alignItems: 'center',
          marginBottom: 24,
        }}
        onPress={() => router.push("/auth/forgot-password")}
      >
        <Text style={{ color: '#3B82F6', fontSize: 14, fontWeight: '600' }}>
          Forgot Password?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          paddingVertical: 12,
          alignItems: 'center',
        }}
        onPress={() => router.push("/auth/phone-login")}
      >
        <Text style={{ color: '#6C757D', fontSize: 14 }}>
          Or continue with phone number
        </Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Text style={{ fontSize: 14, color: '#6C757D' }}>
          Don't have an account?{' '}
          <Text
            style={{ color: '#3B82F6', fontWeight: '600' }}
            onPress={() => router.push("/auth/signup")}
          >
            Sign up
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

