import { Ionicons } from "@expo/vector-icons";
import type { ListingCategory, ListingCreate, ListingIntent } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Header } from "@/components/Header";
import { SignedImage } from "@/components/signed-image";
import { AppPressable, Button, Chip, KeyboardScreen, LoadingState, TextArea, TextField } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToPresignedUrl } from "@/lib/upload";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: "ITEM", label: "Item" },
  { value: "CAR", label: "Car" },
  { value: "PROPERTY", label: "Property" },
  { value: "SERVICE", label: "Service" },
];

export default function CreateListingScreen() {
  const { category: categoryParam, id } = useLocalSearchParams<{ category?: string; id?: string }>();
  const editId = id ? Number(id) : null;
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [category, setCategory] = useState<ListingCategory>(
    categoryParam === "SERVICE" ? "SERVICE" : "ITEM",
  );
  const [intent, setIntent] = useState<ListingIntent>("SELL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loadingListing, setLoadingListing] = useState(!!editId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editId) return;
    apiClient.getListing(editId).then((listing) => {
      if (listing.owner_id !== user?.id) {
        Alert.alert("Not available", "Only the listing owner can edit this listing.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }
      setCategory(listing.category);
      setIntent(listing.intent);
      setTitle(listing.title);
      setDescription(listing.description || "");
      setPrice(listing.price == null ? "" : String(listing.price));
      setExistingImages(listing.image_urls || []);
    }).catch((error: any) => {
      Alert.alert("Unable to load listing", error.message || "Please try again.");
      router.back();
    }).finally(() => setLoadingListing(false));
  }, [apiClient, editId, router, user?.id]);

  async function pickImages() {
    const remaining = MAX_IMAGES - existingImages.length - images.length;
    if (remaining <= 0) {
      Alert.alert("Photo limit", `You can include up to ${MAX_IMAGES} photos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to add listing photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled) return;
    const valid = result.assets.filter((asset) => {
      const supported = ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(asset.mimeType || "image/jpeg");
      return supported && (!asset.fileSize || asset.fileSize <= MAX_IMAGE_BYTES);
    });
    if (valid.length !== result.assets.length) {
      Alert.alert("Some photos were skipped", "Use JPG, PNG or WebP photos up to 5 MB each.");
    }
    setImages((current) => [...current, ...valid].slice(0, remaining + current.length));
  }

  async function uploadImages() {
    const token = await SecureStore.getItemAsync("accessToken");
    return Promise.all(images.map(async (image, index) => {
      const mimeType = image.mimeType || "image/jpeg";
      const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const presign = await apiClient.getListingImagePresignedUrl({
        file_name: image.fileName || `listing-${Date.now()}-${index}.${extension}`,
        file_type: mimeType,
      });
      const response = await fetch(image.uri);
      await uploadToPresignedUrl(presign.presigned_url, await response.blob(), mimeType, token ?? undefined);
      return presign.file_url;
    }));
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Title required", "Add a clear title for your listing.");
      return;
    }
    const parsedPrice = price.trim() ? Number(price) : null;
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      Alert.alert("Check the price", "Enter a valid non-negative price.");
      return;
    }
    setSubmitting(true);
    try {
      const imageUrls = [...existingImages, ...(await uploadImages())];
      const data: ListingCreate = {
        category,
        intent,
        title: title.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        currency: "EGP",
        image_urls: imageUrls,
      };
      if (editId) {
        await apiClient.updateListing(editId, {
          title: data.title,
          description: data.description,
          price: data.price,
          image_urls: data.image_urls,
        });
      } else {
        await apiClient.createListing(data);
      }
      Alert.alert(editId ? "Listing updated" : "Listing published", "Your changes are live.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Could not save listing", error.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingListing) {
    return (
      <KeyboardScreen padded={false}>
        <Header showBackButton title="Edit listing" />
        <LoadingState label="Loading listing" />
      </KeyboardScreen>
    );
  }

  const service = category === "SERVICE";
  const photoCount = existingImages.length + images.length;

  return (
    <KeyboardScreen contentContainerStyle={styles.screen} padded={false}>
      <Header showBackButton title={editId ? "Edit listing" : service ? "New service" : "New listing"} />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          {editId ? "Update the details" : "Share something useful"}
        </Text>
        <Text style={styles.subheading}>
          Clear photos and a specific title help neighbors decide quickly.
        </Text>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((item) => (
            <Chip
              disabled={!!editId}
              key={item.value}
              label={item.label}
              onPress={() => setCategory(item.value)}
              selected={category === item.value}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{service ? "Pricing" : "Listing type"}</Text>
        <View style={styles.chips}>
          {(["SELL", "RENT"] as ListingIntent[]).map((value) => (
            <Chip
              disabled={!!editId}
              key={value}
              label={service ? (value === "SELL" ? "One-time" : "Hourly") : value === "SELL" ? "For sale" : "For rent"}
              onPress={() => setIntent(value)}
              selected={intent === value}
            />
          ))}
        </View>

        <TextField
          autoCapitalize="sentences"
          label="Title"
          maxLength={120}
          onChangeText={setTitle}
          placeholder={service ? "e.g. Air conditioner servicing" : "e.g. Solid oak dining table"}
          returnKeyType="next"
          value={title}
        />
        <TextArea
          containerStyle={styles.field}
          label="Description"
          maxLength={2000}
          onChangeText={setDescription}
          placeholder="Condition, dimensions, availability and anything else a neighbor should know"
          value={description}
        />
        <TextField
          containerStyle={styles.field}
          helperText={service && intent === "RENT" ? "Hourly price in EGP" : "Price in EGP; leave blank for price on request"}
          keyboardType="decimal-pad"
          label="Price"
          onChangeText={setPrice}
          placeholder="0"
          value={price}
        />

        <View style={styles.photoHeading}>
          <View>
            <Text style={styles.sectionLabel}>Photos</Text>
            <Text style={styles.helper}>{photoCount} of {MAX_IMAGES}</Text>
          </View>
          {photoCount < MAX_IMAGES ? (
            <Button leading={<Ionicons color={colors.primary} name="add" size={18} />} onPress={pickImages} size="small" variant="secondary">
              Add photos
            </Button>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {existingImages.map((uri, index) => (
            <Photo key={uri} onRemove={() => setExistingImages((current) => current.filter((_, i) => i !== index))}>
              <SignedImage apiClient={apiClient} fileUrl={uri} resizeMode="cover" style={styles.photo} />
            </Photo>
          ))}
          {images.map((image, index) => (
            <Photo key={`${image.uri}-${index}`} onRemove={() => setImages((current) => current.filter((_, i) => i !== index))}>
              <Image source={{ uri: image.uri }} style={styles.photo} />
            </Photo>
          ))}
          {!photoCount ? (
            <AppPressable accessibilityLabel="Add listing photos" accessibilityRole="button" onPress={pickImages} style={styles.photoEmpty}>
              <Ionicons color={colors.textMuted} name="images-outline" size={28} />
              <Text style={styles.photoEmptyText}>Add up to five photos</Text>
            </AppPressable>
          ) : null}
        </ScrollView>

        <Button loading={submitting} loadingLabel="Saving" onPress={handleSubmit} size="large" style={styles.submit}>
          {editId ? "Save changes" : service ? "Publish service" : "Publish listing"}
        </Button>
      </View>
    </KeyboardScreen>
  );
}

function Photo({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <View style={styles.photoWrap}>
      {children}
      <AppPressable accessibilityLabel="Remove photo" accessibilityRole="button" hitSlop={8} onPress={onRemove} style={styles.removePhoto}>
        <Ionicons color={palette.onPrimary} name="close" size={18} />
      </AppPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: 0 },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[10] },
  heading: { color: colors.text, fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.bold },
  subheading: { marginTop: spacing[1], marginBottom: spacing[6], color: colors.textSecondary, fontSize: typography.size.bodySmall, lineHeight: 20 },
  sectionLabel: { marginBottom: spacing[2], color: colors.text, fontSize: typography.size.bodySmall, fontWeight: typography.weight.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: spacing[5] },
  field: { marginTop: spacing[4] },
  photoHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing[6] },
  helper: { color: colors.textSecondary, fontSize: typography.size.caption },
  photos: { gap: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[2] },
  photoWrap: { position: "relative" },
  photo: { width: 112, height: 112, borderRadius: radii.large, backgroundColor: palette.surfaceMuted },
  removePhoto: {
    position: "absolute", top: 4, right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center",
    borderRadius: radii.full, backgroundColor: "rgba(28,28,26,0.78)",
  },
  photoEmpty: {
    width: 220, height: 112, alignItems: "center", justifyContent: "center", gap: spacing[2],
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.large, backgroundColor: palette.surface,
  },
  photoEmptyText: { color: colors.textSecondary, fontSize: typography.size.bodySmall },
  submit: { marginTop: spacing[6] },
});
