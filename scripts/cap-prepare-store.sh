#!/bin/bash
# Prepare the app for app store submission
# This script builds the web app, syncs with Capacitor, and prepares app store assets

# Make sure the script fails if any command fails
set -e

# Step 1: Build the web app
echo "Building web app for production..."
npm run build

# Step 2: Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync

# Step 3: Update Android app
echo "Updating Android app settings..."
cd android
# Set versionCode and versionName in build.gradle
# This would typically be done with a regex or sed command
# Example: sed -i 's/versionCode [0-9]*/versionCode 2/' app/build.gradle
cd ..

# Step 4: Update iOS app
echo "Updating iOS app settings..."
cd ios/App
# Update build number and version in project settings
# This would typically be done with agvtool or similar
cd ../..

# Step 5: Run Android build
echo "Building Android app (release mode)..."
cd android
./gradlew assembleRelease
cd ..

# Step 6: Provide instructions for iOS build
echo ""
echo "=== INSTRUCTIONS FOR iOS BUILD ==="
echo "iOS builds must be performed using Xcode:"
echo "1. Open the iOS project in Xcode: npx cap open ios"
echo "2. Select 'Generic iOS Device' as the build target"
echo "3. Select Product > Archive from the menu"
echo "4. Follow the steps in the Organizer window to distribute your app"
echo "==============================="

echo ""
echo "Android build completed successfully!"
echo "APK location: android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "Don't forget to sign your APK with your keystore before uploading to Google Play Store."