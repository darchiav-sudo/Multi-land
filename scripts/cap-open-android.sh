#!/bin/bash
# Open Android Studio with the Capacitor project

# Make sure the script fails if any command fails
set -e

echo "Opening Android Studio..."
npx cap open android

echo "Android Studio should now be open with your project."