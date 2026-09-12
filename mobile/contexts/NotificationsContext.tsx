import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { notificationPath } from "@/lib/notification-path";
import {
  addNotificationTapListener,
  registerDeviceForPush,
} from "@/lib/push-notifications";

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { apiClient, user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await apiClient.getUnreadNotificationCount();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Keep last known count on transient failures
    }
  }, [apiClient, user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    void refreshUnreadCount();
    const interval = setInterval(() => {
      void refreshUnreadCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount, user]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active" && user) {
        void refreshUnreadCount();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refreshUnreadCount, user]);

  // Register this device once a session exists. Keyed on the user id so a new
  // account signing in on the same phone takes ownership of the token, and so a
  // restored session on app launch re-registers (tokens can be reissued).
  useEffect(() => {
    if (!user) return;
    void registerDeviceForPush(apiClient);
  }, [apiClient, user?.id]);

  // Opening a push should land on the same screen the notification list would.
  useEffect(() => {
    const subscription = addNotificationTapListener((data) => {
      const path = data ? notificationPath(data) : null;
      router.push((path ?? "/notifications") as never);
      void refreshUnreadCount();
    });
    return () => subscription?.remove();
  }, [refreshUnreadCount, router]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, setUnreadCount }),
    [unreadCount, refreshUnreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
