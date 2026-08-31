import { Linking, Platform } from "react-native";

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
