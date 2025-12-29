import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { VerificationStatusResponse } from "../../../packages/shared/src/index";

export default function ProfileScreen() {
  const { user, apiClient, logout } = useAuth();
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatusResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadVerificationStatus();
    }
  }, [user]);

  async function loadVerificationStatus() {
    try {
      const status = await apiClient.getVerificationStatus();
      setVerificationStatus(status);
    } catch (error) {
      console.error("Failed to load verification status:", error);
    }
  }

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/phone-login");
        },
      },
    ]);
  }

  const verificationStatusText =
    user?.verification_status || verificationStatus?.user_status || "UNVERIFIED";

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-text-main mb-6">Profile</Text>

        {/* User Info */}
        <View className="bg-white rounded-card p-4 mb-4 border border-gray-200">
          <Text className="text-lg font-semibold text-text-main">{user?.name}</Text>
          <Text className="text-sm text-text-muted mt-1">{user?.email}</Text>
          {user?.phone && (
            <Text className="text-sm text-text-muted">{user.phone}</Text>
          )}
        </View>

        {/* Verification Status */}
        <View className="bg-white rounded-card p-4 mb-4 border border-gray-200">
          <Text className="text-lg font-semibold text-text-main mb-3">
            Verification Status
          </Text>
          <View
            className={`px-3 py-2 rounded-button mb-3 ${
              verificationStatusText === "APPROVED"
                ? "bg-success/20"
                : verificationStatusText === "PENDING"
                ? "bg-accent/20"
                : "bg-error/20"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                verificationStatusText === "APPROVED"
                  ? "text-success"
                  : verificationStatusText === "PENDING"
                  ? "text-text-main"
                  : "text-error"
              }`}
            >
              {verificationStatusText === "APPROVED"
                ? "✓ Verified"
                : verificationStatusText === "PENDING"
                ? "⏳ Pending Review"
                : "✗ Not Verified"}
            </Text>
          </View>

          {verificationStatusText !== "APPROVED" && (
            <TouchableOpacity
              className="bg-primary rounded-button py-3 items-center mt-2"
              onPress={() => router.push("/verification")}
            >
              <Text className="text-white font-semibold">
                {verificationStatusText === "PENDING"
                  ? "View Status"
                  : "Start Verification"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          className="bg-white rounded-card p-4 mb-4 border border-gray-200"
          onPress={() => router.push("/settings")}
        >
          <Text className="text-base text-text-main">Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-error rounded-button py-3 items-center"
          onPress={handleLogout}
        >
          <Text className="text-white font-semibold">Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

