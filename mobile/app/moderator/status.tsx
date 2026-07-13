import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { formatModeratorStatus } from "@/utils/format-enums";
import { formatCompoundName } from "@/utils/formatCompound";

interface ModeratorProfile {
  id: number;
  user_id: number;
  compound_id: number;
  compound_name: string | null;
  role_title: string | null;
  moderator_status: string;
  submitted_at: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  documents: Array<{
    id: number;
    document_type: string;
    file_url: string;
  }>;
}

export default function ModeratorStatusScreen() {
  const router = useRouter();
  const { user, loading: authLoading, apiClient } = useAuth();
  const [profile, setProfile] = useState<ModeratorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
      return;
    }

    if (user && user.role !== "COMPOUND_MOD") {
      router.replace("/onboarding/choose-role");
      return;
    }

    if (user) {
      fetchProfile();
    }
  }, [user, authLoading]);

  // Redirect approved moderators to feed
  useEffect(() => {
    if (profile && profile.moderator_status === "APPROVED") {
      router.replace("/(tabs)/home");
    }
  }, [profile, router]);

  // Prevent bypassing status page if not approved
  useEffect(() => {
    if (profile && profile.moderator_status !== "APPROVED" && profile.moderator_status !== "DRAFT") {
      // If user tries to navigate away, redirect back to status page
      // This is handled by the router guards in index.tsx
    }
  }, [profile]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const response = await apiClient.getModeratorProfile();
      setProfile(response);
    } catch (error: any) {
      console.error("Failed to fetch moderator profile:", error);
      // If profile doesn't exist, that's okay - user needs to complete onboarding
      if (error?.status !== 404) {
        Alert.alert("Error", "Failed to load profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading status...</Text>
      </SafeAreaView>
    );
  }

  const statusColor = 
    profile?.moderator_status === "APPROVED" ? "#10B981" :
    profile?.moderator_status === "REJECTED" ? "#EF4444" :
    profile?.moderator_status === "SUSPENDED" ? "#F59E0B" :
    "#158074";

  const statusBgColor = 
    profile?.moderator_status === "APPROVED" ? "#D1FAE5" :
    profile?.moderator_status === "REJECTED" ? "#FEE2E2" :
    profile?.moderator_status === "SUSPENDED" ? "#FEF3C7" :
    "#E6F3F1";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F8F1" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#E6F3F1",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="shield-checkmark" size={40} color="#158074" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
            Moderator Status
          </Text>
          <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: "center" }}>
            Your verification status
          </Text>
        </View>

        {profile ? (
          <>
            {/* Status Card */}
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 16 }}>
                Profile Information
              </Text>
              
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                  Status:
                </Text>
                <View
                  style={{
                    backgroundColor: statusBgColor,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: statusColor }}>
                    {formatModeratorStatus(profile.moderator_status)}
                  </Text>
                </View>
              </View>

              {profile.role_title && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Role Title:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {profile.role_title}
                  </Text>
                </View>
              )}

              {profile.compound_name && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Compound:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {formatCompoundName(profile.compound_name)}
                  </Text>
                </View>
              )}

              {profile.submitted_at && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Submitted:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {new Date(profile.submitted_at).toLocaleString()}
                  </Text>
                </View>
              )}

              {(profile.rejection_reason || (profile.moderator_status === "IN_REVIEW" && profile.rejection_reason?.includes("More details requested"))) && (
                <View
                  style={{
                    backgroundColor: profile.rejection_reason?.includes("More details requested") ? "#FEF3C7" : "#FEE2E2",
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: profile.rejection_reason?.includes("More details requested") ? "#92400E" : "#991B1B", marginBottom: 4 }}>
                    {profile.rejection_reason?.includes("More details requested") ? "More Details Requested:" : "Rejection Reason:"}
                  </Text>
                  <Text style={{ fontSize: 14, color: profile.rejection_reason?.includes("More details requested") ? "#B45309" : "#B91C1C" }}>
                    {profile.rejection_reason?.replace("More details requested: ", "") || profile.rejection_reason}
                  </Text>
                  {profile.rejection_reason?.includes("More details requested") && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#158074",
                        borderRadius: 8,
                        padding: 10,
                        marginTop: 8,
                        alignItems: "center",
                      }}
                      onPress={() => router.push("/onboarding/moderator")}
                    >
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                        Provide More Details
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {profile.suspension_reason && (
                <View
                  style={{
                    backgroundColor: "#FEF3C7",
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 12,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#92400E", marginBottom: 4 }}>
                    Suspension Reason:
                  </Text>
                  <Text style={{ fontSize: 14, color: "#B45309" }}>
                    {profile.suspension_reason}
                  </Text>
                </View>
              )}

              {profile.moderator_status === "SUBMITTED" || profile.moderator_status === "IN_REVIEW" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  {profile.rejection_reason?.includes("More details requested")
                    ? "Please provide the requested additional details to continue the review process."
                    : "Your moderator profile is being reviewed by our team. You'll be notified once it's approved."}
                </Text>
              ) : profile.moderator_status === "APPROVED" ? (
                <>
                  <Text style={{ fontSize: 14, color: "#10B981", marginTop: 12, fontWeight: "600" }}>
                    ✓ Your moderator profile has been approved! You can now moderate {profile.compound_name ? formatCompoundName(profile.compound_name) : "your compound"}.
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#158074",
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                      marginTop: 16,
                    }}
                    onPress={() => router.replace("/(tabs)/home")}
                  >
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                      Go to Feed
                    </Text>
                  </TouchableOpacity>
                </>
              ) : profile.moderator_status === "REJECTED" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  Your moderator profile was rejected. Please review the rejection reason above and resubmit.
                </Text>
              ) : profile.moderator_status === "SUSPENDED" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  Your moderator profile has been suspended. Please contact support for more information.
                </Text>
              ) : null}
            </View>

            {(profile.moderator_status === "DRAFT" || profile.moderator_status === "REJECTED" || (profile.moderator_status === "IN_REVIEW" && profile.rejection_reason?.includes("More details requested"))) && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#158074",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  marginTop: 16,
                }}
                onPress={() => router.push("/onboarding/moderator")}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                  {profile.moderator_status === "REJECTED" ? "Update Profile" : profile.rejection_reason?.includes("More details requested") ? "Provide More Details" : "Complete Profile"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 16 }}>
              No Profile Found
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
              You haven't created a moderator profile yet. Complete the onboarding process to get started.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: "#158074",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={() => router.push("/onboarding/moderator")}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
