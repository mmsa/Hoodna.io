import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { Modal, StyleSheet, Text, View } from "react-native";

import { AppPressable, Button, Chip, TextField } from "@/components/ui";
import { colors } from "@/constants/colors";

const SORTS = [
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function MarketplaceFilterSheet({
  visible,
  onClose,
  intent,
  setIntent,
  sortBy,
  setSortBy,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  onReset,
  service = false,
}: {
  visible: boolean;
  onClose: () => void;
  intent: string;
  setIntent: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  minPrice: string;
  setMinPrice: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  onReset: () => void;
  service?: boolean;
}) {
  const intents = service
    ? [
        { value: "", label: "Any pricing" },
        { value: "SELL", label: "One-time" },
        { value: "RENT", label: "Hourly" },
      ]
    : [
        { value: "", label: "Any type" },
        { value: "SELL", label: "For sale" },
        { value: "RENT", label: "For rent" },
      ];

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Filter and sort</Text>
            <Text style={styles.subtitle}>Narrow the results without losing your place.</Text>
          </View>
          <AppPressable
            accessibilityLabel="Close filters"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.close}
          >
            <Ionicons color={colors.text} name="close" size={22} />
          </AppPressable>
        </View>

        <Text style={styles.label}>{service ? "Pricing" : "Listing type"}</Text>
        <View style={styles.options}>
          {intents.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onPress={() => setIntent(option.value)}
              selected={intent === option.value}
            />
          ))}
        </View>

        <Text style={styles.label}>Sort by</Text>
        <View style={styles.options}>
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onPress={() => setSortBy(option.value)}
              selected={sortBy === option.value}
            />
          ))}
        </View>

        <Text style={styles.label}>Price range</Text>
        <View style={styles.priceRow}>
          <TextField
            accessibilityLabel="Minimum price"
            containerStyle={styles.priceField}
            keyboardType="decimal-pad"
            onChangeText={setMinPrice}
            placeholder="Minimum"
            value={minPrice}
          />
          <TextField
            accessibilityLabel="Maximum price"
            containerStyle={styles.priceField}
            keyboardType="decimal-pad"
            onChangeText={setMaxPrice}
            placeholder="Maximum"
            value={maxPrice}
          />
        </View>

        <View style={styles.actions}>
          <Button onPress={onReset} style={styles.action} variant="outline">Reset</Button>
          <Button onPress={onClose} style={styles.action}>Show results</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[4],
    marginBottom: spacing[8],
  },
  title: {
    color: colors.text,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: palette.surfaceMuted,
  },
  label: {
    marginBottom: spacing[2],
    color: colors.text,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    marginBottom: spacing[6],
  },
  priceRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  priceField: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: "auto",
    paddingTop: spacing[6],
  },
  action: {
    flex: 1,
  },
});
