import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiBaseUrl(): string {
  // Explicit env always wins (set in EAS profiles / .env).
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Release / TestFlight builds: use production API.
  if (!__DEV__) {
    return (
      Constants.expoConfig?.extra?.apiUrl ||
      "https://eljiran-api.onrender.com"
    );
  }

  // Simulator/emulator in development.
  if (!Constants.isDevice) {
    return Platform.OS === "android"
      ? "http://10.0.2.2:8000"
      : "http://localhost:8000";
  }

  // Physical device in development: LAN IP from app.json / .env.
  return (
    Constants.expoConfig?.extra?.apiUrl ||
    "http://localhost:8000"
  );
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log("🔗 Mobile App API URL:", API_BASE_URL);
}
