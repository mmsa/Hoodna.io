import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "./AuthContext";
import { Alert } from "react-native";

const ACTIVE_COMPOUND_KEY = "activeCompoundId";

interface CompoundContextType {
  activeCompoundId: number | null;
  isSwitching: boolean;
  switchCompound: (compoundId: number) => Promise<void>;
  refreshCompound: () => Promise<void>;
}

const CompoundContext = createContext<CompoundContextType | undefined>(undefined);

export function CompoundProvider({ children }: { children: React.ReactNode }) {
  const { user, apiClient, refreshUser } = useAuth();
  const [activeCompoundId, setActiveCompoundId] = useState<number | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  // Load active compound from storage on mount
  useEffect(() => {
    loadActiveCompound();
  }, []);

  // Sync with user's compound_id when user changes
  useEffect(() => {
    if (user?.compound_id) {
      setActiveCompoundId(user.compound_id);
      // Persist to storage
      SecureStore.setItemAsync(ACTIVE_COMPOUND_KEY, user.compound_id.toString()).catch(() => {
        // Silently fail - not critical
      });
    } else if (user === null) {
      // User logged out, clear compound
      setActiveCompoundId(null);
      SecureStore.deleteItemAsync(ACTIVE_COMPOUND_KEY).catch(() => {});
    }
  }, [user?.compound_id, user]);

  async function loadActiveCompound() {
    try {
      const stored = await SecureStore.getItemAsync(ACTIVE_COMPOUND_KEY);
      if (stored) {
        const compoundId = parseInt(stored, 10);
        if (!isNaN(compoundId)) {
          setActiveCompoundId(compoundId);
          // If user has a different compound_id, sync it
          if (user?.compound_id && user.compound_id !== compoundId) {
            // Backend is source of truth, update local storage
            setActiveCompoundId(user.compound_id);
            await SecureStore.setItemAsync(ACTIVE_COMPOUND_KEY, user.compound_id.toString());
          }
        }
      } else if (user?.compound_id) {
        // No stored value, use user's compound_id
        setActiveCompoundId(user.compound_id);
        await SecureStore.setItemAsync(ACTIVE_COMPOUND_KEY, user.compound_id.toString());
      }
    } catch (error) {
      console.error("Failed to load active compound:", error);
      // Fallback to user's compound_id
      if (user?.compound_id) {
        setActiveCompoundId(user.compound_id);
      }
    }
  }

  const switchCompound = useCallback(async (compoundId: number) => {
    if (isSwitching) return;
    if (compoundId === activeCompoundId) return;

    setIsSwitching(true);
    try {
      // Call backend to switch compound
      await apiClient.switchCompound(compoundId);
      
      // Update local state
      setActiveCompoundId(compoundId);
      
      // Persist to storage
      await SecureStore.setItemAsync(ACTIVE_COMPOUND_KEY, compoundId.toString());
      
      // Refresh user data to get updated compound_id
      await refreshUser();
      
      // Note: Query invalidation should be handled by components using this context
      // Components should watch activeCompoundId and refetch queries when it changes
    } catch (error: any) {
      console.error("Failed to switch compound:", error);
      const errorMessage = error?.message || "Failed to switch compound";
      
      // If user is not verified for this compound, show helpful message
      if (errorMessage.includes("not verified") || errorMessage.includes("403")) {
        Alert.alert(
          "Verification Required",
          "You need to submit verification documents for this compound before switching.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Go to Verification",
              onPress: () => {
                // Navigation will be handled by the component that called switchCompound
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", errorMessage);
      }
      throw error;
    } finally {
      setIsSwitching(false);
    }
  }, [activeCompoundId, isSwitching, apiClient, refreshUser]);

  const refreshCompound = useCallback(async () => {
    await loadActiveCompound();
  }, []);

  return (
    <CompoundContext.Provider
      value={{
        activeCompoundId,
        isSwitching,
        switchCompound,
        refreshCompound,
      }}
    >
      {children}
    </CompoundContext.Provider>
  );
}

export function useCompound() {
  const context = useContext(CompoundContext);
  if (!context) {
    throw new Error("useCompound must be used within CompoundProvider");
  }
  return context;
}

