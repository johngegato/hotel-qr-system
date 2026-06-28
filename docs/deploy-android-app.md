# Deploy Front Desk Android App

## Prerequisites

### Install Node.js and Dependencies
1. Make sure Node.js is installed on your computer
2. Install Expo CLI (if not already installed):
   ```bash
   npm install -g expo-cli
   ```

### Update SERVER_URL
Before building, update the server URL in `apps/front-desk-android/App.js` (line 24):
```javascript
const SERVER_URL = 'https://artistic-possibility-production.up.railway.app';
```

## Option 1: Expo Go (Easiest - No APK Build)

### Requirements
- Android phone with "Expo Go" app installed (from Play Store)
- Computer with Node.js installed

### Steps
1. Navigate to the app directory:
   ```bash
   cd apps/front-desk-android
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. On your Android phone:
   - Install "Expo Go" from Google Play Store
   - Open Expo Go
   - Scan the QR code shown in your terminal or browser

5. The app will load directly on your phone

**Note:** This requires your phone and computer to be on the same WiFi network. For production, you'll need to build an APK.

## Option 2: Build APK (For Production Use)

### Requirements
- Node.js installed
- Java Development Kit (JDK) 17 or later
- Android SDK or Android Studio

### Steps

1. Navigate to the app directory:
   ```bash
   cd apps/front-desk-android
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the APK:
   ```bash
   npx expo run:android --variant release
   ```
   
   Or if using React Native CLI:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. Find the APK in the output directory (usually `android/app/build/outputs/apk/release/`)

5. Transfer the APK to your Android phone:
   - Via USB cable
   - Via Google Drive/Dropbox
   - Via email attachment

6. On your Android phone:
   - Enable "Install from Unknown Sources" in Settings → Security
   - Open the APK file and install it

## Option 3: EAS Build (Expo Application Services - Recommended)

### Requirements
- Expo account (free tier available)
- EAS CLI installed: `npm install -g eas-cli`

### Steps

1. Login to Expo:
   ```bash
   eas login
   ```

2. Configure EAS Build:
   ```bash
   cd apps/front-desk-android
   eas build:configure
   ```

3. Build for Android:
   ```bash
   eas build --platform android --profile preview
   ```

4. Wait for the build to complete (5-10 minutes)

5. Download the APK from the Expo dashboard or install directly to your device:
   ```bash
   eas build:run --platform android
   ```

## Option 4: Google Play Store (For Production)

### Requirements
- Google Play Developer account ($25 one-time fee)
- Signed release bundle

### Steps

1. Build Android App Bundle:
   ```bash
   eas build --platform android --profile production
   ```

2. Upload to Google Play Console
3. Fill in app details, screenshots, etc.
4. Submit for review

## Testing the App

1. **Open the app** on your Android phone
2. **You should see "Front Desk"** with "Available" status
3. **When a guest calls** from the test page, you'll see an incoming call screen
4. **Tap "Answer"** to connect the call
5. **Tap "End Call"** to disconnect

## Troubleshooting

### "Cannot connect to server"
- Verify SERVER_URL in App.js matches your Railway URL
- Make sure Railway server is running (check `/health` endpoint)

### "WebRTC not working"
- Make sure you're using HTTPS for the server URL
- Some Android browsers block WebRTC on HTTP connections

### "App crashes on start"
- Check that all dependencies are installed: `npm install`
- Try clearing cache: `npx expo start -c`

### "Expo Go won't connect"
- Make sure phone and computer are on the same WiFi network
- Try using "Tunnel" connection type: `npx expo start --tunnel`