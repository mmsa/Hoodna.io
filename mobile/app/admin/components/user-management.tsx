import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatUserRole, formatUserStatus } from "@/utils/format-enums";
import { UserDetailModal } from "./user-detail-modal";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  status: string;
  compound_id?: number;
  compound_name?: string;
  created_at: string;
}

const PAGE_SIZE = 25;
const ROLE_FILTERS = ["ALL", "RESIDENT", "SERVICE_PROVIDER", "COMPOUND_MOD", "ADMIN"];
const STATUS_FILTERS = ["ALL", "PENDING_VERIFICATION", "APPROVED", "REJECTED", "BANNED"];

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
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : colors.textMain }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function UserManagement() {
  const { apiClient } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminUsers({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        role_filter: roleFilter !== "ALL" ? roleFilter : undefined,
        status_filter: statusFilter !== "ALL" ? statusFilter : undefined,
        sort_by: "created_at_desc",
      });
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [apiClient, debouncedSearch, page, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function runUserAction(action: () => Promise<void>, userId?: number) {
    try {
      if (userId) setProcessing(userId);
      await action();
      await loadUsers();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  }

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const roleLabels = useMemo(
    () =>
      Object.fromEntries(
        ROLE_FILTERS.map((v) => [v, v === "ALL" ? "All roles" : formatUserRole(v)])
      ),
    []
  );

  const statusLabels = useMemo(
    () =>
      Object.fromEntries(
        STATUS_FILTERS.map((v) => [v, v === "ALL" ? "All status" : formatUserStatus(v)])
      ),
    []
  );

  return (
    <View>
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
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by ID, name, email, phone…"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.gray50,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: colors.textMain,
            fontSize: 14,
            marginBottom: 10,
          }}
        />
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6 }}>Role</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row" }}>
            {ROLE_FILTERS.map((v) => (
              <FilterPill
                key={v}
                label={roleLabels[v]}
                active={roleFilter === v}
                onPress={() => {
                  setRoleFilter(v);
                  setPage(0);
                }}
              />
            ))}
          </View>
        </ScrollView>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6 }}>Status</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((v) => (
            <FilterPill
              key={v}
              label={statusLabels[v]}
              active={statusFilter === v}
              onPress={() => {
                setStatusFilter(v);
                setPage(0);
              }}
            />
          ))}
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
          {total} user{total !== 1 ? "s" : ""}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <Text style={{ textAlign: "center", color: colors.textMuted, marginTop: 24 }}>No users found</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {users.map((user) => (
            <View
              key={user.id}
              style={{
                backgroundColor: colors.backgroundCard,
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textMain, flex: 1 }}>{user.name}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>#{user.id}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>{user.email}</Text>
              {user.phone ? <Text style={{ fontSize: 13, color: colors.textMuted }}>{user.phone}</Text> : null}
              {user.compound_name ? (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{user.compound_name}</Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <View style={{ backgroundColor: colors.gray50, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700" }}>{formatUserRole(user.role)}</Text>
                </View>
                <View
                  style={{
                    backgroundColor: user.status === "APPROVED" ? "#DCFCE7" : user.status === "BANNED" ? "#1F2937" : "#DBEAFE",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: user.status === "BANNED" ? "#FFF" : colors.textMain }}>
                    {formatUserStatus(user.status)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 8 }}
                  onPress={() => setDetailUserId(user.id)}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.primary} />
                  <Text style={{ marginLeft: 4, fontWeight: "700", color: colors.primary }}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 8 }}
                  onPress={() => {
                    setResetUser(user);
                    setNewPassword("");
                  }}
                >
                  <Ionicons name="key-outline" size={16} color={colors.textMain} />
                  <Text style={{ marginLeft: 4, fontWeight: "700", color: colors.textMain }}>Reset password</Text>
                </TouchableOpacity>
                {user.status !== "APPROVED" ? (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 8 }}
                    disabled={processing === user.id}
                    onPress={() => void runUserAction(async () => { await apiClient.adminApproveUser(user.id); }, user.id)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                    <Text style={{ marginLeft: 4, fontWeight: "700", color: colors.success }}>Approve</Text>
                  </TouchableOpacity>
                ) : null}
                {user.status !== "BANNED" && user.role !== "ADMIN" ? (
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
                    disabled={processing === user.id}
                    onPress={() =>
                      Alert.alert("Ban user", `Ban ${user.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Ban",
                          style: "destructive",
                          onPress: () => void runUserAction(async () => { await apiClient.adminBanUser(user.id); }, user.id),
                        },
                      ])
                    }
                  >
                    <Ionicons name="ban-outline" size={16} color={colors.error} />
                    <Text style={{ marginLeft: 4, fontWeight: "700", color: colors.error }}>Ban</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {total > 0 ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {rangeStart}–{rangeEnd} of {total}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              disabled={page === 0}
              onPress={() => setPage((p) => p - 1)}
              style={{ opacity: page === 0 ? 0.4 : 1, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textMain} />
            </TouchableOpacity>
            <Text style={{ alignSelf: "center", fontWeight: "700" }}>
              {page + 1}/{totalPages}
            </Text>
            <TouchableOpacity
              disabled={page + 1 >= totalPages}
              onPress={() => setPage((p) => p + 1)}
              style={{ opacity: page + 1 >= totalPages ? 0.4 : 1, padding: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.textMain} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <UserDetailModal
        userId={detailUserId}
        visible={detailUserId != null}
        onClose={() => setDetailUserId(null)}
        onRefresh={loadUsers}
        onResetPassword={(u) => {
          setDetailUserId(null);
          setResetUser({ ...u, status: "PENDING_VERIFICATION", created_at: new Date().toISOString() });
          setNewPassword("");
        }}
      />

      <Modal visible={resetUser != null} transparent animationType="fade" onRequestClose={() => setResetUser(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#FFF", borderRadius: 22, padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 8 }}>Reset password</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 12 }}>
              {resetUser?.name} ({resetUser?.email})
            </Text>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min 6 chars)"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.gray50,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setResetUser(null)}
              >
                <Text style={{ fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 14, backgroundColor: colors.primary }}
                onPress={() => {
                  if (!resetUser || newPassword.length < 6) {
                    Alert.alert("Error", "Password must be at least 6 characters");
                    return;
                  }
                  runUserAction(async () => {
                    await apiClient.adminResetUserPassword({
                      email: resetUser.email,
                      new_password: newPassword,
                    });
                    setResetUser(null);
                    setNewPassword("");
                    Alert.alert("Success", "Password updated");
                  });
                }}
              >
                <Text style={{ fontWeight: "700", color: "#FFF" }}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
