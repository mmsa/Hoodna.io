import { useState } from "react";
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import type { ReportEntityType, ReportReason } from "@hoodna/shared";
import { useTelemetry } from "@/contexts/TelemetryContext";

const REPORT_REASONS = [
  { value: "spam", label: "Spam", icon: "🚫" },
  { value: "inappropriate_content", label: "Inappropriate Content", icon: "⚠️" },
  { value: "false_information", label: "False or Misleading", icon: "💳" },
  { value: "harassment", label: "Harassment", icon: "😡" },
  { value: "other", label: "Other", icon: "📝" },
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedType: ReportEntityType | "listing";
  reportedId: number;
  reportedTitle?: string;
}

export function ReportModal({ visible, onClose, reportedType, reportedId, reportedTitle }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { apiClient } = useAuth();
  const { track } = useTelemetry();

  async function handleSubmit() {
    if (!selectedReason) {
      Alert.alert("Required", "Please select a reason for reporting");
      return;
    }

    setSubmitting(true);
    try {
      if (reportedType === "listing") {
        await apiClient.reportListing(reportedId, {
          reason: selectedReason,
          description: description.trim() || undefined,
        });
      } else {
        await apiClient.createReport(reportedType, reportedId, {
          reason: selectedReason as ReportReason,
          description: description.trim() || undefined,
        });
      }
      track("report_submitted", { entity_type: reportedType, reason: selectedReason });

      Alert.alert(
        "Report Submitted",
        "Thank you for your report. Our moderators will review it shortly.",
        [{ text: "OK", onPress: onClose }]
      );
      setSelectedReason("");
      setDescription("");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setSelectedReason("");
    setDescription("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.backgroundCard,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "90%",
            paddingBottom: 32,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain }}>
              Report {reportedType === "post" ? "Post" : reportedType === "comment" ? "Comment" : reportedType === "business" ? "Business" : reportedType === "user" ? "Profile" : "Listing"}
            </Text>
            <TouchableOpacity accessibilityLabel="Close report form" accessibilityRole="button" onPress={handleClose} activeOpacity={0.7} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {reportedTitle && (
              <View
                style={{
                  backgroundColor: colors.gray50,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  Reporting:
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textMain }}>
                  {reportedTitle}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textMain, marginBottom: 12 }}>
              Why are you reporting this?
            </Text>

            <View style={{ gap: 8, marginBottom: 24 }}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedReason === reason.value ? colors.primary : colors.border,
                    backgroundColor: selectedReason === reason.value ? colors.primary + "10" : colors.backgroundCard,
                  }}
                  onPress={() => setSelectedReason(reason.value)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{reason.icon}</Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: selectedReason === reason.value ? "600" : "500",
                      color: colors.textMain,
                      flex: 1,
                    }}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.value && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textMain, marginBottom: 12 }}>
              Additional Details (Optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.gray50,
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                color: colors.textMain,
                minHeight: 100,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              placeholder="Provide any additional information that might help..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.gray200,
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textMain }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.error,
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={handleSubmit}
                disabled={submitting || !selectedReason}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

