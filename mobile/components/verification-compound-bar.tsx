import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { formatCompoundName, formatCompoundWithArea } from "@/utils/formatCompound";
import { isVerifiedForCurrentCompound } from "@/lib/resident-routing";

type CompoundOption = {
  id: number;
  name: string;
  area: string | null;
  is_current: boolean;
  is_verified: boolean;
};

export function VerificationCompoundBar({
  currentCompoundName,
  onCompoundChange,
}: {
  currentCompoundName?: string | null;
  onCompoundChange?: () => void;
}) {
  const { apiClient, user, refreshUser } = useAuth();
  const router = useRouter();
  const [compounds, setCompounds] = useState<CompoundOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function loadCompounds() {
    try {
      const data = await apiClient.getUserCompounds();
      let list: CompoundOption[] = (data || []).map((c) => ({
        ...c,
        is_verified: c.is_verified ?? true,
      }));

      if (user?.compound_id && !list.some((c) => c.id === user.compound_id)) {
        try {
          const all = await apiClient.getCompounds({ limit: 200 });
          const current = all.find((c) => c.id === user.compound_id);
          if (current) {
            list.push({
              id: current.id,
              name: current.name,
              area: current.area ?? null,
              is_current: true,
              is_verified: false,
            });
          }
        } catch {
          // ignore
        }
      }

      list.sort((a, b) => Number(b.is_current) - Number(a.is_current));
      setCompounds(list);
    } catch {
      setCompounds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompounds();
  }, [apiClient, user?.compound_id, user?.verified_compound_ids]);

  const currentCompound = compounds.find((c) => c.is_current);
  const displayName =
    currentCompoundName ||
    currentCompound?.name ||
    (user?.compound_id ? `Neighbourhood #${user.compound_id}` : null);

  const showDropdown = compounds.length > 1;

  async function handleSwitch(compoundId: number) {
    const target = compounds.find((c) => c.id === compoundId);
    if (!target || compoundId === user?.compound_id || switching) return;

    setMenuOpen(false);
    setSwitching(compoundId);
    try {
      if (target.is_verified) {
        await apiClient.switchCompound(compoundId);
        await refreshUser();
        router.replace("/(tabs)/home");
      } else {
        await apiClient.request("/api/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ compound_id: compoundId }),
        });
        await refreshUser();
        await loadCompounds();
        onCompoundChange?.();
      }
    } catch (error: any) {
      Alert.alert("Could not switch", error?.message || "Failed to switch neighbourhood");
    } finally {
      setSwitching(null);
    }
  }

  const verifyingNewCompound =
    user?.compound_id != null && !isVerifiedForCurrentCompound(user);

  return (
    <View style={{ marginBottom: 20, gap: 12 }}>
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: showDropdown ? 0 : 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="location" size={18} color="#2563EB" />
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B7280", textTransform: "uppercase" }}>
              {verifyingNewCompound ? "Verifying for" : "Neighbourhood"}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#2563EB" style={{ alignSelf: "flex-start", marginBottom: 8 }} />
          ) : showDropdown ? (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              disabled={!!switching}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 4,
                marginBottom: verifyingNewCompound ? 12 : 0,
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
                  {displayName ? formatCompoundName(displayName) : "Select neighbourhood"}
                </Text>
                {currentCompound?.area && (
                  <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>
                    {currentCompound.area}
                  </Text>
                )}
              </View>
              {switching ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <Ionicons name="chevron-down" size={22} color="#2563EB" />
              )}
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: verifyingNewCompound ? 8 : 0 }}>
              {displayName ? formatCompoundName(displayName) : "Your neighbourhood"}
            </Text>
          )}

          {verifyingNewCompound && (
            <Text style={{ fontSize: 14, color: "#6B7280", lineHeight: 20, paddingBottom: 14 }}>
              Upload documents for this neighbourhood. Verified neighbourhoods stay separate.
            </Text>
          )}
        </View>

        {showDropdown && !verifyingNewCompound && (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={{
              borderTopWidth: 1,
              borderTopColor: "#F3F4F6",
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 14, color: "#2563EB", fontWeight: "600" }}>
              Switch neighbourhood ({compounds.length})
            </Text>
            <Ionicons name="chevron-down" size={18} color="#2563EB" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={() => router.push("/onboarding/compound-select")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingVertical: 8,
        }}
      >
        <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#2563EB" }}>
          Add another neighbourhood
        </Text>
      </TouchableOpacity>

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "70%",
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                Your neighbourhoods
              </Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={compounds}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isActive = item.id === user?.compound_id;
                const isBusy = switching === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => handleSwitch(item.id)}
                    disabled={isActive || isBusy}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F3F4F6",
                      backgroundColor: isActive ? "#EFF6FF" : "#FFFFFF",
                    }}
                  >
                    <Ionicons
                      name={item.is_verified ? "checkmark-circle" : "hourglass-outline"}
                      size={22}
                      color={item.is_verified ? "#10B981" : "#D97706"}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: isActive ? "700" : "600",
                          color: "#111827",
                        }}
                      >
                        {formatCompoundWithArea(item.name, item.area)}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                        {item.is_verified ? "Verified — open community" : "Verification in progress"}
                      </Text>
                    </View>
                    {isBusy ? (
                      <ActivityIndicator color="#2563EB" />
                    ) : isActive ? (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <TouchableOpacity
                  onPress={() => {
                    setMenuOpen(false);
                    router.push("/onboarding/compound-select");
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#2563EB" />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#2563EB" }}>
                    Add another neighbourhood
                  </Text>
                </TouchableOpacity>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
