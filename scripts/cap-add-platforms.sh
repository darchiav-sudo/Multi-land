#!/bin/bash
# Add Android and iOS platforms to Capacitor

# Make sure the script fails if any command fails
set -e

echo "Adding Android platform..."
npx cap add android

echo "Adding iOS platform..."
npx cap add ios

echo "Capacitor platforms added successfully!"