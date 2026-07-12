import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/constants/colors";
import { openFileUrl } from "@/lib/file-url";
import {
  formatDocumentType,
  formatModeratorStatus,
  formatProviderStatus,
  formatUserRole,
  formatUserStatus,
} from "@/utils/format-enums";

interface UserDetailModalProps {
  userId: number | null;
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onResetPassword: (user: { id: number; name: string; email: string }) => void;
}

export function UserDetailModal({ userId, visible, onClose, onRefresh, onResetPassword }: UserDetailModalProps) {
  const { apiClient } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiClient.getAdminUserDetail(userId);
        if (!cancelled) setDetail(data);
      } catch (error: any) {
        if (!cancelled) Alert.alert("Error", error?.message || "Failed to load user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, userId, apiClient]);

  async function runAction(action: () => Promise<void>, successMsg: string) {
    try {
      setProcessing(true);
      await action();
      Alert.alert("Success", successMsg);
      onRefresh();
      if (userId) {
        const data = await apiClient.getAdminUserDetail(userId);
        setDetail(data);
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Action failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", flex: 1 }} numberOfLines={1}>
            {detail?.name || "User details"}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : detail ? (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 12 }}>
              {detail.email} · ID {detail.id}
            </Text>

            <Section title="Account">
              <Row label="Phone" value={detail.phone} />
              <Row label="Role" value={formatUserRole(detail.role)} />
              <Row label="Status" value={formatUserStatus(detail.status)} />
              <Row label="Verification" value={detail.verification_status} />
              <Row
                label="Compound"
                value={
                  detail.compound_name
                    ? `${detail.compound_name}${detail.compound_area ? ` (${detail.compound_area})` : ""}`
                    : undefined
                }
              />
              <Row label="Joined" value={new Date(detail.created_at).toLocaleString()} />
            </Section>

            <Section title="Permissions">
              <Text style={{ fontSize: 13, color: colors.textMain }}>
                Post: {detail.can_post ? "Yes" : "No"} · Comment: {detail.can_comment ? "Yes" : "No"} · Listing:{" "}
                {detail.can_create_listing ? "Yes" : "No"}
              </Text>
            </Section>

            {detail.activity ? (
              <Section title="Activity">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[
                    ["Posts", detail.activity.posts],
                    ["Comments", detail.activity.comments],
                    ["Listings", detail.activity.listings],
                    ["Messages", detail.activity.messages_sent],
                    ["Reviews", detail.activity.reviews],
                  ].map(([label, count]) => (
                    <View
                      key={label as string}
                      style={{
                        backgroundColor: colors.backgroundCard,
                        borderRadius: 12,
                        padding: 10,
                        minWidth: "30%",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: "800" }}>{count as number}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>{label as string}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {detail.verification_documents?.length > 0 ? (
              <Section title="Verification documents">
                {detail.verification_documents.map((doc: any) => (
                  <View
                    key={doc.id}
                    style={{
                      backgroundColor: colors.backgroundCard,
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontWeight: "700", marginBottom: 4 }}>{formatDocumentType(doc.type)}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>{doc.status}</Text>
                    <TouchableOpacity onPress={() => openFileUrl(doc.file_url, apiClient)}>
                      <Text style={{ color: colors.primary, fontWeight: "700" }}>View document</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </Section>
            ) : null}

            {detail.provider_profile ? (
              <Section title="Service provider">
                <Row label="Business" value={detail.provider_profile.business_name} />
                <Row label="Status" value={formatProviderStatus(detail.provider_profile.provider_status)} />
              </Section>
            ) : null}

            {detail.moderator_profile ? (
              <Section title="Moderator">
                <Row label="Compound" value={detail.moderator_profile.compound_name} />
                <Row label="Status" value={formatModeratorStatus(detail.moderator_profile.moderator_status)} />
              </Section>
            ) : null}

            <CompoundAccessSection
              userId={detail.id}
              userStatus={detail.status}
              primaryCompoundId={detail.compound_id}
              memberships={detail.compound_memberships || []}
              apiClient={apiClient}
              onSaved={async () => {
                onRefresh();
                if (userId) {
                  const data = await apiClient.getAdminUserDetail(userId);
                  setDetail(data);
                }
              }}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <ActionChip
                label="Reset password"
                icon="key-outline"
                onPress={() =>
                  onResetPassword({ id: detail.id, name: detail.name, email: detail.email })
                }
              />
              {detail.status !== "APPROVED" ? (
                <ActionChip
                  label="Approve user"
                  icon="checkmark-circle-outline"
                  color={colors.success}
                  disabled={processing}
                  onPress={() => void runAction(async () => { await apiClient.adminApproveUser(detail.id); }, "User approved")}
                />
              ) : null}
              {detail.status !== "BANNED" && detail.role !== "ADMIN" ? (
                <ActionChip
                  label="Ban user"
                  icon="ban-outline"
                  color={colors.error}
                  disabled={processing}
                  onPress={() =>
                    Alert.alert("Ban user", "Are you sure?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Ban",
                        style: "destructive",
                        onPress: () => void runAction(async () => { await apiClient.adminBanUser(detail.id); }, "User banned"),
                      },
                    ])
                  }
                />
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textMain, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 6 }}>
      <Text style={{ width: 100, fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: colors.textMain }}>{value || "—"}</Text>
    </View>
  );
}

function CompoundAccessSection({
  userId,
  userStatus,
  primaryCompoundId,
  memberships,
  apiClient,
  onSaved,
}: {
  userId: number;
  userStatus: string;
  primaryCompoundId?: number | null;
  memberships: Array<{
    compound_id: number;
    compound_name?: string;
    compound_area?: string;
    is_verified?: boolean;
    verification_status?: string;
  }>;
  apiClient: any;
  onSaved: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compounds, setCompounds] = useState<Array<{ id: number; name: string; area?: string | null }>>([]);
  const [loadingCompounds, setLoadingCompounds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [approveUser, setApproveUser] = useState(false);

  useEffect(() => {
    const verifiedIds = memberships
      .filter((m) => m.is_verified ?? m.verification_status === "VERIFIED")
      .map((m) => m.compound_id);
    setSelectedIds(verifiedIds);
    setPrimaryId(
      primaryCompoundId && verifiedIds.includes(primaryCompoundId)
        ? primaryCompoundId
        : verifiedIds[0] ?? null
    );
  }, [memberships, primaryCompoundId, userId]);

  async function openPicker() {
    setPickerOpen(true);
    if (compounds.length > 0) return;
    setLoadingCompounds(true);
    try {
      const data = await apiClient.getCompounds({ limit: 500 });
      setCompounds(data || []);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load compounds");
    } finally {
      setLoadingCompounds(false);
    }
  }

  function toggle(id: number) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (primaryId === id) setPrimaryId(next[0] ?? null);
        return next;
      }
      const next = [...prev, id];
      if (primaryId == null) setPrimaryId(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await apiClient.adminSetUserCompounds(userId, {
        compound_ids: selectedIds,
        primary_compound_id: primaryId ?? undefined,
        approve_user: approveUser,
      });
      Alert.alert("Saved", "Neighbourhood access updated");
      setPickerOpen(false);
      onSaved();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const filtered = compounds.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.area && c.area.toLowerCase().includes(q));
  });

  return (
    <Section title="Neighbourhood access">
      {memberships.length > 0 ? (
        memberships.map((m) => (
          <Text key={m.compound_id} style={{ fontSize: 13, color: colors.textMain, marginBottom: 4 }}>
            {m.compound_name || `Compound ${m.compound_id}`}
            {m.compound_area ? ` (${m.compound_area})` : ""}
            {` · ${m.is_verified ? "verified" : "pending"}`}
            {primaryCompoundId === m.compound_id ? " · primary" : ""}
          </Text>
        ))
      ) : (
        <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>No compounds assigned</Text>
      )}
      <TouchableOpacity
        onPress={openPicker}
        style={{
          marginTop: 8,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "700" }}>Manage compounds</Text>
      </TouchableOpacity>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 56 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800" }}>Assign compounds</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Ionicons name="close" size={24} color={colors.textMain} />
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Search compounds…"
            value={search}
            onChangeText={setSearch}
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.backgroundCard,
            }}
          />
          {loadingCompounds ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
          ) : (
            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
              {filtered.slice(0, 100).map((c) => {
                const checked = selectedIds.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => toggle(c.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name={checked ? "checkbox" : "square-outline"}
                      size={22}
                      color={checked ? colors.primary : colors.textMuted}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600" }}>{c.name}</Text>
                      {c.area ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{c.area}</Text> : null}
                    </View>
                    {checked ? (
                      <TouchableOpacity onPress={() => setPrimaryId(c.id)} style={{ padding: 4 }}>
                        <Ionicons
                          name={primaryId === c.id ? "star" : "star-outline"}
                          size={20}
                          color={primaryId === c.id ? "#F59E0B" : colors.textMuted}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {userStatus !== "APPROVED" && selectedIds.length > 0 ? (
            <TouchableOpacity
              onPress={() => setApproveUser((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Ionicons
                name={approveUser ? "checkbox" : "square-outline"}
                size={20}
                color={colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text>Also approve user account</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            disabled={saving}
            onPress={save}
            style={{
              margin: 16,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontWeight: "700" }}>Save ({selectedIds.length} selected)</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </Section>
  );
}

function ActionChip({
  label,
  icon,
  color = colors.primary,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: `${color}14`,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ marginLeft: 6, fontWeight: "700", color }}>{label}</Text>
    </TouchableOpacity>
  );
}
