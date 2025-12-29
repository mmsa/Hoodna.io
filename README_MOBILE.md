# Mobile App Setup

## Overview

A React Native mobile app has been added to the Hoodna.io repository. The app uses:
- Expo (React Native framework)
- NativeWind (Tailwind CSS for React Native)
- React Navigation (via Expo Router)
- TypeScript
- Shared package for types and API client

## Structure

```
/mobile                    # Expo React Native app
/packages/shared           # Shared Zod schemas and API client
```

## Backend Changes

The backend has been extended with:
1. **Phone Authentication**:
   - `POST /api/auth/start` - Start phone auth (sends OTP)
   - `POST /api/auth/verify` - Verify OTP and get tokens

2. **Enhanced User Endpoint**:
   - `GET /api/auth/me` - Now includes verification status and permissions

3. **Public Read Endpoints**:
   - `GET /api/posts` - Public read (compound_id required)
   - `GET /api/listings` - Public read (auth required for compound scope)

4. **General Upload Endpoint**:
   - `POST /api/uploads/presign` - Get presigned URL for file uploads

## Mobile App Features

### Authentication Flow
1. Splash screen → Phone login → OTP verification → Compound selection → Main app

### Main Tabs
- **Home**: Community feed (read-only for unverified users)
- **Market**: Marketplace listings
- **Search**: Search functionality (placeholder)
- **Profile**: User profile and verification status

### Verification Gating
- **UNVERIFIED**: Read-only access, verification banner shown
- **PENDING**: Read-only access, pending status banner
- **APPROVED**: Full access (can post, comment, create listings)

## Setup Instructions

### 1. Install Mobile Dependencies

```bash
cd mobile
npm install
```

### 2. Install Shared Package Dependencies

```bash
cd packages/shared
npm install
npm run build
```

### 3. Configure API URL

Update `mobile/contexts/AuthContext.tsx` to set the correct API base URL, or use environment variables via `expo-constants`.

### 4. Run the Mobile App

```bash
cd mobile
npm start
```

Then press `i` for iOS simulator or `a` for Android emulator.

## Design System

Colors:
- Primary: `#2D6A4F`
- Background: `#F9F7F2`
- Accent: `#FFB400`
- Success: `#4BB543`
- Error: `#E63946`

Typography:
- Inter (English)
- Cairo (Arabic - RTL ready)

Spacing: 4px base unit (8/16/24/32)
Border Radius: 24px (cards), 12px (buttons)

## Notes

- The mobile app uses the shared package for type safety and API client
- OTP is currently returned in dev mode (for testing)
- Fonts need to be added to `mobile/assets/fonts/`
- RTL support is configured but set to LTR by default

