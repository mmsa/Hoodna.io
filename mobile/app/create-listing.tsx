import { Ionicons } from "@expo/vector-icons";
import type {
  CarAttributes,
  ItemAttributes,
  ListingAttributes,
  ListingCategory,
  ListingCreate,
  ListingIntent,
  PropertyAttributes,
} from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { Header } from "@/components/Header";
import { SignedImage } from "@/components/signed-image";
import { AppPressable, Button, Chip, EmptyState, KeyboardScreen, LoadingState, TextArea, TextField } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { uploadLocalFileToPresignedUrl } from "@/lib/upload";
import { isSupportedImageType, pickImageSource, pickImagesFromLibrary, type PickedImage } from "@/lib/pick-media";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MARKET_CATEGORIES: {
  value: Exclude<ListingCategory, "SERVICE">;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "ITEM", label: "Sell an item", description: "Furniture, electronics, home goods and more.", icon: "cube-outline" },
  { value: "CAR", label: "Sell a car", description: "Share the key vehicle details buyers need.", icon: "car-sport-outline" },
  { value: "PROPERTY", label: "List a property", description: "Offer a home for sale or rent.", icon: "home-outline" },
];
const VALID_CATEGORIES: ListingCategory[] = ["ITEM", "CAR", "PROPERTY", "SERVICE"];
const ITEM_CONDITIONS: { value: ItemAttributes["condition"]; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "USED", label: "Used" },
  { value: "FAIR", label: "Fair" },
];
const TRANSMISSIONS: CarAttributes["transmission"][] = ["AUTOMATIC", "MANUAL"];
const FUEL_TYPES: CarAttributes["fuel_type"][] = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID"];
const PROPERTY_TYPES: PropertyAttributes["property_type"][] = ["APARTMENT", "VILLA", "TOWNHOUSE", "STUDIO", "DUPLEX"];
const FURNISHING: PropertyAttributes["furnishing"][] = ["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"];

