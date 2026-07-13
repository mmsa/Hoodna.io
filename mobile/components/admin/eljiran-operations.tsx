import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  AdminBetaMetrics,
  BusinessClaim,
  FeatureFlag,
  ReportResponse,
  ReportStatus,
} from "@hoodna/shared";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type Section = "claims" | "moderation" | "rollout";
type ClaimList = { items: BusinessClaim[]; total: number; skip: number; limit: number };
type PendingAction = {
  kind: "claim" | "report";
  id: number;
  action: string;
  title: string;
};

const label = (value: string) => value.toLowerCase().replace(/_/g, " ");

function Pill({
  text,
  active,
  onPress,
}: {
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 9,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.backgroundCard,
      }}
    >
      <Text style={{ color: active ? "#FFF" : colors.textMain, fontWeight: "700", fontSize: 12 }}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function Action({
  text,
  tone = colors.primary,
  onPress,
  disabled = false,
}: {
  text: string;
  tone?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 11,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginRight: 8,
        marginTop: 8,
        backgroundColor: `${tone}18`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: tone, fontWeight: "800", fontSize: 13 }}>{text}</Text>
    </TouchableOpacity>
  );
}

function StateMessage({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: string;
  onRetry: () => void;
}) {
  if (loading) {
    return <View style={{ alignItems: "center", paddingVertical: 48 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textMuted, marginTop: 10 }}>Loading…</Text></View>;
  }
  if (error) {
    return <View style={{ alignItems: "center", padding: 24 }}><Text accessibilityRole="alert" style={{ color: colors.error, textAlign: "center" }}>{error}</Text><Action text="Retry" onPress={onRetry} /></View>;
  }
  return <Text style={{ color: colors.textMuted, textAlign: "center", paddingVertical: 40 }}>{empty}</Text>;
}

