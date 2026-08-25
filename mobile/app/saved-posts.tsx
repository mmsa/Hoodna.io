import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Post } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { Header } from "@/components/Header";
import { NeighbourPostCard } from "@/components/home/neighbour-post-card";
import { Button, EmptyState, LoadingState, Screen } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function SavedPostsScreen() {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await apiClient.getSavedPosts());
    } catch (error: any) {
      Alert.alert("Could not load saved posts", error?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen padded={false}>
      <Header title="Saved posts" showBackButton />
      <View style={styles.tabs}>
        <View style={[styles.tab, styles.activeTab]}><Text style={styles.activeText}>Posts</Text></View>
        <Button variant="ghost" size="small" onPress={() => router.replace("/saved-listings")}>Listings</Button>
      </View>
      {loading ? <LoadingState label="Loading saved posts" /> : (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          renderItem={({ item }) => <NeighbourPostCard post={{ ...item, is_saved: true }} apiClient={apiClient} currentUser={user} />}
          ListEmptyComponent={<EmptyState title="No saved posts" description="Bookmark a neighbour post to keep it here." />}
          contentContainerStyle={posts.length ? styles.content : styles.empty}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[5], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  tab: { height: 52, justifyContent: "center", paddingHorizontal: spacing[2] },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  activeText: { color: colors.primary, fontSize: typography.size.bodySmall, fontWeight: typography.weight.bold },
  content: { paddingTop: spacing[4], paddingBottom: spacing[8] },
  empty: { flexGrow: 1, justifyContent: "center", borderRadius: radii.medium },
});
