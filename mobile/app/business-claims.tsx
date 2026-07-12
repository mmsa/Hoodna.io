import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { BusinessClaim } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function BusinessClaimsScreen() {
  const { apiClient } = useAuth();
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setClaims(await apiClient.getMyBusinessClaims());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <Header title="Business claim status" showBackButton showLogo={false} />
      {loading ? <LoadingState label="Loading claims" /> : error ? <ErrorState onRetry={load} /> : (
        <FlatList
          data={claims}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={claims.length ? styles.list : { flexGrow: 1 }}
          ListEmptyComponent={<EmptyState title="No business claims" description="Claims you submit will appear here." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.business_name || `Business #${item.business_id}`}</Text>
              <View style={[styles.status, { backgroundColor: item.status === "APPROVED" ? colors.successLight : item.status === "REJECTED" ? colors.errorLight : colors.accentLight }]}>
                <Text style={{ fontWeight: "700", color: item.status === "APPROVED" ? colors.success : item.status === "REJECTED" ? colors.error : colors.accent }}>{item.status}</Text>
              </View>
              <Text style={styles.meta}>Submitted {new Date(item.submitted_at).toLocaleDateString()}</Text>
              {item.review_notes ? <Text style={styles.notes}>{item.review_notes}</Text> : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard, gap: 8 },
  name: { color: colors.textMain, fontSize: 18, fontWeight: "700" },
  status: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  meta: { color: colors.textMuted, fontSize: 13 },
  notes: { color: colors.textMain, lineHeight: 20 },
});
