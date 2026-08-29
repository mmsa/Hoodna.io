# Shipping eljiran to Google Play (EAS)

Cloud AAB build via EAS. No Android device or local emulator required.

## Prerequisites

1. **Google Play Console** developer account (~$25 one-time)
2. Create an app with package ID `com.eljiran.mobile`
3. Logged into EAS: `eas whoami` (project owner: `mmsa`)
4. Public API: `https://eljiran-api.onrender.com`

### First-time Play Console setup

1. [Play Console](https://play.google.com/console) → Create app → package `com.eljiran.mobile`
2. Complete the required store listing drafts (name, short description, icon, screenshots, privacy policy)
3. Create an **Internal testing** track (recommended for first upload)
4. For CLI submit (`eas submit`), create a Google Cloud **service account** with Play Console API access:
   - Play Console → Users and permissions → Invite user → service account email
   - Grant **Release to testing tracks** (or Admin)
   - Download the JSON key and either:
     - Upload it in [Expo credentials](https://expo.dev) → project → Credentials → Android → Google Service Account Key, or
     - Keep it locally (gitignored) and pass the path when `eas submit` prompts

Until the service account exists, download the AAB from the EAS build page and upload it manually under **Internal testing → Create new release**.

## Build AAB

```bash
cd mobile
npm run build:android
```

Or:

```bash
eas build -p android --profile production
```

EAS manages the upload keystore on first run (let it generate/store credentials).  
`autoIncrement` bumps Android `versionCode` remotely.

## Submit to Play (internal track, draft)

```bash
npm run submit:android
```

Configured in `eas.json` as track `internal`, `releaseStatus` `draft`.  
In Play Console, open the draft release, add release notes, and roll out to internal testers.

## After upload

1. Wait for Play processing (minutes to hours)
2. Check **Pre-launch report** for crashes on Google’s devices
3. Add yourself (or testers) on the internal testing track → install from the opt-in link
4. When ready, promote the same release to Production

## Notes

- Production profile builds an **app bundle** (`.aab`), not an APK
- Preview profile can build an APK for sideload smoke tests if needed
- Keep `google-play-*.json` service account keys out of git (already covered by common `*.json` secret patterns — prefer Expo-managed credentials)
