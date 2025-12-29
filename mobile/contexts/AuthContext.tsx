import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { ApiClient, User } from "@hoodna/shared";
import Constants from "expo-constants";

// Get API URL from expo config or default to localhost
// For physical device, update this to your computer's local IP (e.g., http://192.168.1.XXX:8000)
const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiUrl || 
  process.env.EXPO_PUBLIC_API_URL || 
  "http://localhost:8000";

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
    loadAuth();
  }, []);

  async function loadAuth() {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (accessToken) {
        apiClient.setAccessToken(accessToken);
        const userData = await apiClient.getMe();
        setUser(userData);
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
    } finally {
      setLoading(false);
    }
  }

  async function login(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    apiClient.setAccessToken(accessToken);
    const userData = await apiClient.getMe();
    setUser(userData);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    apiClient.setAccessToken(null);
    setUser(null);
  }

  async function refreshUser() {
    try {
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }

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

