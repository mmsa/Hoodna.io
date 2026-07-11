import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiBaseUrl(): string {
  // Simulator/emulator: talk to the backend on this machine directly.
  if (!Constants.isDevice) {
    return Platform.OS === "android"
      ? "http://10.0.2.2:8000"
      : "http://localhost:8000";
  }

  // Physical device: needs your computer's LAN IP (see mobile/.env).
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    "http://localhost:8000"
  );
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log("🔗 Mobile App API URL:", API_BASE_URL);
}
