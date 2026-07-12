import { Redirect } from "expo-router";

/**
 * Compatibility route for older links. The tab screen is the single
 * conversations-list implementation.
 */
export default function LegacyMessagesRoute() {
  return <Redirect href="/(tabs)/messages" />;
}
