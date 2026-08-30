#!/usr/bin/env bash
# Local App Store IPA build — Xcode only (no EAS / Expo cloud).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://eljiran-api.onrender.com}"
export NPM_CONFIG_LEGACY_PEER_DEPS=true

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "ERROR: Full Xcode is required (not just Command Line Tools)."
  echo "Install Xcode from the Mac App Store, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

echo "==> Building shared packages"
npm run build:packages

echo "==> Generating native iOS project"
npx expo prebuild --platform ios --non-interactive

BUILD_NUMBER="$(node -e "const app=require('./app.json'); console.log(app.expo.ios.buildNumber || '1')")"
echo "==> Setting iOS build number ${BUILD_NUMBER}"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${BUILD_NUMBER}" "$ROOT_DIR/ios/eljiran/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :aps-environment production" "$ROOT_DIR/ios/eljiran/eljiran.entitlements" 2>/dev/null || true

WORKSPACE="$ROOT_DIR/ios/eljiran.xcworkspace"
SCHEME="eljiran"
ARCHIVE_PATH="$ROOT_DIR/dist/eljiran.xcarchive"
EXPORT_PATH="$ROOT_DIR/dist"
EXPORT_OPTIONS="$ROOT_DIR/scripts/ExportOptions.plist"
IPA_PATH="$EXPORT_PATH/eljiran.ipa"
PROFILE_PATH="${IOS_PROVISIONING_PROFILE_PATH:-$ROOT_DIR/credentials/ios/profile.mobileprovision}"

SIGNING_ARGS=(
  CODE_SIGN_STYLE=Manual
  DEVELOPMENT_TEAM=29QWSF7YZ8
)

if [[ -f "$PROFILE_PATH" ]]; then
  PROFILE_SPECIFIER="$(
    security cms -D -i "$PROFILE_PATH" |
      plutil -extract Name raw -o - -
  )"
  SIGNING_ARGS+=(
    "PROVISIONING_PROFILE_SPECIFIER=$PROFILE_SPECIFIER"
    "CODE_SIGN_IDENTITY=iPhone Distribution"
  )
fi

mkdir -p "$ROOT_DIR/dist"

echo "==> Archiving ($SCHEME)"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  "${SIGNING_ARGS[@]}" \
  archive

echo "==> Exporting IPA"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS"

if [[ -f "$IPA_PATH" ]]; then
  BUILD_NUM="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE_PATH/Info.plist" 2>/dev/null || echo unknown)"
  DEST="$ROOT_DIR/dist/eljiran-build-${BUILD_NUM}.ipa"
  cp "$IPA_PATH" "$DEST"
  echo ""
  echo "SUCCESS: $DEST"
  echo "Upload with: npm run upload:ios"
else
  echo "ERROR: IPA not found at $IPA_PATH"
  exit 1
fi
