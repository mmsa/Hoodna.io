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

import { useAuth } from "@/contexts/AuthContext";

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { apiClient, user } = useAuth();
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
