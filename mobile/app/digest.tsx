import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import type { DigestSummary } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { BusinessVerificationBadge } from "@/components/business-verification-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/contexts/FeatureConfigContext";

export default function DigestScreen() {
  const router = useRouter();
  const { apiClient } = useAuth();
  const enabled = useFeature("weekly_digest");
  const [digest, setDigest] = useState<DigestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setDigest(await apiClient.getLatestDigest()); setError(false); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [apiClient]);
  useEffect(() => { if (enabled) void load(); else setLoading(false); }, [enabled, load]);

  return (
    <Screen padded={false}>
      <Header title="Weekly digest" showBackButton showLogo={false} />
      {!enabled ? <EmptyState title="Weekly digest is unavailable" /> : loading ? <LoadingState label="Loading digest" /> : error ? <ErrorState onRetry={load} /> : !digest ? (
        <EmptyState title="No digest yet" description="Your first neighbourhood summary will appear here." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.period}>{new Date(digest.period_start).toLocaleDateString()} – {new Date(digest.period_end).toLocaleDateString()}</Text>
          <Section title="Popular posts">
            {digest.popular_posts.map((post) => <Row key={post.id} label={post.category || "Community post"} onPress={() => router.push(`/post/${post.id}`)} />)}
          </Section>
          <Section title="New local businesses">
            {digest.new_businesses.map((business) => (
              <TouchableOpacity key={business.id} style={styles.business} onPress={() => router.push(`/businesses/${business.slug}`)}>
                <Text style={styles.rowLabel}>{business.name}</Text>
                <BusinessVerificationBadge status={business.verification_status} />
              </TouchableOpacity>
            ))}
          </Section>
          <Section title="Announcements">
            {digest.announcements.map((post) => <Row key={post.id} label={post.category || "Announcement"} onPress={() => router.push(`/post/${post.id}`)} />)}
          </Section>
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.title}>{title}</Text>{children}</View>;
}
function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={styles.row} onPress={onPress}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.open}>Open</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  period: { color: colors.textMuted, textAlign: "center" },
  section: { backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 10 },
  title: { color: colors.textMain, fontSize: 18, fontWeight: "700" },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.gray100 },
  rowLabel: { color: colors.textMain, flex: 1, fontWeight: "600" },
  open: { color: colors.primary, fontWeight: "600" },
  business: { minHeight: 58, gap: 6, justifyContent: "center", borderTopWidth: 1, borderTopColor: colors.gray100 },
});
