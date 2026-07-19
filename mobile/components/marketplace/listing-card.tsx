import { Ionicons } from "@expo/vector-icons";
import type { ApiClient, Listing } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";

import { SignedImage } from "@/components/signed-image";
import { AppPressable, IconButton } from "@/components/ui";
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
  const price =
    listing.price == null
      ? "Ask price"
      : `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;

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
          </View>
        )}
      </View>

      <View style={[styles.body, row && styles.rowBody]}>
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{price}</Text>
        {service && listing.owner_name ? (
          <Text numberOfLines={1} style={styles.meta}>
            {listing.owner_name}
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
    backgroundColor: "transparent",
  },
  rowCard: {
    minHeight: 112,
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    overflow: "hidden",
  },
  pressed: { opacity: 0.92 },
  mediaWrap: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: palette.surfaceMuted,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: palette.surfaceMuted,
  },
  rowImageWrap: {
    width: 112,
    borderRadius: 0,
  },
  rowImage: {
    width: 112,
    height: "100%",
    minHeight: 112,
  },
  placeholder: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft,
  },
  body: {
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  rowBody: {
    flex: 1,
    padding: spacing[3],
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    fontWeight: typography.weight.medium,
  },
  price: {
    marginTop: 4,
    color: colors.primary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  meta: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: typography.size.caption,
  },
  remove: { position: "absolute", top: spacing[2], right: spacing[2] },
});
