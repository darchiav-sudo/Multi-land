#!/bin/bash
# Build the web app and sync with Capacitor

# Make sure the script fails if any command fails
set -e

echo "Building web app..."
npm run build

echo "Syncing with Capacitor..."
npx cap sync

echo "Capacitor sync completed successfully!"