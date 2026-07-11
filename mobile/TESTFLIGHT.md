# Shipping eljiran to TestFlight

## Prerequisites

1. **Apple Developer Program** membership (paid) for `mmsa12@gmail.com` or your team
2. **App Store Connect** app with bundle ID `com.eljiran.mobile`
3. **Public API** at `https://api.eljiran.com` (currently unreachable — TestFlight builds cannot use localhost)

## One-time setup

```bash
cd mobile
eas login   # already logged in as mmsa
```

Create the iOS app in [App Store Connect](https://appstoreconnect.apple.com) if it does not exist:
- Name: eljiran
- Bundle ID: `com.eljiran.mobile`
- SKU: anything unique (e.g. `eljiran-mobile-001`)

## Build + submit

Run these in your own terminal (Apple login is interactive):

```bash
cd mobile

# 1) Build for App Store / TestFlight
eas build --platform ios --profile production

# 2) After the build finishes, submit to TestFlight
eas submit --platform ios --profile production --latest
```

Or combine once credentials are set up:

```bash
eas build --platform ios --profile production --auto-submit
```

## After submit

1. Wait for Apple processing (usually 5–30 minutes)
2. In App Store Connect → TestFlight, add internal testers
3. Install via the TestFlight app on device

## Notes

- Production builds use `EXPO_PUBLIC_API_URL=https://api.eljiran.com`
- Local Expo Go still uses your LAN IP / localhost for development
- Icon/splash assets for store builds are `assets/icon.png` and `assets/splash.png`
