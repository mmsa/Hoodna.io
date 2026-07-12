import { Ionicons } from "@expo/vector-icons";
import type { ApiClient, Listing } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";

import { SignedImage } from "@/components/signed-image";
import { Avatar, AppPressable, IconButton } from "@/components/ui";
import { colors } from "@/constants/colors";

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  PROPERTY: "home-outline",
  CAR: "car-sport-outline",
  ITEM: "cube-outline",
  SERVICE: "construct-outline",
};

export function ListingCard({
  listing,
  apiClient,
  onPress,
  onRemove,
  removing = false,
  layout = "grid",
}: {
  listing: Listing;
  apiClient?: ApiClient;
  onPress: () => void;
  onRemove?: () => void;
  removing?: boolean;
  layout?: "grid" | "row";
}) {
  const image = listing.image_urls?.[0];
  const service = listing.category === "SERVICE";
  const row = layout === "row";
  const price = listing.price == null
    ? "Ask price"
    : `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;
  const intent = service
    ? listing.intent === "RENT" ? "Hourly" : "One-time"
    : listing.intent === "RENT" ? "For rent" : "For sale";
  const sellerName = listing.owner_name || "Neighbour";

  return (
    <AppPressable
      accessibilityHint="Opens listing details"
      accessibilityLabel={`${listing.title}, ${price}`}
      accessibilityRole="button"
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, row && styles.rowCard]}
    >
      <View style={[styles.mediaWrap, row && styles.rowImageWrap]}>
        {image ? (
          <SignedImage
            apiClient={apiClient}
            fileUrl={image}
            resizeMode="cover"
            style={row ? styles.rowImage : styles.image}
          />
        ) : (
          <View style={[styles.placeholder, row && styles.rowImage]}>
            <Ionicons
              color={colors.primary}
              name={categoryIcons[listing.category] || "storefront-outline"}
              size={28}
            />
            <Text style={styles.placeholderText}>Add a photo</Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{service ? "Service" : listing.category}</Text>
        </View>
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>{price}</Text>
        </View>
      </View>

      <View style={[styles.body, row && styles.rowBody]}>
        <Text numberOfLines={2} style={styles.title}>{listing.title}</Text>
        <View style={styles.sellerRow}>
          <Avatar name={sellerName} size={28} />
          <View style={styles.sellerMeta}>
            <Text numberOfLines={1} style={styles.sellerName}>{sellerName}</Text>
            <Text style={styles.intent}>{intent}</Text>
          </View>
        </View>
        {listing.compound_name ? (
          <Text numberOfLines={1} style={styles.location}>{listing.compound_name}</Text>
        ) : null}
      </View>

      {onRemove ? (
        <IconButton
          accessibilityLabel={`Remove ${listing.title} from saved listings`}
          disabled={removing}
          icon={<Ionicons color={colors.error} name={removing ? "hourglass-outline" : "bookmark"} size={20} />}
          onPress={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          style={styles.remove}
          variant="subtle"
        />
      ) : null}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.large,
    backgroundColor: palette.surface,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowCard: { minHeight: 132, flexDirection: "row" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  mediaWrap: { position: "relative" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: palette.surfaceMuted },
  rowImageWrap: { width: 120 },
  rowImage: { width: 120, height: "100%", minHeight: 132 },
  placeholder: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    backgroundColor: palette.primarySoft,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.medium,
  },
  categoryBadge: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  categoryText: {
    color: colors.text,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  priceBadge: {
    position: "absolute",
    bottom: spacing[2],
    left: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
  },
  priceBadgeText: {
    color: palette.onPrimary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  body: { flex: 1, padding: spacing[3] },
  rowBody: { padding: spacing[3] },
  title: {
    color: colors.text,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  sellerRow: {
    marginTop: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  sellerMeta: { flex: 1, minWidth: 0 },
  sellerName: {
    color: colors.text,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  intent: { color: colors.textSecondary, fontSize: typography.size.caption },
  location: { marginTop: spacing[1], color: colors.textSecondary, fontSize: typography.size.caption },
  remove: { position: "absolute", top: spacing[2], right: spacing[2] },
});
