import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Compound } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { formatCompoundName } from "@/utils/formatCompound";

export default function CompoundSelectScreen() {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { apiClient, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadCompounds();
  }, []);

  async function loadCompounds() {
    try {
      const data = await apiClient.getCompounds({ limit: 200 });
      setCompounds(data || []);
    } catch (error: any) {
      console.error("Failed to load compounds:", error);
      Alert.alert(
        "Error",
        "Failed to load neighbourhoods. Please check your connection and try again.",
        [{ text: "Retry", onPress: loadCompounds }]
      );
    } finally {
      setLoading(false);
    }
  }

  // Filter compounds based on search query
  const filteredCompounds = useMemo(() => {
    if (!searchQuery.trim()) return compounds;
    const query = searchQuery.toLowerCase().trim();
    return compounds.filter(
      (compound) =>
        compound.name.toLowerCase().includes(query) ||
        compound.area?.toLowerCase().includes(query)
    );
  }, [compounds, searchQuery]);

  async function handleSelect(compoundId: number) {
    // Just set selection, don't submit yet
    setSelectedId(compoundId);
  }

  async function handleSubmit() {
    if (!selectedId) {
      Alert.alert("Error", "Please select a neighbourhood");
      return;
    }

    setSubmitting(true);
    try {
      // First, request access to the compound
      await apiClient.requestCompoundAccess(selectedId);
      
      // Update user's compound (this will set it, but user still needs verification)
      await apiClient.request("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ compound_id: selectedId }),
      });
      await refreshUser();
      
      // Redirect to verification to submit documents for this compound
      router.replace("/verification");
    } catch (error: any) {
      console.error("Failed to select compound:", error);
      
      // Provide helpful error message for network issues
      let errorMessage = error?.message || "Failed to request neighbourhood access";
      if (errorMessage.includes("Cannot connect") || errorMessage.includes("Network")) {
        errorMessage = `${errorMessage}\n\nTroubleshooting:\n• Ensure backend is running\n• Phone and computer must be on same WiFi\n• Check macOS firewall settings`;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF6FF' }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted }}>
            Loading neighbourhoods...
          </Text>
        </View>
      </SafeAreaView>
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
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>Select Neighbourhood</Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1B1B1B', marginBottom: 8 }}>
          Where do you live?
        </Text>
        <Text style={{ fontSize: 16, color: '#6C757D', marginBottom: 20 }}>
          Search and select your neighbourhood
        </Text>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: "#111827" }}
            placeholder="Search neighbourhoods..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Results Count */}
        {searchQuery.trim() && (
          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 12 }}>
            {filteredCompounds.length} neighbourhood{filteredCompounds.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Compounds List */}
        {filteredCompounds.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 16, marginBottom: 8 }}>
              No neighbourhoods found
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
              {searchQuery.trim() 
                ? "Try a different search term" 
                : "Failed to load neighbourhoods. Please try again."}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                onPress={loadCompounds}
                style={{
                  marginTop: 20,
                  backgroundColor: colors.primary,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <FlatList
              data={filteredCompounds}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 2,
                    borderColor: selectedId === item.id ? colors.primary : '#E5E7EB',
                    shadowColor: selectedId === item.id ? colors.primary : "#000",
                    shadowOffset: { width: 0, height: selectedId === item.id ? 2 : 1 },
                    shadowOpacity: selectedId === item.id ? 0.1 : 0.05,
                    shadowRadius: selectedId === item.id ? 4 : 2,
                    elevation: selectedId === item.id ? 3 : 1,
                  }}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '600', color: '#1B1B1B', marginBottom: 4 }}>
                        {formatCompoundName(item.name)}
                      </Text>
                      {item.area && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="location-outline" size={14} color="#6B7280" />
                          <Text style={{ fontSize: 14, color: '#6B7280' }}>{item.area}</Text>
                        </View>
                      )}
                    </View>
                    {selectedId === item.id && (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: colors.primary,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListFooterComponent={<View style={{ height: 20 }} />}
            />

            {/* Submit Button */}
            {selectedId && (
              <View
                style={{
                  paddingTop: 16,
                  paddingBottom: 24,
                  borderTopWidth: 1,
                  borderTopColor: "#E5E7EB",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        Setting up...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                        Continue
                      </Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

