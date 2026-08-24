import { Ionicons } from "@expo/vector-icons";
import type { Listing } from "@hoodna/shared";
import { buildEljiranUrl } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Header } from "@/components/Header";
import { ReportModal } from "@/components/ReportModal";
import { SignedImage } from "@/components/signed-image";
import { AppPressable, Button, LoadingState, Screen } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { shareViaWhatsApp } from "@/lib/share";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = Number(id);
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  async function loadListing() {
    try {
      setListing(await apiClient.getListing(listingId));
    } catch (error: any) {
      if (!listing) {
        Alert.alert("Listing unavailable", error.message || "This listing may no longer be active.", [
          { text: "Back", onPress: () => router.back() },
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadListing();
  }, [listingId]);

  async function handleSave() {
    if (!listing) return;
    setSaving(true);
    try {
      if (listing.is_saved) await apiClient.unsaveListing(listing.id);
      else await apiClient.saveListing(listing.id);
      setListing({ ...listing, is_saved: !listing.is_saved });
    } catch (error: any) {
      Alert.alert("Could not update saved listing", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMessage() {
    if (!listing) return;
    if (user?.status !== "APPROVED") {
      Alert.alert("Verification required", "Complete verification before messaging a seller.");
      return;
    }
    try {
      await apiClient.sendMessage({
        recipient_id: listing.owner_id,
        content: `Hi! I'm interested in your listing: ${listing.title}`,
        listing_id: listing.id,
      });
      const conversations = await apiClient.getConversations();
      const conversation = conversations.find(
        (item: any) => item.other_user_id === listing.owner_id && item.listing_id === listing.id,
      );
      router.push(conversation ? `/messages/${conversation.id}` : "/(tabs)/messages");
    } catch (error: any) {
      Alert.alert("Could not start conversation", error.message || "Please try again.");
    }
  }

  function confirmDelete(owner: boolean) {
    if (!listing) return;
    Alert.alert("Delete listing?", "This removes the listing from marketplace results.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (owner) await apiClient.deleteOwnListing(listing.id);
            else await apiClient.deleteListing(listing.id);
            router.back();
          } catch (error: any) {
            Alert.alert("Could not delete listing", error.message || "Please try again.");
          }
        },
      },
    ]);
  }

  async function handleWhatsAppShare() {
    if (!listing) return;
    const url = buildEljiranUrl({ type: "listing", id: listing.id });
    try {
      await shareViaWhatsApp({ title: listing.title, url });
    } catch {
      Alert.alert("Could not open WhatsApp", "Install WhatsApp or try again.");
    }
  }

  if (loading || !listing) {
    return (
      <Screen padded={false}>
        <Header showBackButton title="Listing" />
        <LoadingState label="Loading listing" />
      </Screen>
    );
  }

  const images = listing.image_urls || [];
  const isOwner = listing.owner_id === user?.id;
  const isModerator = user?.role === "MODERATOR" || user?.role === "ADMIN";
  const service = listing.category === "SERVICE";
  const intentLabel = service
    ? listing.intent === "RENT" ? "Hourly" : "One-time"
    : listing.category === "PROPERTY" && listing.intent === "RENT" ? "For rent" : "For sale";
  const attributeRows = getAttributeRows(listing);

  function updateImageIndex(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  return (
    <Screen padded={false}>
      <Header
        rightAction={{ label: "Share", icon: "share-outline", onPress: () => Share.share({
          title: listing.title,
          message: `${listing.title}\n${listing.description || ""}\n${formatPrice(listing)}`,
        }) }}
        showBackButton
        title={service ? "Service" : "Listing"}
      />
      <ScrollView
        refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); loadListing(); }} refreshing={refreshing} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {images.length ? (
          <View>
            <ScrollView
              accessibilityLabel="Listing photos"
              horizontal
              onMomentumScrollEnd={updateImageIndex}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {images.map((image, index) => (
                <SignedImage
                  apiClient={apiClient}
                  fileUrl={image}
                  key={`${image}-${index}`}
                  resizeMode="cover"
                  style={styles.hero}
                />
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={styles.imageCount}>
                <Text style={styles.imageCountText}>{imageIndex + 1} / {images.length}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.hero, styles.placeholder]}>
            <Ionicons color={colors.gray400} name={service ? "construct-outline" : "image-outline"} size={42} />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.meta}>
            <Text style={styles.eyebrow}>{friendlyCategory(listing.category)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.intent}>{intentLabel}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{listing.title}</Text>
          <Text style={styles.price}>{formatPrice(listing)}</Text>

          <View style={styles.actions}>
            {!isOwner ? (
              <>
                <Button
                  leading={<Ionicons color={colors.text} name="chatbubble-outline" size={19} />}
                  onPress={handleMessage}
                  style={styles.primaryAction}
                  variant="outline"
                >
                  Message seller
                </Button>
                <Button
                  leading={<Ionicons color={palette.onPrimary} name="logo-whatsapp" size={19} />}
                  onPress={handleWhatsAppShare}
                  style={styles.primaryAction}
                  variant="whatsapp"
                >
                  Share on WhatsApp
                </Button>
              </>
            ) : (
              <Button
                leading={<Ionicons color={palette.onPrimary} name="create-outline" size={19} />}
                onPress={() => router.push(`/create-listing?id=${listing.id}`)}
                style={styles.primaryAction}
              >
                Edit listing
              </Button>
            )}
            {!isOwner ? (
              <AppPressable
                accessibilityLabel={listing.is_saved ? "Remove from saved listings" : "Save listing"}
                accessibilityRole="button"
                disabled={saving}
                onPress={handleSave}
                style={[styles.saveAction, listing.is_saved && styles.saveActionActive]}
              >
                <Ionicons
                  color={listing.is_saved ? colors.primaryDark : colors.text}
                  name={listing.is_saved ? "bookmark" : "bookmark-outline"}
                  size={22}
                />
              </AppPressable>
            ) : null}
          </View>

          <View style={styles.rule} />
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow icon="location-outline" label="Compound" value={listing.compound_name} />
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              listing.owner_id
                ? router.push(`/neighbours/${listing.owner_id}`)
                : undefined
            }
          >
            <DetailRow
              icon="person-outline"
              label={service ? "Provider" : "Listed by"}
              value={listing.owner_name}
            />
          </TouchableOpacity>
          <DetailRow icon="calendar-outline" label="Published" value={formatDate(listing.created_at)} />
          {attributeRows.map((row) => (
            <DetailRow icon={row.icon} key={row.label} label={row.label} value={row.value} />
          ))}

          {listing.description ? (
            <>
              <View style={styles.rule} />
              <Text style={styles.sectionTitle}>About this {service ? "service" : "listing"}</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </>
          ) : null}

          <View style={styles.rule} />
          {isOwner ? (
            <Button onPress={() => confirmDelete(true)} variant="danger">Delete listing</Button>
          ) : isModerator ? (
            <View style={styles.moderation}>
              <Button onPress={() => confirmDelete(false)} variant="danger">Delete listing</Button>
              <Button
                onPress={() => Alert.alert("Ban user?", `Ban ${listing.owner_name} from the platform?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Ban", style: "destructive", onPress: async () => {
                      try {
                        await apiClient.banUser(listing.owner_id, "Moderator action");
                        Alert.alert("User banned");
                      } catch (error: any) {
                        Alert.alert("Could not ban user", error.message || "Please try again.");
                      }
                    },
                  },
                ])}
                variant="outline"
              >
                Ban user
              </Button>
            </View>
          ) : (
            <Button
              leading={<Ionicons color={colors.error} name="flag-outline" size={18} />}
              onPress={() => setReportOpen(true)}
              textStyle={{ color: colors.error }}
              variant="ghost"
            >
              Report listing
            </Button>
          )}
        </View>
      </ScrollView>
      <ReportModal
        onClose={() => setReportOpen(false)}
        reportedId={listing.id}
        reportedTitle={listing.title}
        reportedType="listing"
        visible={reportOpen}
      />
    </Screen>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons color={colors.textMuted} name={icon} size={20} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function friendlyCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function friendlyAttribute(value: string) {
  return value.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function getAttributeRows(listing: Listing): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}[] {
  const attributes = listing.attributes;
  if (!attributes) return [];
  if (listing.category === "ITEM" && "condition" in attributes) {
    return [{ icon: "sparkles-outline", label: "Condition", value: friendlyAttribute(attributes.condition) }];
  }
  if (listing.category === "CAR" && "make" in attributes) {
    return [
      { icon: "car-sport-outline", label: "Make and model", value: `${attributes.make} ${attributes.model}` },
      { icon: "calendar-number-outline", label: "Year", value: String(attributes.year) },
      { icon: "speedometer-outline", label: "Mileage", value: `${attributes.mileage_km.toLocaleString()} km` },
      { icon: "git-compare-outline", label: "Transmission", value: friendlyAttribute(attributes.transmission) },
      { icon: "water-outline", label: "Fuel type", value: friendlyAttribute(attributes.fuel_type) },
    ];
  }
  if (listing.category === "PROPERTY" && "property_type" in attributes) {
    return [
      { icon: "home-outline", label: "Property type", value: friendlyAttribute(attributes.property_type) },
      { icon: "bed-outline", label: "Bedrooms", value: String(attributes.bedrooms) },
      { icon: "water-outline", label: "Bathrooms", value: String(attributes.bathrooms) },
      { icon: "resize-outline", label: "Area", value: `${attributes.area_sqm.toLocaleString()} m²` },
      { icon: "color-palette-outline", label: "Furnishing", value: friendlyAttribute(attributes.furnishing) },
    ];
  }
  return [];
}

function formatPrice(listing: Listing) {
  return listing.price == null ? "Price on request" : `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  hero: { width: SCREEN_WIDTH, height: Math.min(SCREEN_WIDTH * 0.78, 360), backgroundColor: palette.surfaceMuted },
  placeholder: { alignItems: "center", justifyContent: "center" },
  imageCount: {
    position: "absolute", right: spacing[4], bottom: spacing[3], paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radii.full, backgroundColor: "rgba(28,28,26,0.72)",
  },
  imageCountText: { color: palette.onPrimary, fontSize: typography.size.caption, fontWeight: typography.weight.semibold },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  meta: { flexDirection: "row", alignItems: "center", marginBottom: spacing[2] },
  eyebrow: { color: colors.primaryDark, fontSize: typography.size.bodySmall, fontWeight: typography.weight.semibold },
  dot: { marginHorizontal: spacing[2], color: colors.gray400 },
  intent: { color: colors.textSecondary, fontSize: typography.size.bodySmall },
  title: { color: colors.text, fontSize: typography.size.display, lineHeight: typography.lineHeight.display, fontWeight: typography.weight.bold },
  price: { marginTop: spacing[3], color: colors.text, fontSize: typography.size.title, lineHeight: typography.lineHeight.title, fontWeight: typography.weight.semibold },
  actions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[5] },
  primaryAction: { flex: 1 },
  saveAction: {
    width: 48, height: 48, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: palette.surface,
  },
  saveActionActive: { borderColor: colors.primary, backgroundColor: palette.primarySoft },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing[6], backgroundColor: colors.border },
  sectionTitle: { marginBottom: spacing[4], color: colors.text, fontSize: typography.size.titleSmall, lineHeight: typography.lineHeight.titleSmall, fontWeight: typography.weight.semibold },
  detailRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing[3] },
  detailCopy: { flex: 1 },
  detailLabel: { color: colors.textSecondary, fontSize: typography.size.caption },
  detailValue: { color: colors.text, fontSize: typography.size.bodySmall, lineHeight: 20, fontWeight: typography.weight.medium },
  description: { color: colors.textSecondary, fontSize: typography.size.body, lineHeight: typography.lineHeight.body },
  moderation: { gap: spacing[3] },
});
