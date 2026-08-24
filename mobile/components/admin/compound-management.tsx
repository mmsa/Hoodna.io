import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/contexts/AuthContext";
import { useCompound } from "@/contexts/CompoundContext";
import { colors } from "@/constants/colors";
import { formatCompoundName } from "@/utils/formatCompound";

interface CompoundRow {
  id: number;
  compound_id?: string | null;
  name: string;
  area?: string | null;
  status_2025?: string | null;
}

export function AdminCompoundManagement() {
  const { apiClient, refreshUser } = useAuth();
  const { switchCompound } = useCompound();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CompoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", skip: "0" });
      if (search.trim()) params.set("q", search.trim());
      const data = await apiClient.request(`/api/admin/compounds?${params}`);
      setItems(data?.items || []);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load compounds");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiClient, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCompound(compound: CompoundRow) {
    setOpeningId(compound.id);
    try {
      await switchCompound(compound.id);
      await refreshUser();
      router.replace("/(tabs)/home");
    } catch (error: any) {
      Alert.alert("Could not open", error?.message || "Failed to switch neighbourhood");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          backgroundColor: colors.backgroundCard,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textMain, marginBottom: 6 }}>
          Compounds
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 }}>
          Open a neighbourhood to browse as admin — no verification required.
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search compounds…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => void load()}
          style={{
            backgroundColor: colors.gray50,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.textMain,
            fontSize: 14,
            marginBottom: 10,
          }}
        />
        <TouchableOpacity
          onPress={() => void load()}
          style={{
            alignSelf: "flex-start",
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : items.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 12 }}>
          No compounds found.
        </Text>
      ) : (
        items.map((compound) => (
          <View
            key={compound.id}
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textMain }}>
                {formatCompoundName(compound.name)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {compound.area || "No area"} · {compound.compound_id || "Pending slug"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => void openCompound(compound)}
              disabled={openingId === compound.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                opacity: openingId === compound.id ? 0.7 : 1,
              }}
            >
              {openingId === compound.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="open-outline" size={18} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Open feed</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}
