import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BusinessSummary } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { BusinessVerificationBadge } from "@/components/business-verification-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export default function BusinessDirectoryScreen() {
  const router = useRouter();
  const { apiClient } = useAuth();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (search = query) => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiClient.getBusinesses({ search: search.trim() || undefined, limit: 50 });
      setItems(result.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiClient, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(query), 300);
    return () => clearTimeout(timer);
  }, [load, query]);

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <Header title="Local businesses" showBackButton />
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search local businesses"
          placeholder="Search businesses or categories"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />
      </View>
      {loading ? <LoadingState label="Loading businesses" /> : error ? (
        <ErrorState description="We could not load the business directory." onRetry={() => load()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={items.length ? styles.list : { flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title="No businesses found" description="Try another name or category." />}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              onPress={() => router.push(`/businesses/${item.slug}`)}
              style={styles.card}
            >
              <View style={styles.icon}><Ionicons name="business" size={24} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{[item.category, item.area || item.city].filter(Boolean).join(" • ")}</Text>
                <View style={{ marginTop: 8 }}><BusinessVerificationBadge status={item.verification_status} /></View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, margin: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  input: { flex: 1, color: colors.textMain, fontSize: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  name: { color: colors.textMain, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: 4 },
});
