# Shipping eljiran to TestFlight (Xcode + Transporter)

Build locally with Xcode, upload with Apple Transporter. No EAS cloud build.

## Prerequisites

1. **Apple Developer Program** membership
2. **Xcode** from the Mac App Store
3. **Apple Transporter** from the Mac App Store
4. App Store Connect app: bundle ID `com.eljiran.mobile`, ASC app id `6789875474`
5. Public API: `https://eljiran-api.onrender.com`

One-time Xcode setup:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

In Xcode → Settings → Accounts, sign in and download the **iPhone Distribution** certificate + App Store profile for `com.eljiran.mobile`.

## Build IPA locally

```bash
cd mobile
chmod +x scripts/*.sh
npm run build:ios:local
```

This runs `expo prebuild` to generate `ios/` (gitignored), archives with Xcode, and exports `dist/eljiran-build-<number>.ipa`.

Bump build number in `app.json` → `expo.ios.buildNumber` before each release.

## Upload to TestFlight

```bash
npm run upload:ios
```

Sign in to Transporter → **Deliver**.

CLI option (app-specific password):

```bash
export APPLE_ID="your@email.com"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
npm run upload:ios
```

## After upload

1. Wait 5–30 minutes for Apple processing
2. App Store Connect → TestFlight → add testers
3. Install via the TestFlight app

## Notes

- `ios/` and `android/` are generated locally and not committed — run `npm run prebuild` or `build:ios:local` to recreate
- Dev still uses `npm start` / Expo Go
- Icon/splash: `assets/icon.png`, `assets/splash.png`
