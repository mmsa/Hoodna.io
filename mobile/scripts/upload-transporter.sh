#!/usr/bin/env bash
# Upload IPA to App Store Connect via Apple Transporter (no EAS Submit).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IPA="${1:-}"

if [[ -z "$IPA" ]]; then
  IPA="$(ls -t "$ROOT_DIR"/dist/eljiran-build-*.ipa "$ROOT_DIR"/dist/eljiran.ipa 2>/dev/null | head -1 || true)"
fi

if [[ -z "$IPA" || ! -f "$IPA" ]]; then
  echo "Usage: $0 [path/to/app.ipa]"
  echo "Or place an IPA in mobile/dist/ and run without arguments."
  exit 1
fi

TRANSPORTER_BIN="/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter"

if [[ -x "$TRANSPORTER_BIN" ]]; then
  echo "==> Uploading via iTMSTransporter: $IPA"
  if [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" ]]; then
    "$TRANSPORTER_BIN" -m upload \
      -assetFile "$IPA" \
      -u "$APPLE_ID" \
      -p "$APPLE_APP_PASSWORD" \
      -v informational
    echo "SUCCESS: Upload finished."
    exit 0
  fi

  echo "No APPLE_ID / APPLE_APP_PASSWORD in env — opening Transporter app instead."
fi

if [[ -d "/Applications/Transporter.app" ]]; then
  open -a Transporter "$IPA"
  echo "Opened Transporter with: $IPA"
  echo "Sign in and click Deliver."
  exit 0
fi

echo "ERROR: Install Apple Transporter from the Mac App Store."
exit 1
