# Multi Land App Store Submission Guide

This document provides guidance for submitting the Multi Land app to the Google Play Store and Apple App Store.

## Prerequisites

Before starting the submission process, ensure you have:

1. An Apple Developer account ($99/year) for iOS submissions
2. A Google Play Developer account ($25 one-time fee) for Android submissions
3. App store assets (icons, screenshots, promotional images)
4. App privacy policy (hosted online)
5. App description and metadata

## Building for App Stores

### Step 1: Prepare the Environment

Ensure you have the following installed:
- Node.js and npm
- Android Studio for Android builds
- Xcode (on macOS) for iOS builds
- Capacitor CLI (`npm install -g @capacitor/cli`)

### Step 2: Configure App Details

1. Update the `capacitor.config.ts` file:
   - Verify the `appId` is set correctly (e.g., "com.multiland.app")
   - Ensure the `appName` is set to "Multi Land"
   - Check other settings like SplashScreen and StatusBar

2. Update app version:
   - For Android: in `android/app/build.gradle`
   - For iOS: in Xcode project settings

### Step 3: Build and Prepare the App

Run the prepare script to build the app for both platforms:

```bash
./scripts/cap-prepare-store.sh
```

This script:
- Builds the web app
- Syncs with Capacitor
- Prepares Android build
- Provides instructions for iOS build

### Step 4: Google Play Store Submission

1. Sign your APK:
   ```bash
   jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore your-keystore.keystore android/app/build/outputs/apk/release/app-release-unsigned.apk your-alias
   ```

2. Optimize the APK:
   ```bash
   zipalign -v 4 android/app/build/outputs/apk/release/app-release-unsigned.apk android/app/build/outputs/apk/release/multiland.apk
   ```

3. Login to Google Play Console: https://play.google.com/console/

4. Create a new application:
   - Fill in app details, store listing information
   - Upload APK to either production, beta, or internal testing track
   - Complete content rating questionnaire
   - Set up pricing and distribution
   - Submit for review

### Step 5: Apple App Store Submission

1. Open the iOS project in Xcode:
   ```bash
   npx cap open ios
   ```

2. Configure signing and capabilities:
   - Select the project in Xcode
   - Go to "Signing & Capabilities"
   - Select your team and provisioning profile

3. Create an archive:
   - Select "Generic iOS Device" as the build target
   - Select Product > Archive from the menu

4. Submit through the Organizer:
   - Once the archive completes, Xcode Organizer will open
   - Click "Distribute App"
   - Follow the wizard to submit to the App Store

5. Complete App Store Connect setup:
   - Login to App Store Connect: https://appstoreconnect.apple.com/
   - Verify app metadata, screenshots, privacy policy
   - Complete Export Compliance information
   - Submit for review

## App Store Review Guidelines

### Google Play Store

Keep in mind Google Play's core requirements:
- Apps must not contain deceptive or disruptive ads
- Apps must handle user data securely
- Apps must be appropriate for their target audience
- Apps should not crash or contain obvious bugs

Full guidelines: https://play.google.com/about/developer-content-policy/

### Apple App Store

Apple's review guidelines are more strict:
- All purchases must use Apple's in-app purchase system
- Apps must have privacy policies and request permission for data collection
- Apps must be complete and fully functional
- Apps must have value beyond basic functionality

Full guidelines: https://developer.apple.com/app-store/review/guidelines/

## Maintenance

After your app is published:
- Plan for regular updates to fix bugs and add features
- Monitor user reviews and address issues
- Keep your certificates and provisioning profiles up to date
- Test thoroughly before submitting updates

## Troubleshooting

Common issues:
1. **Rejection due to crashes**: Thoroughly test on real devices before submission
2. **Metadata rejection**: Ensure screenshots match your app and descriptions are accurate
3. **In-app purchase issues**: Verify implementations follow platform guidelines
4. **Privacy concerns**: Make sure your privacy policy is comprehensive and accurate

For specific Capacitor issues, consult the [Capacitor documentation](https://capacitorjs.com/docs).