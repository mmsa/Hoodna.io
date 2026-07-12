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
  const price = listing.price == null
    ? "Contact for price"
    : `${listing.price.toLocaleString()} ${listing.currency || "EGP"}`;
  const intent = service
    ? listing.intent === "RENT" ? "Hourly" : "One-time"
    : listing.intent === "RENT" ? "For rent" : "For sale";

  return (
    <AppPressable
      accessibilityHint="Opens listing details"
      accessibilityLabel={`${listing.title}, ${price}`}
      accessibilityRole="button"
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.card, row && styles.rowCard]}
    >
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
            color={colors.textMuted}
            name={categoryIcons[listing.category] || "storefront-outline"}
            size={30}
          />
        </View>
      )}
      <View style={[styles.body, row && styles.rowBody]}>
        <View style={styles.metaRow}>
          <Text style={styles.eyebrow}>{service ? "SERVICE" : listing.category}</Text>
          <Text style={styles.intent}>{intent}</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>{listing.title}</Text>
        {service && listing.description && !row ? (
          <Text numberOfLines={2} style={styles.description}>{listing.description}</Text>
        ) : null}
        <Text numberOfLines={1} style={styles.price}>{price}</Text>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.large,
    backgroundColor: palette.surface,
  },
  rowCard: { minHeight: 132, flexDirection: "row" },
  pressed: { opacity: 0.82, backgroundColor: palette.surfacePressed },
  image: { width: "100%", aspectRatio: 1.55, backgroundColor: palette.surfaceMuted },
  rowImage: { width: 120, height: "100%", minHeight: 132 },
  placeholder: {
    width: "100%",
    aspectRatio: 1.55,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceMuted,
  },
  body: { flex: 1, padding: spacing[4] },
  rowBody: { padding: spacing[3] },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2] },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.5,
  },
  intent: { color: colors.textSecondary, fontSize: typography.size.caption },
  title: {
    marginTop: spacing[2],
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.bodySmall,
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
  remove: { position: "absolute", top: spacing[2], right: spacing[2] },
});
