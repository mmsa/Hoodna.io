import { Linking, Platform } from "react-native";
import Constants from "expo-constants";

type NotificationsModule = typeof import("expo-notifications");

let notifications: NotificationsModule | null = null;

function loadNotifications(): NotificationsModule | null {
  if (notifications) return notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifications = require("expo-notifications") as NotificationsModule;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    notifications = null;
  }
  return notifications;
}

async function ensureAndroidChannel() {
  const Notifications = loadNotifications();
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "eljiran",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#158074",
  });
}

export async function getPushPermissionStatus() {
  const Notifications = loadNotifications();
  if (!Notifications) return "undetermined";
  try {
    await ensureAndroidChannel();
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return "undetermined";
  }
}

/** Prompts for OS notification permission. Returns true when alerts are allowed. */
export async function requestPushPermission(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") return true;

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return requested.status === "granted";
  } catch {
    return false;
  }
}

export function openSystemNotificationSettings() {
  void Linking.openSettings();
}

/**
 * Fetches this device's Expo push token.
 *
 * Returns null rather than throwing whenever a token cannot exist: no OS
 * permission, a simulator with no push support, or a missing EAS project id.
 * Callers treat push as an enhancement, so none of those should surface an error.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return null;

    // getExpoPushTokenAsync needs the EAS project id explicitly in SDK 49+.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) return null;

    await ensureAndroidChannel();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    return null;
  }
}

/** Best-effort device registration. Never throws — push is not critical path. */
export async function registerDeviceForPush(
  apiClient: { registerPushToken: (d: { token: string; platform?: string; device_name?: string }) => Promise<void> },
): Promise<boolean> {
  const token = await getExpoPushToken();
  if (!token) return false;
  try {
    await apiClient.registerPushToken({
      token,
      platform: Platform.OS,
      device_name: Constants.deviceName ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}

type NotificationTapData = {
  /** Notification row id, used by the shared router's fallback destination. */
  id: number;
  type: string;
  related_id?: number | null;
  related_type?: string | null;
};

/**
 * Runs `handler` when the user taps a push notification.
 *
 * Also covers the cold-start case: if the app was launched by a tap, the OS
 * delivers that response once via getLastNotificationResponseAsync rather than
 * through the listener, so both paths are handled here.
 */
export function addNotificationTapListener(
  handler: (data: NotificationTapData | null) => void,
): { remove: () => void } | null {
  const Notifications = loadNotifications();
  if (!Notifications) return null;

  const extract = (response: unknown): NotificationTapData | null => {
    const data = (response as any)?.notification?.request?.content?.data;
    if (!data || typeof data.type !== "string") return null;
    return {
      id: Number(data.notification_id) || 0,
      type: data.type,
      related_id: data.related_id ?? null,
      related_type: data.related_type ?? null,
    };
  };

  let handledColdStart = false;
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response || handledColdStart) return;
      handledColdStart = true;
      handler(extract(response));
    })
    .catch(() => {
      // No launch notification, or the module is unavailable.
    });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => handler(extract(response)),
  );
  return { remove: () => subscription.remove() };
}

/** Detaches this device at sign-out so a new account does not inherit alerts. */
export async function unregisterDeviceForPush(
  apiClient: { unregisterPushToken: (token: string) => Promise<void> },
): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    await apiClient.unregisterPushToken(token);
  } catch {
    // Sign-out must succeed regardless; the server prunes dead tokens on send.
  }
}
