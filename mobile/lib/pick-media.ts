import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type PickedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize?: number;
};

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function normalizeAsset(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const mimeType = (asset.mimeType || "image/jpeg").toLowerCase();
  const extension =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return {
    uri: asset.uri,
    mimeType,
    fileName: asset.fileName || `photo-${Date.now()}.${extension}`,
    fileSize: asset.fileSize,
  };
}

async function launchCamera(options: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Camera access needed", "Allow camera access to take a photo.");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: options.quality ?? 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;
  return normalizeAsset(result.assets[0]);
}

async function launchLibrary(options: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  allowsMultipleSelection?: boolean;
  selectionLimit?: number;
}): Promise<PickedImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Photo access needed", "Allow photo access to choose a photo.");
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: options.quality ?? 0.8,
    allowsMultipleSelection: options.allowsMultipleSelection ?? false,
    selectionLimit: options.selectionLimit,
  });

  if (result.canceled) return [];
  return result.assets.map(normalizeAsset);
}

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

export function pickImageSource(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  title?: string;
}): Promise<PickedImage | null> {
  const title = options?.title ?? "Add photo";

  return new Promise((resolve) => {
    Alert.alert(title, "Choose a source", [
      {
        text: "Take photo",
        onPress: () => {
          void launchCamera({
            allowsEditing: options?.allowsEditing,
            aspect: options?.aspect,
            quality: options?.quality,
          }).then(resolve);
        },
      },
      {
        text: "Choose from library",
        onPress: () => {
          void launchLibrary({ ...options, allowsMultipleSelection: false }).then((images) =>
            resolve(images[0] ?? null)
          );
        },
      },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

export async function pickImagesFromLibrary(options?: {
  quality?: number;
  selectionLimit?: number;
}): Promise<PickedImage[]> {
  return launchLibrary({
    quality: options?.quality ?? 0.8,
    allowsMultipleSelection: true,
    selectionLimit: options?.selectionLimit,
  });
}
