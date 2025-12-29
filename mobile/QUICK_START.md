# Quick Start - Run on Your Phone

## Step 1: Make Sure Backend is Running

The backend needs to be running on port 8000. Start it if it's not running:

```bash
cd backend
# Your usual backend start command (e.g., uvicorn app.main:app --reload)
```

## Step 2: Start Expo Dev Server

### Option A: Using VS Code
1. Press F5 or go to Run and Debug
2. Select "Expo: Start Dev Server"
3. Wait for QR code to appear

### Option B: Using Terminal
```bash
cd mobile
npx expo start
```

## Step 3: Connect Your Phone

1. **Install Expo Go** app on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Make sure your phone and computer are on the same WiFi network**

3. **Scan the QR code**:
   - **iOS**: Open Camera app and scan the QR code
   - **Android**: Open Expo Go app and tap "Scan QR code"

## Step 4: App Should Load

The app will load on your phone and connect to the backend at `http://172.20.10.8:8000`

## Troubleshooting

### Can't connect to backend
- Make sure backend is running on port 8000
- Check that your phone and computer are on the same WiFi
- Verify the IP address in `mobile/app.json` matches your computer's IP

### Can't scan QR code
- Try tunnel mode: `npx expo start --tunnel`
- Or manually enter the URL shown in the terminal

### API connection errors
- Check backend CORS settings allow your phone's IP
- Verify backend is accessible: Open `http://172.20.10.8:8000` in your phone's browser

