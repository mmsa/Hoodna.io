import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Compound } from "../../../packages/shared/src/index";

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
      // Update user's compound
      await apiClient.request("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ compound_id: compoundId }),
      });
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Failed to select compound:", error);
      setSelectedId(null);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background px-6 pt-20">
      <Text className="text-3xl font-bold text-text-main mb-2">
        Select your compound
      </Text>
      <Text className="text-base text-text-muted mb-6">
        Choose the compound where you live
      </Text>

      <FlatList
        data={compounds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`bg-white rounded-card p-4 mb-3 border-2 ${
              selectedId === item.id ? "border-primary" : "border-transparent"
            }`}
            onPress={() => handleSelect(item.id)}
            disabled={selectedId !== null}
          >
            <Text className="text-lg font-semibold text-text-main">
              {item.name}
            </Text>
            {item.area && (
              <Text className="text-sm text-text-muted mt-1">{item.area}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

