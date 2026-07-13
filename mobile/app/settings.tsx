import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { AccountDeletionRequest, UserPreferences } from "@hoodna/shared";
import { useFeature } from "@/contexts/FeatureConfigContext";
import { LanguagePicker } from "@/components/LanguagePicker";

export default function SettingsScreen() {
  const { user, apiClient, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const invitationsEnabled = useFeature("invitations");
  const router = useRouter();

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiClient.getUserPreferences(),
      apiClient.getAccountDeletionRequest(),
    ]).then(([nextPreferences, nextDeletion]) => {
      if (!active) return;
      setPreferences(nextPreferences);
      setDeletionRequest(nextDeletion);
    }).catch(() => undefined).finally(() => {
      if (active) setPreferencesLoading(false);
    });
    return () => {
      active = false;
    };
  }, [apiClient]);

  async function updatePreference(key: keyof Omit<UserPreferences, "updated_at">, value: boolean) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
    try {
      setPreferences(await apiClient.updateUserPreferences({ [key]: value }));
    } catch {
      setPreferences(previous);
      Alert.alert(t("settings.couldNotSave"), t("settings.notificationNotChanged"));
    }
  }

  async function requestDeletion() {
    if (deletionConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      const request = await apiClient.requestAccountDeletion({
        confirmation: "DELETE",
        reason: deletionReason.trim() || undefined,
      });
      setDeletionRequest(request);
      setDeletionConfirmation("");
      Alert.alert(t("settings.requestReceived"), t("settings.deletionPending"));
    } catch (error: any) {
      Alert.alert(t("settings.couldNotSubmit"), error.message || t("common.retry"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.request("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
        }),
      });
      await refreshUser();
      Alert.alert(t("settings.success"), t("settings.settingsSaved"));
    } catch (error: any) {
      Alert.alert(t("settings.error"), error.message || t("settings.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }} edges={["top"]}>
      {/* Header with Back Button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "600", color: "#111827" }}>{t("settings.title")}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>

          {/* Profile Settings Card */}
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 20 }}>
              {t("settings.profileSettings")}
            </Text>

            <LanguagePicker />

            <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280", marginBottom: 8 }}>
              {t("settings.fullName")}
            </Text>
            <TextInput
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 16,
                color: "#1B1B1B",
              }}
              placeholder={t("settings.fullNamePlaceholder")}
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            {/* Email (read-only) */}
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280", marginBottom: 8 }}>
              {t("settings.email")}
            </Text>
            <View
              style={{
                backgroundColor: "#F3F4F6",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 16, color: "#6B7280" }}>{user?.email}</Text>
            </View>

            {/* Phone */}
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#6B7280", marginBottom: 8 }}>
              {t("settings.phone")}
            </Text>
            <TextInput
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 20,
                color: "#1B1B1B",
              }}
              placeholder={t("settings.phoneNumberPlaceholder")}
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* Save Button */}
            <TouchableOpacity
              style={{
                backgroundColor: "#158074",
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{t("settings.save")}</Text>
              )}
            </TouchableOpacity>
          </View>

          {invitationsEnabled ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push("/invite-neighbours")}
              style={{
                minHeight: 64,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: 18,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="people-outline" size={24} color="#158074" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>{t("settings.inviteNeighbours")}</Text>
                <Text style={{ color: "#6B7280", marginTop: 3 }}>{t("settings.inviteNeighboursDescription")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#6B7280" />
            </TouchableOpacity>
          ) : null}

          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 8 }}>{t("settings.notifications")}</Text>
            {preferencesLoading ? <ActivityIndicator color="#158074" /> : preferences ? (
              ([
                ["push_notifications", "settings.pushNotifications", "settings.pushNotificationsDescription"],
                ["weekly_digest", "settings.weeklyDigest", "settings.weeklyDigestDescription"],
                ["community_announcements", "settings.communityAnnouncements", "settings.communityAnnouncementsDescription"],
                ["business_recommendations", "settings.businessRecommendations", "settings.businessRecommendationsDescription"],
              ] as const).map(([key, labelKey, descriptionKey]) => (
                <View key={key} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F3F4F6" }}>
                  <View style={{ flex: 1, paddingVertical: 10 }}>
                    <Text style={{ color: "#111827", fontWeight: "600" }}>{t(labelKey)}</Text>
                    <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{t(descriptionKey)}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={t(labelKey)}
                    value={preferences[key]}
                    onValueChange={(value) => updatePreference(key, value)}
                  />
                </View>
              ))
            ) : <Text style={{ color: "#6B7280" }}>{t("settings.preferencesUnavailable")}</Text>}
          </View>

          <View style={{ backgroundColor: "#FFF7F7", borderRadius: 16, padding: 20, marginBottom: 28, borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#991B1B" }}>{t("settings.deleteAccount")}</Text>
            {deletionRequest ? (
              <Text style={{ color: "#991B1B", marginTop: 8 }}>{t("settings.deletionPending")}</Text>
            ) : (
              <>
                <Text style={{ color: "#7F1D1D", lineHeight: 20, marginTop: 8 }}>
                  {t("settings.deleteConfirmHint")}
                </Text>
                <TextInput
                  accessibilityLabel="Type DELETE to confirm account deletion"
                  autoCapitalize="characters"
                  value={deletionConfirmation}
                  onChangeText={setDeletionConfirmation}
                  placeholder={t("settings.deletePlaceholder")}
                  style={{ minHeight: 48, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 10, paddingHorizontal: 12, marginTop: 12 }}
                />
                <TextInput
                  accessibilityLabel="Optional account deletion reason"
                  value={deletionReason}
                  onChangeText={setDeletionReason}
                  placeholder={t("settings.deleteReasonPlaceholder")}
                  multiline
                  style={{ minHeight: 70, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 10, padding: 12, marginTop: 10, textAlignVertical: "top" }}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: deletionConfirmation !== "DELETE" || deleting }}
                  disabled={deletionConfirmation !== "DELETE" || deleting}
                  onPress={requestDeletion}
                  style={{ minHeight: 48, borderRadius: 10, backgroundColor: deletionConfirmation === "DELETE" ? "#DC2626" : "#FCA5A5", justifyContent: "center", marginTop: 12 }}
                >
                  {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "700", textAlign: "center" }}>{t("settings.requestDeletion")}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

