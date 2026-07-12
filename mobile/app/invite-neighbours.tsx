import { useCallback, useEffect, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { buildReferralSharePayload, type ReferralMe, type ReferralStats } from "@hoodna/shared";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { useTelemetry } from "@/contexts/TelemetryContext";

export default function InviteNeighboursScreen() {
  const { apiClient } = useAuth();
  const enabled = useFeature("invitations");
  const { track } = useTelemetry();
  const [invite, setInvite] = useState<ReferralMe | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [nextInvite, nextStats] = await Promise.all([
        apiClient.getReferralMe(),
        apiClient.getReferralStats(),
      ]);
      setInvite(nextInvite);
      setStats(nextStats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
  }, [enabled, load]);

  async function shareInvite() {
    if (!invite) return;
    setSharing(true);
    try {
      const payload = buildReferralSharePayload(invite.code);
      const result = await Share.share({ title: payload.title, message: payload.message, url: payload.url });
      if (result.action === Share.sharedAction) track("invite_shared", { channel: "native_share" });
    } catch {
      Alert.alert("Could not share", "Please try sharing your invitation again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <Header title="Invite neighbours" showBackButton showLogo={false} />
      {!enabled ? (
        <EmptyState title="Invitations are not available" description="This feature will return when invitations reopen." />
      ) : loading ? (
        <LoadingState label="Loading your invitation" />
      ) : error ? (
        <ErrorState description="We could not load your invitation." onRetry={load} />
      ) : (
        <View style={styles.content}>
          <View style={styles.hero}>
            <Ionicons name="people-outline" size={42} color={colors.primary} />
            <Text accessibilityRole="header" style={styles.title}>Bring your neighbours together</Text>
            <Text style={styles.description}>Share your personal invitation link. New neighbours can use it when creating their account.</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.number}>{stats?.invitations_sent ?? 0}</Text><Text style={styles.label}>Invites sent</Text></View>
            <View style={styles.stat}><Text style={styles.number}>{stats?.successful_registrations ?? 0}</Text><Text style={styles.label}>Joined</Text></View>
          </View>
          <Text selectable style={styles.link}>{invite?.invite_url}</Text>
          <Button
            accessibilityLabel="Share invitation with neighbours"
            loading={sharing}
            loadingLabel="Opening share sheet"
            leading={<Ionicons name="share-outline" size={20} color="#FFFFFF" />}
            onPress={shareInvite}
          >
            Share invitation
          </Button>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18 },
  hero: { backgroundColor: colors.backgroundCard, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: "center" },
  title: { color: colors.textMain, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 12 },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  number: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  label: { color: colors.textMuted, marginTop: 3 },
  link: { color: colors.textMuted, backgroundColor: colors.gray100, borderRadius: 10, padding: 12, fontSize: 13 },
});
