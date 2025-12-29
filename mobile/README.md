# Hoodna Mobile App

React Native mobile app for Hoodna.io built with Expo, NativeWind, and React Navigation.

## Quick Start

### Using VS Code Debugger

1. **Start Dev Server**: Use the "Expo: Start Dev Server" configuration in VS Code launch.json
2. **Run on Device**: 
   - Scan the QR code with Expo Go app (iOS/Android)
   - Or use "Expo: Run on iOS" / "Expo: Run on Android" configurations

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
   - **iOS**: Press `i` in the terminal or run `npm run ios`
   - **Android**: Press `a` in the terminal or run `npm run android`
   - **Expo Go**: Scan the QR code with Expo Go app on your phone

## Running on Physical Device

### Option 1: Expo Go (Easiest)
1. Install Expo Go app on your phone (iOS App Store / Google Play)
2. Run `npm start` or use VS Code launch configuration
3. Scan the QR code with Expo Go app
4. Make sure your phone and computer are on the same WiFi network

### Option 2: Development Build
1. Run `npm run prebuild` to generate native code
2. Use `npm run ios` or `npm run android` to build and run
3. Or use VS Code launch configurations

### Option 3: Tunnel (For Different Networks)
1. Run `npm run start:tunnel` or use Expo tunnel mode
2. Scan QR code - works even if phone and computer are on different networks

## VS Code Launch Configurations

- **Expo: Start Dev Server** - Starts the Expo dev server
- **Expo: Run on iOS** - Builds and runs on iOS simulator/device
- **Expo: Run on Android** - Builds and runs on Android emulator/device
- **Expo: Attach to Packager** - Attaches debugger to running packager
- **Expo: Debug in Expo Go** - Debugs app running in Expo Go

## Configuration

### API URL
Update the API URL in:
- `app.json` → `extra.apiUrl` (for build-time)
- `contexts/AuthContext.tsx` (for runtime)

For physical device testing, use your computer's local IP address:
```json
"extra": {
  "apiUrl": "http://192.168.1.XXX:8000"
}
```

## Features

- Phone-based authentication with OTP
- Compound selection
- Community feed (read-only for unverified users)
- Marketplace listings
- Verification document upload
- RTL support (Arabic-ready)

## Design System

- Primary: #2D6A4F
- Background: #F9F7F2
- Accent: #FFB400
- Success: #4BB543
- Error: #E63946

## Troubleshooting

### Can't connect to dev server
- Make sure phone and computer are on same WiFi
- Try tunnel mode: `npm run start:tunnel`
- Check firewall settings

### Metro bundler issues
- Clear cache: `expo start -c`
- Delete `node_modules` and reinstall

### Build errors
- Run `expo prebuild` to regenerate native code
- Check that all dependencies are installed
