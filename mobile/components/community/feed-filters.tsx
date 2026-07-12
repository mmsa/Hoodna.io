import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { Button, Chip, IconButton } from "@/components/ui";
import { colors } from "@/constants/colors";
import { POST_FILTERS, type FeedCategory } from "./post-support";

interface FeedFiltersProps {
  query: string;
  category: FeedCategory;
  sort: "newest" | "oldest";
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: FeedCategory) => void;
  onSortChange: (value: "newest" | "oldest") => void;
  onReset: () => void;
}

export function FeedFilters({
  query,
  category,
  sort,
  onQueryChange,
  onCategoryChange,
  onSortChange,
  onReset,
}: FeedFiltersProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const hasSortOverride = sort !== "newest";

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons color={colors.textSecondary} name="search-outline" size={19} />
          <TextInput
            accessibilityLabel="Search community posts"
            autoCapitalize="none"
            onChangeText={onQueryChange}
            placeholder="Search discussions"
            placeholderTextColor={palette.inkSubtle}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {query ? (
            <IconButton
              accessibilityLabel="Clear search"
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="close-circle"
                  size={20}
                />
              }
              onPress={() => onQueryChange("")}
              style={styles.clearButton}
              variant="ghost"
            />
          ) : null}
        </View>
        <IconButton
          accessibilityLabel="Sort posts"
          accessibilityState={{ expanded: sheetVisible }}
          icon={
            <Ionicons
              color={hasSortOverride ? colors.primary : colors.text}
              name="options-outline"
              size={21}
            />
          }
          onPress={() => setSheetVisible(true)}
          variant={hasSortOverride ? "subtle" : "default"}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.chips}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {POST_FILTERS.map((filter) => (
          <Chip
            key={filter.value || "all"}
            label={filter.label}
            onPress={() => onCategoryChange(filter.value)}
            selected={category === filter.value}
          />
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
        transparent
        visible={sheetVisible}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              Sort posts
            </Text>
            <View style={styles.sortOptions}>
              <Chip
                label="Newest first"
                onPress={() => onSortChange("newest")}
                selected={sort === "newest"}
              />
              <Chip
                label="Oldest first"
                onPress={() => onSortChange("oldest")}
                selected={sort === "oldest"}
              />
            </View>
            <View style={styles.actions}>
              <Button onPress={onReset} style={styles.action} variant="ghost">
                Reset
              </Button>
              <Button
                onPress={() => setSheetVisible(false)}
                style={styles.action}
              >
                Apply
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[4],
    backgroundColor: palette.canvas,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  search: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.large,
    backgroundColor: palette.surface,
    paddingLeft: spacing[3],
  },
  input: {
    minHeight: 44,
    flex: 1,
    paddingHorizontal: spacing[2],
    color: colors.text,
    fontSize: typography.size.bodySmall,
  },
  clearButton: {
    width: 44,
    height: 44,
  },
  chips: {
    gap: spacing[2],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 28, 26, 0.32)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: spacing[5],
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.semibold,
  },
  sortOptions: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[4],
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[6],
  },
  action: {
    flex: 1,
  },
});
