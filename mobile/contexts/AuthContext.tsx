import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import * as SecureStore from "expo-secure-store";
import { ApiClient, User } from "@hoodna/shared";
import { API_BASE_URL } from "@/lib/config";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apiClient: ApiClient;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiClient] = useState(() => new ApiClient(API_BASE_URL));

  useEffect(() => {
    apiClient.setTokenRefresher(async () => {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return null;
      try {
        const session = await apiClient.refreshSession(refreshToken);
        await SecureStore.setItemAsync("accessToken", session.access_token);
        await SecureStore.setItemAsync("refreshToken", session.refresh_token);
        return session.access_token;
      } catch {
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        return null;
      }
    });
    loadAuth();
    return () => apiClient.setTokenRefresher(null);
  }, [apiClient]);

  async function loadAuth() {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (accessToken) {
        apiClient.setAccessToken(accessToken);
        try {
          // Call getMe without extra timeout - let the API client handle it
          const userData = await apiClient.getMe();
          setUser(userData);
        } catch (authError: any) {
          // If token is invalid or timeout, clear it
          if (
            authError?.message?.includes("Invalid authentication") || 
            authError?.message?.includes("401") ||
            authError?.message?.includes("timeout") ||
            authError?.message?.includes("Network request failed")
          ) {
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
            apiClient.setAccessToken(null);
            setUser(null);
          } else {
            // For other errors, still clear loading but keep token (might be temporary network issue)
            setUser(null);
          }
        }
      } else {
        // No token, immediately stop loading
        setUser(null);
      }
    } catch (error) {
      // Silently handle auth errors - user just needs to log in
      setUser(null);
    } finally {
      // Ensure loading stops even if there's an error
      setLoading(false);
    }
  }

  const login = useCallback(async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    apiClient.setAccessToken(accessToken);
    try {
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (error: any) {
      // If getMe fails, clear tokens and rethrow
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      apiClient.setAccessToken(null);
      throw error;
    }
  }, [apiClient]);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    apiClient.setAccessToken(null);
    setUser(null);
  }, [apiClient]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [apiClient]);

  return (
    <AuthContext.Provider
      value={{ user, loading, apiClient, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
