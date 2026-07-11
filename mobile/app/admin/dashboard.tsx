import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { openFileUrl } from "@/lib/file-url";

type AdminTab = "residents" | "providers" | "moderators";
type ReasonAction =
  | "resident-reject"
  | "provider-reject"
  | "provider-suspend"
  | "moderator-reject"
  | "moderator-suspend";

interface VerificationDocument {
  id: number;
  user_id: number;
  type: string;
  file_url: string;
  status: string;
  notes?: string;
  created_at: string;
  llm_verified?: number;
  llm_confidence?: number;
  llm_recommendation?: string;
  llm_reasoning?: string;
  user?: {
    name?: string;
    email?: string;
    compound_name?: string;
  };
}

interface ProviderProfile {
  id: number;
  user_id: number;
  business_name?: string;
  provider_type?: string;
  verification_method?: string;
  phone?: string;
  provider_status: string;
  submitted_at?: string;
  rejection_reason?: string;
  suspension_reason?: string;
  documents: Array<{
    id: number;
    document_type: string;
    file_url: string;
  }>;
}

interface ModeratorProfile {
  id: number;
  user_id: number;
  compound_id: number;
  compound_name?: string;
  role_title?: string;
  moderator_status: string;
  submitted_at?: string;
  rejection_reason?: string;
  suspension_reason?: string;
  documents: Array<{
    id: number;
    document_type: string;
    file_url: string;
  }>;
}

function formatLabel(value?: string | null): string {
  if (!value) return "Unknown";
  return value.toLowerCase().replace(/_/g, " ");
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: 10,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.backgroundCard,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={{ fontSize: 13, fontWeight: "800", color: active ? "#FFFFFF" : colors.textMain }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: active ? colors.primary : colors.backgroundCard,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : colors.textMain }}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.backgroundCard,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

function AdminActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: `${color}16`,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 8,
        marginBottom: 8,
      }}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color={color} style={{ marginRight: 6 }} />
      <Text style={{ fontSize: 13, fontWeight: "700", color }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const { user, apiClient } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("residents");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [residentDocs, setResidentDocs] = useState<VerificationDocument[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [moderators, setModerators] = useState<ModeratorProfile[]>([]);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonTargetId, setReasonTargetId] = useState<number | null>(null);
  const [reasonText, setReasonText] = useState("");

  const residentFilters = ["PENDING", "APPROVED", "REJECTED", "REQUEST_MORE_DETAILS"];
  const staffFilters = ["SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];

  useEffect(() => {
    setStatusFilter(activeTab === "residents" ? "PENDING" : "SUBMITTED");
    setSearchQuery("");
  }, [activeTab]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === "residents") {
        const params = new URLSearchParams({
          status_filter: statusFilter,
          limit: "50",
        });
        if (searchQuery.trim()) {
          params.append("search", searchQuery.trim());
        }
        const response = await apiClient.request<{ items?: VerificationDocument[] } | VerificationDocument[]>(
          `/api/admin/verifications?${params.toString()}`
        );
        setResidentDocs(Array.isArray(response) ? response : response.items || []);
        setProviders([]);
        setModerators([]);
      } else if (activeTab === "providers") {
        const data = await apiClient.getAdminProviders(statusFilter);
        setProviders(data || []);
        setResidentDocs([]);
        setModerators([]);
      } else {
        const data = await apiClient.getAdminModerators(statusFilter);
        setModerators(data || []);
        setResidentDocs([]);
        setProviders([]);
      }
    } catch (error: any) {
      console.error("Failed to load admin dashboard data:", error);
      Alert.alert("Error", error?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, apiClient, searchQuery, statusFilter]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      loadData();
    } else {
      setLoading(false);
    }
  }, [loadData, user?.role]);

  const stats = useMemo(() => {
    const currentItems =
      activeTab === "residents" ? residentDocs : activeTab === "providers" ? providers : moderators;

    return {
      total: currentItems.length,
      pending: currentItems.filter((item: any) =>
        String(item.status || item.provider_status || item.moderator_status).includes("PENDING") ||
        String(item.status || item.provider_status || item.moderator_status).includes("SUBMITTED") ||
        String(item.status || item.provider_status || item.moderator_status).includes("IN_REVIEW")
      ).length,
      approved: currentItems.filter((item: any) =>
        String(item.status || item.provider_status || item.moderator_status) === "APPROVED"
      ).length,
    };
  }, [activeTab, moderators, providers, residentDocs]);

  async function runAction(action: () => Promise<void>, targetId?: number) {
    try {
      if (targetId) {
        setProcessing(targetId);
      }
      await action();
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  }

  function openReasonModal(action: ReasonAction, id: number) {
    setReasonAction(action);
    setReasonTargetId(id);
    setReasonText("");
  }

  async function submitReasonAction() {
    if (!reasonAction || !reasonTargetId || !reasonText.trim()) {
      Alert.alert("Reason required", "Please provide a reason before continuing.");
      return;
    }

    const reason = reasonText.trim();
    const targetId = reasonTargetId;

    setReasonAction(null);
    setReasonTargetId(null);
    setReasonText("");

    await runAction(async () => {
      switch (reasonAction) {
        case "resident-reject":
          await apiClient.request(`/api/admin/verifications/${targetId}/reject`, {
            method: "POST",
            body: JSON.stringify({ notes: reason }),
          });
          return;
        case "provider-reject":
          await apiClient.rejectProvider(targetId, reason);
          return;
        case "provider-suspend":
          await apiClient.request(`/api/admin/providers/${targetId}/suspend`, {
            method: "POST",
            body: JSON.stringify({ reason }),
          });
          return;
        case "moderator-reject":
          await apiClient.rejectModerator(targetId, reason);
          return;
        case "moderator-suspend":
          await apiClient.request(`/api/admin/moderators/${targetId}/suspend`, {
            method: "POST",
            body: JSON.stringify({ reason }),
          });
          return;
      }
    }, targetId);
  }

  if (user?.role !== "ADMIN") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Header showLogo={true} showBackButton={true} title="Admin Dashboard" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="lock-closed-outline" size={38} color={colors.textMuted} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textMain, marginTop: 14, marginBottom: 8 }}>
            Access denied
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: "center" }}>
            This screen is only available to administrators.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabFilters = activeTab === "residents" ? residentFilters : staffFilters;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header showLogo={true} showBackButton={true} title="Admin Dashboard" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ padding: 16, paddingBottom: 40 }}>
          <View
            style={{
              backgroundColor: colors.backgroundCard,
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textMain, marginBottom: 8 }}>
              Review queue
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted }}>
              Mobile parity for the web admin dashboard: residents, service providers, and moderators are all reviewable here.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <TabButton label="Residents" active={activeTab === "residents"} onPress={() => setActiveTab("residents")} />
            <TabButton label="Providers" active={activeTab === "providers"} onPress={() => setActiveTab("providers")} />
            <TabButton label="Moderators" active={activeTab === "moderators"} onPress={() => setActiveTab("moderators")} />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <StatCard label="Loaded" value={stats.total} color={colors.textMain} />
            <StatCard label="Pending" value={stats.pending} color={colors.accent} />
            <StatCard label="Approved" value={stats.approved} color={colors.success} />
          </View>

          {activeTab === "residents" ? (
            <View
              style={{
                backgroundColor: colors.backgroundCard,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by resident name, email, or compound"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={loadData}
                style={{
                  backgroundColor: colors.gray50,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.textMain,
                  fontSize: 14,
                }}
              />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
            {tabFilters.map((filterValue) => (
              <FilterPill
                key={filterValue}
                label={formatLabel(filterValue)}
                active={statusFilter === filterValue}
                onPress={() => setStatusFilter(filterValue)}
              />
            ))}
          </View>

          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 14, color: colors.textMuted }}>Loading review items...</Text>
            </View>
          ) : null}

          {!loading && activeTab === "residents" ? (
            residentDocs.length > 0 ? (
              <View style={{ gap: 14 }}>
                {residentDocs.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      backgroundColor: colors.backgroundCard,
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMain, marginBottom: 4 }}>
                          {formatLabel(doc.type)}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
                          {doc.user?.name || `Resident #${doc.user_id}`} • {doc.user?.email || "No email"}
                        </Text>
                        {doc.user?.compound_name ? (
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                            {doc.user.compound_name}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          backgroundColor: doc.status === "APPROVED" ? "#DCFCE7" : doc.status === "REJECTED" ? "#FEE2E2" : "#FEF3C7",
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: doc.status === "APPROVED" ? "#166534" : doc.status === "REJECTED" ? "#991B1B" : "#92400E",
                          }}
                        >
                          {formatLabel(doc.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                      Submitted {new Date(doc.created_at).toLocaleString()}
                    </Text>

                    {doc.llm_recommendation ? (
                      <View
                        style={{
                          backgroundColor: "#EFF6FF",
                          borderRadius: 14,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
                          AI recommendation
                        </Text>
                        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMain }}>
                          {doc.llm_recommendation}
                        </Text>
                      </View>
                    ) : null}

                    {doc.notes ? (
                      <View
                        style={{
                          backgroundColor: "#FEF2F2",
                          borderRadius: 14,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.error, marginBottom: 4 }}>
                          Notes
                        </Text>
                        <Text style={{ fontSize: 13, lineHeight: 19, color: "#991B1B" }}>{doc.notes}</Text>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      <AdminActionButton label="Open document" icon="open-outline" color={colors.primary} onPress={() => openFileUrl(doc.file_url, apiClient)} />
                      <AdminActionButton
                        label={processing === doc.id ? "Working..." : "AI verify"}
                        icon="sparkles-outline"
                        color={colors.purple}
                        onPress={() =>
                          runAction(async () => {
                            const result = await apiClient.request<{ llm_result?: { recommendation?: string; reasoning?: string } }>(
                              `/api/admin/verifications/${doc.id}/verify-with-llm`,
                              { method: "POST" }
                            );
                            const recommendation = result?.llm_result?.recommendation || "AI verification completed.";
                            const reasoning = result?.llm_result?.reasoning ? `\n\n${result.llm_result.reasoning}` : "";
                            Alert.alert("AI verification", `${recommendation}${reasoning}`);
                          }, doc.id)
                        }
                      />
                      {doc.status === "PENDING" ? (
                        <>
                          <AdminActionButton
                            label="Approve"
                            icon="checkmark-circle-outline"
                            color={colors.success}
                            onPress={() =>
                              runAction(async () => {
                                await apiClient.request(`/api/admin/verifications/${doc.id}/approve`, {
                                  method: "POST",
                                  body: JSON.stringify({}),
                                });
                              }, doc.id)
                            }
                          />
                          <AdminActionButton
                            label="Reject"
                            icon="close-circle-outline"
                            color={colors.error}
                            onPress={() => openReasonModal("resident-reject", doc.id)}
                          />
                        </>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ textAlign: "center", color: colors.textMuted, marginTop: 32 }}>
                No resident verifications found for this filter.
              </Text>
            )
          ) : null}

          {!loading && activeTab === "providers" ? (
            providers.length > 0 ? (
              <View style={{ gap: 14 }}>
                {providers.map((provider) => (
                  <View
                    key={provider.id}
                    style={{
                      backgroundColor: colors.backgroundCard,
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMain, marginBottom: 4 }}>
                          {provider.business_name || `Provider #${provider.id}`}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
                          {formatLabel(provider.provider_type)} • {formatLabel(provider.verification_method)}
                        </Text>
                        {provider.phone ? (
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{provider.phone}</Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          backgroundColor:
                            provider.provider_status === "APPROVED"
                              ? "#DCFCE7"
                              : provider.provider_status === "REJECTED"
                                ? "#FEE2E2"
                                : provider.provider_status === "SUSPENDED"
                                  ? "#FDE68A"
                                  : "#DBEAFE",
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMain }}>
                          {formatLabel(provider.provider_status)}
                        </Text>
                      </View>
                    </View>

                    {provider.submitted_at ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                        Submitted {new Date(provider.submitted_at).toLocaleString()}
                      </Text>
                    ) : null}

                    {provider.rejection_reason ? (
                      <Text style={{ fontSize: 13, color: colors.error, marginBottom: 8 }}>
                        Rejection reason: {provider.rejection_reason}
                      </Text>
                    ) : null}

                    {provider.suspension_reason ? (
                      <Text style={{ fontSize: 13, color: "#92400E", marginBottom: 8 }}>
                        Suspension reason: {provider.suspension_reason}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
                      {provider.documents?.map((document) => (
                        <AdminActionButton
                          key={document.id}
                          label={formatLabel(document.document_type)}
                          icon="document-text-outline"
                          color={colors.primary}
                          onPress={() => openFileUrl(document.file_url, apiClient)}
                        />
                      ))}
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {(provider.provider_status === "SUBMITTED" || provider.provider_status === "IN_REVIEW") ? (
                        <>
                          <AdminActionButton
                            label="Approve"
                            icon="checkmark-circle-outline"
                            color={colors.success}
                            onPress={() => runAction(() => apiClient.approveProvider(provider.id), provider.id)}
                          />
                          <AdminActionButton
                            label="Reject"
                            icon="close-circle-outline"
                            color={colors.error}
                            onPress={() => openReasonModal("provider-reject", provider.id)}
                          />
                        </>
                      ) : null}
                      {provider.provider_status === "APPROVED" ? (
                        <AdminActionButton
                          label="Suspend"
                          icon="ban-outline"
                          color="#B45309"
                          onPress={() => openReasonModal("provider-suspend", provider.id)}
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ textAlign: "center", color: colors.textMuted, marginTop: 32 }}>
                No provider applications found for this filter.
              </Text>
            )
          ) : null}

          {!loading && activeTab === "moderators" ? (
            moderators.length > 0 ? (
              <View style={{ gap: 14 }}>
                {moderators.map((moderator) => (
                  <View
                    key={moderator.id}
                    style={{
                      backgroundColor: colors.backgroundCard,
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMain, marginBottom: 4 }}>
                          {moderator.role_title || `Moderator #${moderator.id}`}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
                          {moderator.compound_name || `Compound #${moderator.compound_id}`}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor:
                            moderator.moderator_status === "APPROVED"
                              ? "#DCFCE7"
                              : moderator.moderator_status === "REJECTED"
                                ? "#FEE2E2"
                                : moderator.moderator_status === "SUSPENDED"
                                  ? "#FDE68A"
                                  : "#DBEAFE",
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMain }}>
                          {formatLabel(moderator.moderator_status)}
                        </Text>
                      </View>
                    </View>

                    {moderator.submitted_at ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
                        Submitted {new Date(moderator.submitted_at).toLocaleString()}
                      </Text>
                    ) : null}

                    {moderator.rejection_reason ? (
                      <Text style={{ fontSize: 13, color: colors.error, marginBottom: 8 }}>
                        Rejection reason: {moderator.rejection_reason}
                      </Text>
                    ) : null}

                    {moderator.suspension_reason ? (
                      <Text style={{ fontSize: 13, color: "#92400E", marginBottom: 8 }}>
                        Suspension reason: {moderator.suspension_reason}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
                      {moderator.documents?.map((document) => (
                        <AdminActionButton
                          key={document.id}
                          label={formatLabel(document.document_type)}
                          icon="document-text-outline"
                          color={colors.primary}
                          onPress={() => openFileUrl(document.file_url, apiClient)}
                        />
                      ))}
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {(moderator.moderator_status === "SUBMITTED" || moderator.moderator_status === "IN_REVIEW") ? (
                        <>
                          <AdminActionButton
                            label="Approve"
                            icon="checkmark-circle-outline"
                            color={colors.success}
                            onPress={() => runAction(() => apiClient.approveModerator(moderator.id), moderator.id)}
                          />
                          <AdminActionButton
                            label="Reject"
                            icon="close-circle-outline"
                            color={colors.error}
                            onPress={() => openReasonModal("moderator-reject", moderator.id)}
                          />
                        </>
                      ) : null}
                      {moderator.moderator_status === "APPROVED" ? (
                        <AdminActionButton
                          label="Suspend"
                          icon="ban-outline"
                          color="#B45309"
                          onPress={() => openReasonModal("moderator-suspend", moderator.id)}
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ textAlign: "center", color: colors.textMuted, marginTop: 32 }}>
                No moderator applications found for this filter.
              </Text>
            )
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={!!reasonAction} transparent animationType="fade" onRequestClose={() => setReasonAction(null)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 22,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textMain, marginBottom: 8 }}>
              Reason required
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted, marginBottom: 14 }}>
              Provide the reason that will be stored with this decision.
            </Text>
            <TextInput
              multiline
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Write the reason here..."
              placeholderTextColor={colors.textMuted}
              style={{
                minHeight: 120,
                textAlignVertical: "top",
                backgroundColor: colors.gray50,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.textMain,
              }}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  paddingVertical: 12,
                }}
                onPress={() => {
                  setReasonAction(null);
                  setReasonTargetId(null);
                  setReasonText("");
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.textMain }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  backgroundColor: colors.error,
                  alignItems: "center",
                  paddingVertical: 12,
                }}
                onPress={submitReasonAction}
              >
                <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
