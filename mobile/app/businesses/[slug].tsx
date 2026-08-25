import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [analytics, setAnalytics] = useState<{ profile_views: number; offer_clicks: number; active_offers: number } | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const next = await apiClient.getBusiness(slug);
      setBusiness(next);
      const role = next.viewer_membership_role || next.user_membership_role;
      if (role === "OWNER" || role === "MANAGER") {
        setAnalytics(await apiClient.getBusinessAnalytics(slug).catch(() => null));
      }
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
  const membershipRole = business.viewer_membership_role || business.user_membership_role;
  const canManage = membershipRole === "OWNER" || membershipRole === "MANAGER";

  async function createOffer() {
    if (!offerTitle.trim()) return;
    try {
      await apiClient.createBusinessOffer(business!.slug, {
        title: offerTitle.trim(),
        description: offerDescription.trim() || undefined,
        is_active: true,
      });
      setOfferTitle("");
      setOfferDescription("");
      await load();
    } catch (error: any) {
      Alert.alert("Could not create offer", error?.message || "Please try again.");
    }
  }

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
        {analytics ? (
          <View style={styles.analytics}>
            <Metric label="Views" value={analytics.profile_views} />
            <Metric label="Clicks" value={analytics.offer_clicks} />
            <Metric label="Active" value={analytics.active_offers} />
          </View>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Offers</Text>
          {business.offers?.length ? business.offers.filter((offer) => offer.is_active || canManage).map((offer) => (
            <TouchableOpacity
              key={offer.id}
              disabled={canManage}
              onPress={() => apiClient.trackBusinessOfferClick(offer.id)}
              style={styles.offer}
            >
              {offer.badge_text ? <Text style={styles.offerBadge}>{offer.badge_text}</Text> : null}
              <Text style={styles.offerTitle}>{offer.title}</Text>
              {offer.description ? <Text style={styles.offerDescription}>{offer.description}</Text> : null}
            </TouchableOpacity>
          )) : <Text style={styles.muted}>No current offers.</Text>}
        </View>
        {canManage ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create offer</Text>
            <TextInput value={offerTitle} onChangeText={setOfferTitle} placeholder="Offer title" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={offerDescription} onChangeText={setOfferDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.textarea]} />
            <Button onPress={createOffer} disabled={!offerTitle.trim()}>Publish offer</Button>
          </View>
        ) : null}
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

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
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
  analytics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  metricValue: { color: colors.textMain, fontSize: 22, fontWeight: "800" },
  sectionTitle: { color: colors.textMain, fontSize: 18, fontWeight: "800" },
  offer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12, gap: 4 },
  offerBadge: { alignSelf: "flex-start", color: colors.primary, backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "700" },
  offerTitle: { color: colors.textMain, fontWeight: "700" },
  offerDescription: { color: colors.textMuted, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 12 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, color: colors.textMain },
  textarea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
});
