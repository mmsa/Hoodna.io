import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { buildBusinessSharePayload, type BusinessDetail } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { BusinessVerificationBadge } from "@/components/business-verification-badge";
import { ReportModal } from "@/components/ReportModal";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

export default function BusinessDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { apiClient } = useAuth();
  const claimingEnabled = useFeature("business_claiming");
  const { track } = useTelemetry();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const next = await apiClient.getBusiness(slug);
      setBusiness(next);
      track("business_profile_viewed", { business_id: next.id, category: next.category });
    } catch {
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, slug, track]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Screen padded={false}><Header title="Business" showBackButton /><LoadingState label="Loading business" /></Screen>;
  if (!business) return <Screen padded={false}><Header title="Business" showBackButton /><ErrorState description="This business could not be loaded." onRetry={load} /></Screen>;

  const claimLabel = business.current_user_claim_status === "PENDING" ? "Claim pending" : "Claim this business";

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <Header title="Business" showBackButton />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.businessIcon}><Ionicons name="business" size={36} color={colors.primary} /></View>
          <Text accessibilityRole="header" style={styles.title}>{business.name}</Text>
          <Text style={styles.category}>{business.category}</Text>
          <BusinessVerificationBadge status={business.verification_status} />
          {business.description ? <Text style={styles.description}>{business.description}</Text> : null}
        </View>
        <View style={styles.card}>
          {business.address ? <Info icon="location-outline" value={business.address} /> : null}
          {business.phone ? <Info icon="call-outline" value={business.phone} onPress={() => Linking.openURL(`tel:${business.phone}`)} /> : null}
          {business.email ? <Info icon="mail-outline" value={business.email} onPress={() => Linking.openURL(`mailto:${business.email}`)} /> : null}
          {business.website ? <Info icon="globe-outline" value={business.website} onPress={() => Linking.openURL(business.website!)} /> : null}
        </View>
        <Button
          leading={<Ionicons name="share-outline" size={20} color="#FFFFFF" />}
          onPress={() => {
            const payload = buildBusinessSharePayload(business.name, business.slug);
            void Share.share({ title: payload.title, message: payload.message, url: payload.url }).catch(() => Alert.alert("Could not share"));
          }}
        >
          Share business
        </Button>
        {claimingEnabled ? (
          <Button
            variant="outline"
            disabled={business.current_user_claim_status === "PENDING"}
            onPress={() => router.push(`/businesses/${business.slug}/claim`)}
          >
            {claimLabel}
          </Button>
        ) : null}
        <Button variant="ghost" onPress={() => setReporting(true)}>Report business</Button>
        <Button variant="ghost" onPress={() => router.push("/business-claims")}>My business claims</Button>
      </ScrollView>
      <ReportModal visible={reporting} onClose={() => setReporting(false)} reportedType="business" reportedId={business.id} reportedTitle={business.name} />
    </Screen>
  );
}

function Info({ icon, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; value: string; onPress?: () => void }) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.info} accessibilityRole={onPress ? "link" : "text"}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.infoText}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 10 },
  businessIcon: { width: 68, height: 68, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  title: { color: colors.textMain, fontSize: 26, fontWeight: "800" },
  category: { color: colors.textMuted, fontSize: 16 },
  description: { color: colors.textMain, lineHeight: 22, marginTop: 6 },
  info: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  infoText: { color: colors.textMain, flex: 1, lineHeight: 20 },
});
