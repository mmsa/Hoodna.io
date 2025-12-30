import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Compound } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CompoundSelectScreen() {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { apiClient, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadCompounds();
  }, []);

  async function loadCompounds() {
    try {
      const data = await apiClient.getCompounds({ limit: 100 });
      setCompounds(data);
    } catch (error) {
      console.error("Failed to load compounds:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(compoundId: number) {
    setSelectedId(compoundId);
    try {
      // First, request access to the compound
      await apiClient.requestCompoundAccess(compoundId);
      
      // Update user's compound (this will set it, but user still needs verification)
      await apiClient.request("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ compound_id: compoundId }),
      });
      await refreshUser();
      
      // Redirect to verification to submit documents for this compound
      Alert.alert(
        "Verification Required",
        "Please submit verification documents for this compound to complete your access request.",
        [
          {
            text: "Go to Verification",
            onPress: () => router.replace("/verification"),
          },
        ]
      );
    } catch (error: any) {
      console.error("Failed to select compound:", error);
      setSelectedId(null);
      
      // Provide helpful error message for network issues
      let errorMessage = error?.message || "Failed to request compound access";
      if (errorMessage.includes("Cannot connect") || errorMessage.includes("Network")) {
        errorMessage = `${errorMessage}\n\nTroubleshooting:\n• Ensure backend is running\n• Phone and computer must be on same WiFi\n• Check macOS firewall settings\n• Try accessing http://192.168.1.8:8000/health in phone's browser`;
      }
      
      Alert.alert("Error", errorMessage);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Select Compound</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          Select your compound
        </Text>
      <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 24 }}>
        Choose the compound where you live
      </Text>

      <FlatList
        data={compounds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 16,
              marginBottom: 12,
              borderWidth: 2,
              borderColor: selectedId === item.id ? '#3B82F6' : 'transparent',
            }}
            onPress={() => handleSelect(item.id)}
            disabled={selectedId !== null}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#1B1B1B' }}>
              {item.name}
            </Text>
            {item.area && (
              <Text style={{ fontSize: 14, color: '#6C757D', marginTop: 4 }}>{item.area}</Text>
            )}
          </TouchableOpacity>
        )}
      />
      </View>
    </SafeAreaView>
  );
}

