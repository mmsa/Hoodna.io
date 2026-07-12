import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Listing } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppPressable } from "@/components/ui/app-pressable";

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  PROPERTY: "home-outline",
  CAR: "car-sport-outline",
  ITEM: "cube-outline",
  SERVICE: "construct-outline",
};

export function ListingCard({
  listing,
  onPress,
  trailing,
  service = false,
}: {
  listing: Listing;
  onPress: () => void;
  trailing?: React.ReactNode;
  service?: boolean;
}) {
  const image = listing.image_urls?.[0];
  const price = listing.price == null ? "Contact for price" : `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;
  const intent = service
    ? listing.intent === "RENT" ? "Hourly" : "One-time"
    : listing.intent === "RENT" ? "For rent" : "For sale";

  return (
    <AppPressable
      accessibilityLabel={`${listing.title}, ${price}`}
      accessibilityRole="button"
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={styles.card}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name={categoryIcons[listing.category] || "storefront-outline"} size={30} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.eyebrow}>{service ? "VERIFIED SERVICE" : listing.category}</Text>
          <Text style={styles.intent}>{intent}</Text>
        </View>
        <View style={styles.titleRow}>
          <View style={styles.copy}>
            <Text numberOfLines={2} style={styles.title}>{listing.title}</Text>
            {service && listing.description ? (
              <Text numberOfLines={2} style={styles.description}>{listing.description}</Text>
            ) : null}
          </View>
          {trailing}
        </View>
        <Text style={styles.price}>{price}</Text>
        {listing.compound_name ? <Text numberOfLines={1} style={styles.location}>{listing.compound_name}</Text> : null}
      </View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.large,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.82 },
  image: { width: "100%", aspectRatio: 1.55, backgroundColor: palette.surfaceMuted },
  placeholder: {
    width: "100%",
    aspectRatio: 1.55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceMuted,
  },
  body: { padding: spacing[4] },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2] },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.5,
  },
  intent: { color: colors.textSecondary, fontSize: typography.size.caption },
  titleRow: { marginTop: spacing[2], flexDirection: "row", alignItems: "flex-start", gap: spacing[2] },
  copy: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.semibold,
  },
  description: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  price: {
    marginTop: spacing[3],
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
  location: { marginTop: spacing[1], color: colors.textSecondary, fontSize: typography.size.caption },
});
import { Ionicons } from "@expo/vector-icons";
import type { ApiClient, Listing } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";

import { SignedImage } from "@/components/signed-image";
import { AppPressable, IconButton } from "@/components/ui";
import { colors } from "@/constants/colors";

const CATEGORY_LABELS: Record<string, string> = {
  PROPERTY: "Property",
  CAR: "Car",
  ITEM: "Item",
  SERVICE: "Service",
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PROPERTY: "home-outline",
  CAR: "car-sport-outline",
  ITEM: "cube-outline",
  SERVICE: "construct-outline",
};

export function formatListingPrice(listing: Listing) {
  if (listing.price == null) return "Price on request";
  return `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;
}

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
  const category = listing.category || "ITEM";
  const isRow = layout === "row";

  return (
    <AppPressable
      accessibilityHint="Opens listing details"
      accessibilityLabel={`${listing.title}, ${formatListingPrice(listing)}`}
      accessibilityRole="button"
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, isRow && styles.rowCard]}
    >
      {image ? (
        <SignedImage
          apiClient={apiClient}
          fileUrl={image}
          resizeMode="cover"
          style={isRow ? styles.rowImage : styles.gridImage}
        />
      ) : (
        <View style={[styles.placeholder, isRow ? styles.rowImage : styles.gridImage]}>
          <Ionicons
            color={colors.gray400}
            name={CATEGORY_ICONS[category] || "storefront-outline"}
            size={isRow ? 28 : 34}
          />
        </View>
      )}

      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <Text style={styles.eyebrow}>{CATEGORY_LABELS[category] || category}</Text>
          {listing.intent ? (
            <Text style={styles.intent}>
              {category === "SERVICE"
                ? listing.intent === "RENT"
                  ? "Hourly"
                  : "One-time"
                : listing.intent === "SELL"
                  ? "For sale"
                  : "For rent"}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <Text numberOfLines={1} style={styles.price}>
          {formatListingPrice(listing)}
        </Text>
        {isRow && listing.compound_name ? (
          <Text numberOfLines={1} style={styles.location}>
            {listing.compound_name}
          </Text>
        ) : null}
      </View>

      {onRemove ? (
        <IconButton
          accessibilityLabel={`Remove ${listing.title} from saved listings`}
          disabled={removing}
          icon={
            <Ionicons
              color={colors.error}
              name={removing ? "hourglass-outline" : "bookmark"}
              size={20}
            />
          }
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
  },
  rowCard: {
    minHeight: 128,
    flexDirection: "row",
  },
  pressed: {
    backgroundColor: palette.surfacePressed,
    opacity: 0.88,
  },
  gridImage: {
    width: "100%",
    height: 148,
  },
  rowImage: {
    width: 120,
    height: "100%",
    minHeight: 128,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceMuted,
  },
  copy: {
    flex: 1,
    padding: spacing[3],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
  intent: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  title: {
    minHeight: 40,
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  price: {
    marginTop: spacing[2],
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  location: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  remove: {
    position: "absolute",
    top: spacing[2],
    right: spacing[2],
  },
});
