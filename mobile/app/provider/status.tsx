import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { formatProviderStatus, formatProviderType, formatVerificationMethod } from "@/utils/format-enums";

interface ProviderProfile {
  id: number;
  user_id: number;
  provider_type: string | null;
  verification_method: string | null;
  business_name: string | null;
  category_id: number | null;
  category?: {
    id: number;
    name: string;
    icon?: string;
  };
  phone: string | null;
  provider_status: string;
  submitted_at: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  documents: Array<{
    id: number;
    document_type: string;
    file_url: string;
  }>;
}

export default function ProviderStatusScreen() {
  const router = useRouter();
  const { user, loading: authLoading, apiClient } = useAuth();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
      return;
    }

    if (user && user.role !== "SERVICE_PROVIDER") {
      router.replace("/onboarding/choose-role");
      return;
    }

    if (user) {
      fetchProfile();
    }
  }, [user, authLoading]);

  // Redirect approved providers to services page
  useEffect(() => {
    const status = profile?.provider_status?.toString().trim().toUpperCase();
    
    if (profile && status === "APPROVED") {
      router.replace("/(tabs)/services");
    }
  }, [profile, router]);

  // Prevent bypassing status page if not approved
  useEffect(() => {
    if (profile && profile.provider_status !== "APPROVED" && profile.provider_status !== "DRAFT") {
      // If user tries to navigate away, redirect back to status page
      // This is handled by the router guards in index.tsx
    }
  }, [profile]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const response = await apiClient.getProviderProfile();
      setProfile(response);
    } catch (error: any) {
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading status...</Text>
      </SafeAreaView>
    );
  }

  const statusColor = 
    profile?.provider_status === "APPROVED" ? "#10B981" :
    profile?.provider_status === "REJECTED" ? "#EF4444" :
    profile?.provider_status === "SUSPENDED" ? "#F59E0B" :
    "#3B82F6";

  const statusBgColor = 
    profile?.provider_status === "APPROVED" ? "#D1FAE5" :
    profile?.provider_status === "REJECTED" ? "#FEE2E2" :
    profile?.provider_status === "SUSPENDED" ? "#FEF3C7" :
    "#DBEAFE";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFF6FF" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#DBEAFE",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="construct" size={40} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.text, marginBottom: 8 }}>
            Service Provider Status
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
                    {formatProviderStatus(profile.provider_status)}
                  </Text>
                </View>
              </View>

              {profile.business_name && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Business Name:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {profile.business_name}
                  </Text>
                </View>
              )}

              {profile.category && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Service Category:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {profile.category.icon} {profile.category.name}
                  </Text>
                </View>
              )}

              {profile.provider_type && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Provider Type:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {formatProviderType(profile.provider_type)}
                  </Text>
                </View>
              )}

              {profile.verification_method && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Verification Method:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {formatVerificationMethod(profile.verification_method)}
                  </Text>
                </View>
              )}

              {profile.phone && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                    Phone:
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    {profile.phone}
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

              {(profile.rejection_reason || (profile.provider_status === "IN_REVIEW" && profile.rejection_reason?.includes("More details requested"))) && (
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
                        backgroundColor: colors.primary,
                        borderRadius: 8,
                        padding: 10,
                        marginTop: 8,
                        alignItems: "center",
                      }}
                      onPress={() => router.push("/onboarding/provider")}
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

              {profile.provider_status === "SUBMITTED" || profile.provider_status === "IN_REVIEW" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  {profile.rejection_reason?.includes("More details requested")
                    ? "Please provide the requested additional details to continue the review process."
                    : "Your provider profile is being reviewed by our team. You'll be notified once it's approved."}
                </Text>
              ) : profile.provider_status === "APPROVED" ? (
                <>
                  <Text style={{ fontSize: 14, color: "#10B981", marginTop: 12, fontWeight: "600" }}>
                    ✓ Your provider profile has been approved! You can now provide services.
                  </Text>
                </>
              ) : profile.provider_status === "REJECTED" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  Your provider profile was rejected. Please review the rejection reason above and resubmit.
                </Text>
              ) : profile.provider_status === "SUSPENDED" ? (
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  Your provider profile has been suspended. Please contact support for more information.
                </Text>
              ) : null}
            </View>

            {(profile.provider_status === "DRAFT" || profile.provider_status === "REJECTED" || (profile.provider_status === "IN_REVIEW" && profile.rejection_reason?.includes("More details requested"))) && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  marginTop: 16,
                }}
                onPress={() => router.push("/onboarding/provider")}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                  {profile.provider_status === "REJECTED" ? "Update Profile" : profile.rejection_reason?.includes("More details requested") ? "Provide More Details" : "Complete Profile"}
                </Text>
              </TouchableOpacity>
            )}
            {profile.provider_status === "APPROVED" && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#fff",
                    borderWidth: 2,
                    borderColor: colors.primary,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                  }}
                  onPress={() => router.push("/onboarding/provider")}
                >
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                  }}
                  onPress={() => router.push("/(tabs)/services")}
                >
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                    My Services
                  </Text>
                </TouchableOpacity>
              </View>
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
              You haven't created a provider profile yet. Complete the onboarding process to get started.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
              onPress={() => router.push("/onboarding/provider")}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
