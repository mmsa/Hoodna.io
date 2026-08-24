import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { formatCompoundName } from "@/utils/formatCompound";

type Invite = {
  compound_id: number;
  compound_name: string;
  compound_area?: string | null;
};

export function CompoundInviteCard() {
  const { apiClient, refreshUser } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!apiClient) return;
    try {
      const rows = await apiClient.getCompoundInvites();
      setInvites(rows || []);
    } catch (error) {
      console.error("Failed to load compound invites:", error);
    }
  }, [apiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!invites.length) return null;

  return (
    <View style={styles.wrap}>
      {invites.map((invite) => (
        <View key={invite.compound_id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="home-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>
                Join {formatCompoundName(invite.compound_name)}?
              </Text>
              <Text style={styles.body}>
                You were invited from the compound group chat. Confirm to unlock access.
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primary]}
              disabled={busyId === invite.compound_id}
              onPress={async () => {
                if (!apiClient) return;
                setBusyId(invite.compound_id);
                try {
                  await apiClient.confirmCompoundInvite(invite.compound_id);
                  await refreshUser?.();
                  await load();
                  Alert.alert("Joined", `You’re now in ${formatCompoundName(invite.compound_name)}.`);
                } catch (error: any) {
                  Alert.alert("Could not confirm", error?.message || "Try again.");
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <Text style={styles.primaryText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              disabled={busyId === invite.compound_id}
              onPress={async () => {
                if (!apiClient) return;
                setBusyId(invite.compound_id);
                try {
                  await apiClient.declineCompoundInvite(invite.compound_id);
                  await load();
                } catch (error: any) {
                  Alert.alert("Could not decline", error?.message || "Try again.");
                } finally {
                  setBusyId(null);
                }
              }}
            >
              <Text style={styles.secondaryText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3], marginBottom: spacing[4] },
  card: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: palette.primarySoft,
    borderRadius: radii.large,
    padding: spacing[4],
    gap: spacing[3],
  },
  row: { flexDirection: "row", gap: spacing[3] },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
  },
  copy: { flex: 1, gap: 4 },
  title: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: { flexDirection: "row", gap: spacing[2] },
  button: {
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryText: {
    color: palette.onPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.bodySmall,
  },
  secondaryText: {
    color: colors.textMain,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.bodySmall,
  },
});
