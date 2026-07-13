import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BusinessVerificationStatus } from "@hoodna/shared";

const PRESENTATION: Record<BusinessVerificationStatus, { label: string; color: string; background: string }> = {
  VERIFIED: { label: "Verified", color: "#047857", background: "#D1FAE5" },
  CLAIMED: { label: "Claimed", color: "#106B60", background: "#E6F3F1" },
  UNVERIFIED: { label: "Unverified", color: "#6B7280", background: "#F3F4F6" },
};

export function BusinessVerificationBadge({ status }: { status: BusinessVerificationStatus }) {
  const item = PRESENTATION[status];
  return (
    <View
      accessible
      accessibilityLabel={`Business verification status: ${item.label}`}
      style={[styles.badge, { backgroundColor: item.background }]}
    >
      <Ionicons name={status === "VERIFIED" ? "checkmark-circle" : "shield-outline"} size={14} color={item.color} />
      <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 28, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 9 },
  label: { fontSize: 12, fontWeight: "700" },
});
