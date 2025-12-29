import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthSelectionScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F7F2' }}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          {/* Logo/Brand Section */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: '#2D6A4F',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' }}>H</Text>
            </View>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
              Welcome to Hoodna
            </Text>
            <Text style={{ fontSize: 16, color: '#6C757D', textAlign: 'center', lineHeight: 24 }}>
              Your community, your neighborhood
            </Text>
          </View>

          {/* Auth Options */}
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#2D6A4F',
                borderRadius: 12,
                paddingVertical: 18,
                alignItems: 'center',
                marginBottom: 16,
                shadowColor: '#2D6A4F',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={() => router.push("/auth/login")}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Sign in with Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                paddingVertical: 18,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: '#2D6A4F',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
              onPress={() => router.push("/auth/phone-login")}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#2D6A4F', fontSize: 16, fontWeight: '600' }}>
                Continue with Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ fontSize: 14, color: '#6C757D', marginBottom: 8 }}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/auth/signup")}>
              <Text style={{ fontSize: 14, color: '#2D6A4F', fontWeight: '600' }}>
                Sign up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ fontSize: 12, color: '#6C757D', textAlign: 'center' }}>
              By continuing, you agree to our Terms of Service
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

