import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentType } from "@hoodna/shared";

export default function VerificationScreen() {
  const { apiClient } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);

  async function pickDocument(type: DocumentType) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadDocument(type, file.uri, file.mimeType || "image/jpeg");
    } catch (error) {
      Alert.alert("Error", "Failed to pick document");
    }
  }

  async function pickImage(type: DocumentType) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      await uploadDocument(type, asset.uri, asset.mimeType || "image/jpeg");
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  }

  async function uploadDocument(
    type: DocumentType,
    fileUri: string,
    mimeType: string
  ) {
    setUploading(type);
    try {
      // Get file name from URI
      const fileName = fileUri.split("/").pop() || `document.${mimeType.split("/")[1]}`;

      // Get presigned URL
      const presignResponse = await apiClient.getPresignedUrl({
        file_name: fileName,
        file_type: mimeType,
        document_type: type,
      });

      // Read file
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Upload to S3
      await fetch(presignResponse.presigned_url, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": mimeType,
        },
      });

      // Submit document
      await apiClient.submitDocument({
        file_url: presignResponse.file_url,
        document_type: type,
      });

      Alert.alert("Success", "Document uploaded successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upload document");
    } finally {
      setUploading(null);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-text-main mb-2">
          Verification
        </Text>
        <Text className="text-base text-text-muted mb-6">
          Upload your documents to verify your identity
        </Text>

        {/* National ID */}
        <View className="bg-white rounded-card p-4 mb-4 border border-gray-200">
          <Text className="text-lg font-semibold text-text-main mb-2">
            National ID
          </Text>
          <Text className="text-sm text-text-muted mb-4">
            Upload a clear photo of your national ID
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-button py-3 items-center"
            onPress={() => pickImage("NATIONAL_ID")}
            disabled={uploading === "NATIONAL_ID"}
          >
            <Text className="text-white font-semibold">
              {uploading === "NATIONAL_ID" ? "Uploading..." : "Upload National ID"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contract */}
        <View className="bg-white rounded-card p-4 mb-4 border border-gray-200">
          <Text className="text-lg font-semibold text-text-main mb-2">
            Residency / Ownership Contract
          </Text>
          <Text className="text-sm text-text-muted mb-4">
            Upload your residency or ownership contract
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-button py-3 items-center"
            onPress={() => pickDocument("CONTRACT")}
            disabled={uploading === "CONTRACT"}
          >
            <Text className="text-white font-semibold">
              {uploading === "CONTRACT" ? "Uploading..." : "Upload Contract"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