export function EljiranOperations() {
  const { apiClient } = useAuth();
  const [section, setSection] = useState<Section>("claims");
  const [status, setStatus] = useState("PENDING");
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [metrics, setMetrics] = useState<AdminBetaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setStatus(section === "claims" ? "PENDING" : section === "moderation" ? "OPEN" : "");
  }, [section]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (section === "claims") {
        const result = await apiClient.getAdminBusinessClaims(status || "PENDING") as ClaimList;
        setClaims(result.items || []);
      } else if (section === "moderation") {
        const query = new URLSearchParams({ status_filter: status || "OPEN", limit: "100" });
        setReports(await apiClient.request<ReportResponse[]>(`/api/reports?${query}`));
      } else {
        const [nextFlags, nextMetrics] = await Promise.all([
          apiClient.getAdminFeatureFlags(),
          apiClient.getAdminBetaMetrics(),
        ]);
        setFlags(nextFlags);
        setMetrics(nextMetrics);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load admin operations.");
    } finally {
      setLoading(false);
    }
  }, [apiClient, section, status]);

  useEffect(() => { void load(); }, [load]);

  const perform = async (work: () => Promise<unknown>, id?: number) => {
    try {
      setProcessing(id || -1);
      await work();
      Alert.alert("Updated", "The operational change was saved.");
      await load();
    } catch (nextError) {
      Alert.alert("Action failed", nextError instanceof Error ? nextError.message : "Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const submitAction = async () => {
    if (!pendingAction || !reason.trim()) return;
    const action = pendingAction;
    const note = reason.trim();
    setPendingAction(null);
    setReason("");
    await perform(async () => {
      if (action.kind === "claim") {
        await apiClient.reviewBusinessClaim(action.id, {
          status: action.action as "APPROVED" | "REJECTED",
          review_notes: note,
          membership_role: "OWNER",
        });
      } else {
        await apiClient.updateReport(action.id, {
          status: action.action as ReportStatus,
          review_notes: note,
        });
      }
    }, action.id);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        <Pill text="Business claims" active={section === "claims"} onPress={() => setSection("claims")} />
        <Pill text="Moderation" active={section === "moderation"} onPress={() => setSection("moderation")} />
        <Pill text="Rollout" active={section === "rollout"} onPress={() => setSection("rollout")} />
      </View>

      {section === "claims" ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain }}>Business claim queue</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>Review claimant context before granting ownership.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["PENDING", "APPROVED", "REJECTED"].map((value) => <Pill key={value} text={label(value)} active={status === value} onPress={() => setStatus(value)} />)}
          </View>
          {loading || error || !claims.length ? <StateMessage loading={loading} error={error} empty="No claims in this queue." onRetry={load} /> :
            <View style={{ gap: 12 }}>{claims.map((claim) => (
              <View key={claim.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard, padding: 16 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textMain }}>{claim.business_name || `Business #${claim.business_id}`}</Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>{claim.full_name} · {claim.relationship_role}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{claim.email} · {claim.phone}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Submitted {new Date(claim.submitted_at).toLocaleString()}</Text>
                {claim.supporting_info || claim.supporting_information ? <Text style={{ color: colors.textMain, marginTop: 10, lineHeight: 20 }}>{claim.supporting_info || claim.supporting_information}</Text> : null}
                {claim.review_notes ? <Text style={{ color: colors.textMuted, marginTop: 10 }}>Review note: {claim.review_notes}</Text> : null}
                {claim.status === "PENDING" ? <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  <Action text="Approve" tone={colors.success} disabled={processing === claim.id} onPress={() => setPendingAction({ kind: "claim", id: claim.id, action: "APPROVED", title: "Approve business claim" })} />
                  <Action text="Reject" tone={colors.error} disabled={processing === claim.id} onPress={() => setPendingAction({ kind: "claim", id: claim.id, action: "REJECTED", title: "Reject business claim" })} />
                </View> : null}
              </View>
            ))}</View>}
        </>
      ) : null}

      {section === "moderation" ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain }}>Moderation queue</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>Triage reports with an internal decision note.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"].map((value) => <Pill key={value} text={label(value)} active={status === value} onPress={() => setStatus(value)} />)}
          </View>
          {loading || error || !reports.length ? <StateMessage loading={loading} error={error} empty="No reports in this queue." onRetry={load} /> :
            <View style={{ gap: 12 }}>{reports.map((report) => (
              <View key={report.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard, padding: 16 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textMain }}>{label(report.reported_type)} #{report.reported_id}</Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>{label(report.reason)} · {report.reporter_name || `Reporter #${report.reporter_id}`}</Text>
                {report.description ? <Text style={{ color: colors.textMain, marginTop: 10, lineHeight: 20 }}>{report.description}</Text> : null}
                {report.review_notes ? <Text style={{ color: colors.textMuted, marginTop: 10 }}>Internal note: {report.review_notes}</Text> : null}
                {!["RESOLVED", "DISMISSED"].includes(report.status) ? <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {report.status === "OPEN" ? <Action text="Start review" onPress={() => setPendingAction({ kind: "report", id: report.id, action: "UNDER_REVIEW", title: "Start report review" })} /> : null}
                  <Action text="Resolve" tone={colors.success} onPress={() => setPendingAction({ kind: "report", id: report.id, action: "RESOLVED", title: "Resolve report" })} />
                  <Action text="Dismiss" tone={colors.error} onPress={() => setPendingAction({ kind: "report", id: report.id, action: "DISMISSED", title: "Dismiss report" })} />
                </View> : null}
              </View>
            ))}</View>}
        </>
      ) : null}

      {section === "rollout" ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain }}>Beta snapshot</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>Concise controls for urgent phone operations; use web for scoped overrides and trends.</Text>
          {loading || error || (!metrics && !flags.length) ? <StateMessage loading={loading} error={error} empty="No rollout data available." onRetry={load} /> : <>
            {metrics ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              {[
                ["Active users", metrics.active_users],
                ["Claims", metrics.business_claims],
                ["Reports waiting", metrics.reports_awaiting_review],
                ["Client errors", metrics.client_errors],
                ["Onboarding", `${(metrics.onboarding_completion_rate * 100).toFixed(0)}%`],
              ].map(([name, value]) => <View key={String(name)} style={{ width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard }}>
                <Text style={{ fontSize: 21, fontWeight: "800", color: colors.textMain }}>{value}</Text><Text style={{ fontSize: 12, color: colors.textMuted }}>{name}</Text>
              </View>)}
            </View> : null}
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMain, marginBottom: 8 }}>Global feature defaults</Text>
            <View style={{ gap: 10 }}>{flags.map((flag) => <View key={flag.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard }}>
              <View style={{ flex: 1, paddingRight: 12 }}><Text style={{ fontWeight: "800", color: colors.textMain }}>{label(flag.key)}</Text><Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>{flag.enabled ? "Enabled globally" : "Disabled globally"}</Text></View>
              <Action text={flag.enabled ? "Disable" : "Enable"} tone={flag.enabled ? colors.error : colors.success} disabled={processing === flag.id} onPress={() => Alert.alert(
                `${flag.enabled ? "Disable" : "Enable"} ${label(flag.key)}?`,
                "This changes the global default. Scoped overrides may still take precedence.",
                [{ text: "Cancel", style: "cancel" }, { text: "Confirm", style: flag.enabled ? "destructive" : "default", onPress: () => perform(() => apiClient.updateAdminFeatureFlag(flag.key, { enabled: !flag.enabled, description: flag.description, config: flag.config || {} }), flag.id) }],
              )} />
            </View>)}</View>
          </>}
        </>
      ) : null}

      <Modal visible={pendingAction != null} transparent animationType="fade" onRequestClose={() => setPendingAction(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(15,23,42,0.5)" }}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: "#FFF" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain }}>{pendingAction?.title}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, marginBottom: 12 }}>A reason or internal note is required for the audit trail.</Text>
            <TextInput
              accessibilityLabel="Decision reason"
              autoFocus
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Enter concise decision context"
              placeholderTextColor={colors.textMuted}
              style={{ minHeight: 110, textAlignVertical: "top", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textMain }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
              <Action text="Cancel" tone={colors.textMuted} onPress={() => { setPendingAction(null); setReason(""); }} />
              <Action text="Confirm" disabled={!reason.trim()} onPress={submitAction} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