function friendlyOption(value: string) {
  return value.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

export default function CreateListingScreen() {
  const { category: categoryParam, id } = useLocalSearchParams<{ category?: string; id?: string }>();
  const editId = id ? Number(id) : null;
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const requestedCategory = VALID_CATEGORIES.includes(categoryParam as ListingCategory)
    ? categoryParam as ListingCategory
    : null;
  const [category, setCategory] = useState<ListingCategory | null>(requestedCategory);
  const [intent, setIntent] = useState<ListingIntent>("SELL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loadingListing, setLoadingListing] = useState(!!editId);
  const [providerApproved, setProviderApproved] = useState<boolean | null>(
    requestedCategory === "SERVICE" ? null : false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [itemCondition, setItemCondition] = useState<ItemAttributes["condition"] | null>(null);
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [carMileage, setCarMileage] = useState("");
  const [carTransmission, setCarTransmission] = useState<CarAttributes["transmission"] | null>(null);
  const [carFuelType, setCarFuelType] = useState<CarAttributes["fuel_type"] | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyAttributes["property_type"] | null>(null);
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [furnishing, setFurnishing] = useState<PropertyAttributes["furnishing"] | null>(null);

  useEffect(() => {
    if (editId || requestedCategory !== "SERVICE" || user?.role !== "SERVICE_PROVIDER") return;
    apiClient.getProviderProfile()
      .then((profile) => setProviderApproved(profile?.provider_status === "APPROVED"))
      .catch(() => setProviderApproved(false));
  }, [apiClient, editId, requestedCategory, user?.role]);

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
      const attributes = listing.attributes;
      if (listing.category === "ITEM" && attributes && "condition" in attributes) {
        setItemCondition(attributes.condition);
      } else if (listing.category === "CAR" && attributes && "make" in attributes) {
        setCarMake(attributes.make);
        setCarModel(attributes.model);
        setCarYear(String(attributes.year));
        setCarMileage(String(attributes.mileage_km));
        setCarTransmission(attributes.transmission);
        setCarFuelType(attributes.fuel_type);
      } else if (listing.category === "PROPERTY" && attributes && "property_type" in attributes) {
        setPropertyType(attributes.property_type);
        setBedrooms(String(attributes.bedrooms));
        setBathrooms(String(attributes.bathrooms));
        setAreaSqm(String(attributes.area_sqm));
        setFurnishing(attributes.furnishing);
      }
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

    Alert.alert("Add photos", "Choose a source", [
      {
        text: "Take photo",
        onPress: () => {
          void (async () => {
            const image = await pickImageSource({ quality: 0.8, title: "Listing photo" });
            if (!image || !isSupportedImageType(image.mimeType)) {
              if (image) Alert.alert("Unsupported photo", "Use JPG, PNG or WebP photos up to 5 MB each.");
              return;
            }
            if (image.fileSize && image.fileSize > MAX_IMAGE_BYTES) {
              Alert.alert("Photo too large", "Use photos up to 5 MB each.");
              return;
            }
            setImages((current) => [...current, image].slice(0, remaining + current.length));
          })();
        },
      },
      {
        text: "Choose from library",
        onPress: () => {
          void (async () => {
            const picked = await pickImagesFromLibrary({ quality: 0.8, selectionLimit: remaining });
            const valid = picked.filter(
              (asset) =>
                isSupportedImageType(asset.mimeType) &&
                (!asset.fileSize || asset.fileSize <= MAX_IMAGE_BYTES)
            );
            if (valid.length !== picked.length) {
              Alert.alert("Some photos were skipped", "Use JPG, PNG or WebP photos up to 5 MB each.");
            }
            setImages((current) => [...current, ...valid].slice(0, remaining + current.length));
          })();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function uploadImages() {
    const token = await SecureStore.getItemAsync("accessToken");
    return Promise.all(images.map(async (image, index) => {
      const presign = await apiClient.getListingImagePresignedUrl({
        file_name: image.fileName || `listing-${Date.now()}-${index}.jpg`,
        file_type: image.mimeType,
      });
      await uploadLocalFileToPresignedUrl(
        presign.presigned_url,
        {
          uri: image.uri,
          mimeType: image.mimeType,
          fileName: image.fileName,
        },
        token ?? undefined
      );
      return presign.file_url;
    }));
  }

  function resetCategoryDetails() {
    setIntent("SELL");
    setItemCondition(null);
    setCarMake("");
    setCarModel("");
    setCarYear("");
    setCarMileage("");
    setCarTransmission(null);
    setCarFuelType(null);
    setPropertyType(null);
    setBedrooms("");
    setBathrooms("");
    setAreaSqm("");
    setFurnishing(null);
  }

  function chooseCategory(value: Exclude<ListingCategory, "SERVICE">) {
    resetCategoryDetails();
    setCategory(value);
  }

  function changeCategory() {
    resetCategoryDetails();
    setCategory(null);
  }

  function buildAttributes(): ListingAttributes | null | undefined {
    if (category === "SERVICE") return null;
    if (category === "ITEM") {
      if (!itemCondition) {
        Alert.alert("Condition required", "Choose the condition of your item.");
        return undefined;
      }
      return { condition: itemCondition };
    }
    if (category === "CAR") {
      const year = Number(carYear);
      const mileage = Number(carMileage);
      if (!carMake.trim() || !carModel.trim() || !carYear.trim() || !carMileage.trim() || !carTransmission || !carFuelType) {
        Alert.alert("Car details required", "Complete all vehicle details before publishing.");
        return undefined;
      }
      if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) {
        Alert.alert("Check the year", `Enter a year from 1886 to ${new Date().getFullYear() + 1}.`);
        return undefined;
      }
      if (!Number.isInteger(mileage) || mileage < 0) {
        Alert.alert("Check the mileage", "Enter mileage as a non-negative whole number.");
        return undefined;
      }
      return {
        make: carMake.trim(),
        model: carModel.trim(),
        year,
        mileage_km: mileage,
        transmission: carTransmission,
        fuel_type: carFuelType,
      };
    }
    if (category === "PROPERTY") {
      const bedroomCount = Number(bedrooms);
      const bathroomCount = Number(bathrooms);
      const area = Number(areaSqm);
      if (!propertyType || !bedrooms.trim() || !bathrooms.trim() || !areaSqm.trim() || !furnishing) {
        Alert.alert("Property details required", "Complete all property details before publishing.");
        return undefined;
      }
      if (
        !Number.isInteger(bedroomCount) || bedroomCount < 0 || bedroomCount > 100 ||
        !Number.isInteger(bathroomCount) || bathroomCount < 0 || bathroomCount > 100
      ) {
        Alert.alert("Check rooms", "Bedrooms and bathrooms must be whole numbers from 0 to 100.");
        return undefined;
      }
      if (!Number.isFinite(area) || area <= 0) {
        Alert.alert("Check the area", "Enter a property area greater than zero.");
        return undefined;
      }
      return {
        property_type: propertyType,
        bedrooms: bedroomCount,
        bathrooms: bathroomCount,
        area_sqm: area,
        furnishing,
      };
    }
    return undefined;
  }

  async function handleSubmit() {
    if (!category) return;
    if (!title.trim()) {
      Alert.alert("Title required", "Add a clear title for your listing.");
      return;
    }
    const parsedPrice = intent === "FREE" ? null : price.trim() ? Number(price) : null;
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      Alert.alert("Check the price", "Enter a valid non-negative price.");
      return;
    }
    const attributes = buildAttributes();
    if (attributes === undefined) return;
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
        attributes,
        image_urls: imageUrls,
      };
      if (editId) {
        await apiClient.updateListing(editId, {
          title: data.title,
          description: data.description,
          price: data.price,
          attributes: data.attributes,
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

  if (!editId && requestedCategory === "SERVICE" && user?.role === "SERVICE_PROVIDER" && providerApproved === null) {
    return (
      <KeyboardScreen padded={false}>
        <Header showBackButton title="New service" />
        <LoadingState label="Checking provider access" />
      </KeyboardScreen>
    );
  }

  const serviceAccessDenied = !editId && requestedCategory === "SERVICE" && (
    user?.role !== "SERVICE_PROVIDER" || !user?.can_create_listing || providerApproved !== true
  );
  const marketAccessDenied = !editId && requestedCategory !== "SERVICE" && (
    user?.role === "SERVICE_PROVIDER" || !user?.can_create_listing
  );
  if (serviceAccessDenied || marketAccessDenied) {
    return (
      <KeyboardScreen padded={false}>
        <Header showBackButton title={requestedCategory === "SERVICE" ? "New service" : "New listing"} />
        <EmptyState
          actionLabel="Go back"
          description={
            requestedCategory === "SERVICE"
              ? "Only approved service providers can publish services."
              : "Marketplace posting is available to residents with listing permission."
          }
          icon={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={36} />}
          onAction={() => router.back()}
          title="You can’t create this listing"
        />
      </KeyboardScreen>
    );
  }

  if (!editId && !category) {
    return (
      <KeyboardScreen contentContainerStyle={styles.screen} padded={false}>
        <Header showBackButton title="New listing" />
        <View style={styles.pickerContent}>
          <Text accessibilityRole="header" style={styles.heading}>What are you listing?</Text>
          <Text style={styles.subheading}>Choose a category to see the right details for your listing.</Text>
          <View style={styles.categoryTiles}>
            {MARKET_CATEGORIES.map((item) => (
              <AppPressable
                accessibilityHint={item.description}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                key={item.value}
                onPress={() => chooseCategory(item.value)}
                pressedStyle={styles.tilePressed}
                style={styles.categoryTile}
              >
                <View style={styles.tileIcon}>
                  <Ionicons color={colors.primary} name={item.icon} size={26} />
                </View>
                <View style={styles.tileCopy}>
                  <Text style={styles.tileTitle}>{item.label}</Text>
                  <Text style={styles.tileDescription}>{item.description}</Text>
                </View>
                <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
              </AppPressable>
            ))}
          </View>
        </View>
      </KeyboardScreen>
    );
  }

  if (!category) return null;
  const service = category === "SERVICE";
  const property = category === "PROPERTY";
  const photoCount = existingImages.length + images.length;
  const headings: Record<ListingCategory, { title: string; subtitle: string; placeholder: string; description: string; price: string }> = {
    ITEM: {
      title: "Describe your item",
      subtitle: "Add its condition and the details a neighbor needs to decide.",
      placeholder: "e.g. Solid oak dining table",
      description: "Condition, dimensions, age and anything else a buyer should know",
      price: "Sale price in EGP; leave blank for price on request",
    },
    CAR: {
      title: "Describe your car",
      subtitle: "Accurate vehicle details help buyers find the right match.",
      placeholder: "e.g. 2021 Toyota Corolla",
      description: "Service history, features and anything else a buyer should know",
      price: "Sale price in EGP; leave blank for price on request",
    },
    PROPERTY: {
      title: "Describe your property",
      subtitle: "Share the space, furnishing and whether it is for sale or rent.",
      placeholder: "e.g. Bright 2-bedroom apartment",
      description: "Location within the compound, amenities, availability and other details",
      price: intent === "RENT" ? "Rent in EGP; mention the rental period in the description" : "Sale price in EGP; leave blank for price on request",
    },
    SERVICE: {
      title: "Describe your service",
      subtitle: "Clear scope and pricing help residents know what to expect.",
      placeholder: "e.g. Air conditioner servicing",
      description: "What is included, availability and anything residents should know",
      price: intent === "RENT" ? "Hourly price in EGP" : "One-time price in EGP; leave blank for a quote",
    },
  };
  const copy = headings[category];

  return (
    <KeyboardScreen contentContainerStyle={styles.screen} padded={false}>
      <Header showBackButton title={editId ? "Edit listing" : service ? "New service" : "New listing"} />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          {editId ? `Update your ${friendlyOption(category).toLowerCase()}` : copy.title}
        </Text>
        <Text style={styles.subheading}>{copy.subtitle}</Text>

        {!editId && !service ? (
          <Button leading={<Ionicons color={colors.primary} name="arrow-back" size={18} />} onPress={changeCategory} size="small" style={styles.changeCategory} variant="ghost">
            Change category
          </Button>
        ) : null}

        {(property || service || category === "ITEM" || category === "CAR") ? (
          <>
            <Text style={styles.sectionLabel}>{service ? "Pricing" : "Listing type"}</Text>
            <View style={styles.chips}>
              {(service
                ? (["SELL", "RENT"] as ListingIntent[])
                : property
                  ? (["SELL", "RENT", "FREE"] as ListingIntent[])
                  : (["SELL", "FREE"] as ListingIntent[])
              ).map((value) => (
                <Chip
                  disabled={!!editId}
                  key={value}
                  label={service ? (value === "SELL" ? "One-time" : "Hourly") : value === "SELL" ? "For sale" : value === "RENT" ? "For rent" : "Free"}
                  onPress={() => setIntent(value)}
                  selected={intent === value}
                />
              ))}
            </View>
          </>
        ) : null}

        {category === "ITEM" ? (
          <>
            <Text style={styles.sectionLabel}>Condition</Text>
            <View style={styles.chips}>
              {ITEM_CONDITIONS.map((option) => (
                <Chip key={option.value} label={option.label} onPress={() => setItemCondition(option.value)} selected={itemCondition === option.value} />
              ))}
            </View>
          </>
        ) : null}

        {category === "CAR" ? (
          <View style={styles.attributeSection}>
            <View style={styles.fieldRow}>
              <TextField containerStyle={styles.halfField} label="Make" onChangeText={setCarMake} placeholder="Toyota" value={carMake} />
              <TextField containerStyle={styles.halfField} label="Model" onChangeText={setCarModel} placeholder="Corolla" value={carModel} />
            </View>
            <View style={styles.fieldRow}>
              <TextField containerStyle={styles.halfField} keyboardType="number-pad" label="Year" onChangeText={setCarYear} placeholder="2021" value={carYear} />
              <TextField containerStyle={styles.halfField} keyboardType="number-pad" label="Mileage (km)" onChangeText={setCarMileage} placeholder="45000" value={carMileage} />
            </View>
            <Text style={styles.sectionLabel}>Transmission</Text>
            <View style={styles.chips}>
              {TRANSMISSIONS.map((value) => <Chip key={value} label={friendlyOption(value)} onPress={() => setCarTransmission(value)} selected={carTransmission === value} />)}
            </View>
            <Text style={styles.sectionLabel}>Fuel type</Text>
            <View style={styles.chips}>
              {FUEL_TYPES.map((value) => <Chip key={value} label={friendlyOption(value)} onPress={() => setCarFuelType(value)} selected={carFuelType === value} />)}
            </View>
          </View>
        ) : null}

        {category === "PROPERTY" ? (
          <View style={styles.attributeSection}>
            <Text style={styles.sectionLabel}>Property type</Text>
            <View style={styles.chips}>
              {PROPERTY_TYPES.map((value) => <Chip key={value} label={friendlyOption(value)} onPress={() => setPropertyType(value)} selected={propertyType === value} />)}
            </View>
            <View style={styles.fieldRow}>
              <TextField containerStyle={styles.halfField} keyboardType="number-pad" label="Bedrooms" onChangeText={setBedrooms} placeholder="2" value={bedrooms} />
              <TextField containerStyle={styles.halfField} keyboardType="number-pad" label="Bathrooms" onChangeText={setBathrooms} placeholder="2" value={bathrooms} />
            </View>
            <TextField containerStyle={styles.attributeField} keyboardType="decimal-pad" label="Area (m²)" onChangeText={setAreaSqm} placeholder="120" value={areaSqm} />
            <Text style={styles.sectionLabel}>Furnishing</Text>
            <View style={styles.chips}>
              {FURNISHING.map((value) => <Chip key={value} label={friendlyOption(value)} onPress={() => setFurnishing(value)} selected={furnishing === value} />)}
            </View>
          </View>
        ) : null}

        {intent !== "FREE" ? <TextField
          autoCapitalize="sentences"
          label="Title"
          maxLength={120}
          onChangeText={setTitle}
          placeholder={copy.placeholder}
          returnKeyType="next"
          value={title}
        /> : (
          <View style={styles.saleOnly}>
            <Ionicons color={colors.primary} name="gift-outline" size={18} />
            <Text style={styles.saleOnlyText}>Free — no price needed</Text>
          </View>
        )}
        <TextArea
          containerStyle={styles.field}
          label="Description"
          maxLength={2000}
          onChangeText={setDescription}
          placeholder={copy.description}
          value={description}
        />
        <TextField
          containerStyle={styles.field}
          helperText={copy.price}
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
  pickerContent: { flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[6], paddingBottom: spacing[10] },
  heading: { color: colors.text, fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.bold },
  subheading: { marginTop: spacing[1], marginBottom: spacing[6], color: colors.textSecondary, fontSize: typography.size.bodySmall, lineHeight: 20 },
  categoryTiles: { gap: spacing[3] },
  categoryTile: {
    minHeight: 108, flexDirection: "row", alignItems: "center", gap: spacing[3],
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.large,
    backgroundColor: palette.surface, padding: spacing[4],
  },
  tilePressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  tileIcon: {
    width: 52, height: 52, alignItems: "center", justifyContent: "center",
    borderRadius: radii.medium, backgroundColor: palette.primarySoft,
  },
  tileCopy: { flex: 1 },
  tileTitle: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.semibold },
  tileDescription: { marginTop: spacing[1], color: colors.textSecondary, fontSize: typography.size.bodySmall, lineHeight: 19 },
  changeCategory: { alignSelf: "flex-start", marginTop: -spacing[3], marginBottom: spacing[4] },
  sectionLabel: { marginBottom: spacing[2], color: colors.text, fontSize: typography.size.bodySmall, fontWeight: typography.weight.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginBottom: spacing[5] },
  saleOnly: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing[2],
    marginBottom: spacing[5], borderRadius: radii.full, backgroundColor: palette.primarySoft,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  saleOnlyText: { color: colors.primaryDark, fontSize: typography.size.bodySmall, fontWeight: typography.weight.semibold },
  attributeSection: { marginBottom: spacing[1] },
  fieldRow: { flexDirection: "row", gap: spacing[3], marginBottom: spacing[4] },
  halfField: { flex: 1 },
  attributeField: { marginBottom: spacing[4] },
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
