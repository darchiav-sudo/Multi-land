#!/bin/bash
# Open Xcode with the Capacitor project

# Make sure the script fails if any command fails
set -e

echo "Opening Xcode..."
npx cap open ios

echo "Xcode should now be open with your project."