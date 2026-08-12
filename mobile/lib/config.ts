import Constants from "expo-constants";

const RENDER_API_URL = "https://eljiran-api.onrender.com";

function resolveApiBaseUrl(): string {
  // Explicit env always wins (EAS profiles / .env). Use a local URL here
  // only when you intentionally want a local backend.
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Default to Render for local simulator/device and release builds.
  return Constants.expoConfig?.extra?.apiUrl || RENDER_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
