import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PublicUserProfile } from "@hoodna/shared";
import { spacing, typography } from "@hoodna/tokens";

import { Avatar } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function NeighbourProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const router = useRouter();
  const { apiClient, user } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!apiClient || !Number.isFinite(userId) || userId <= 0) {
        setError("Invalid profile");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await apiClient.getPublicUserProfile(userId);
        if (!cancelled) {
          setProfile(data);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Could not load profile");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiClient, userId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Neighbour</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error || !profile ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Profile unavailable"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Avatar
              name={profile.name}
              fileUrl={profile.avatar_url}
              apiClient={apiClient}
              size={88}
            />
            <Text style={styles.name}>{profile.name}</Text>
            {profile.is_verified ? (
              <Text style={styles.verified}>Verified neighbour</Text>
            ) : null}
            {profile.compound_name ? (
              <Text style={styles.meta}>{profile.compound_name}</Text>
            ) : null}
            {profile.joined_at ? (
              <Text style={styles.meta}>
                Member since{" "}
                {new Date(profile.joined_at).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            ) : null}
          </View>

          {(profile.phone || profile.email) && (
            <View style={styles.card}>
              {profile.phone ? (
                <Text style={styles.row}>Phone · {profile.phone}</Text>
              ) : null}
              {profile.email ? (
                <Text style={styles.row}>Email · {profile.email}</Text>
              ) : null}
            </View>
          )}

          {profile.is_own_profile ? (
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push("/settings")}
            >
              <Text style={styles.buttonText}>Manage public profile privacy</Text>
            </TouchableOpacity>
          ) : user ? (
            <TouchableOpacity
              style={styles.button}
              onPress={() =>
                router.push({
                  pathname: "/messages/index",
                  params: { recipient_id: String(profile.id) },
                } as any)
              }
            >
              <Text style={styles.buttonText}>Message</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: "600",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.textMuted, textAlign: "center", padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.sm },
  name: { ...typography.title, color: colors.text, fontWeight: "700" },
  verified: { color: colors.primary, fontWeight: "600" },
  meta: { color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { color: colors.text },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
