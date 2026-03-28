# Android Icon Templates

This folder should contain icon images in different sizes for Android. You need two sets of icons:

## Standard Icons (purpose: "any")
- icon-48.png (48x48 pixels)
- icon-72.png (72x72 pixels)
- icon-96.png (96x96 pixels)
- icon-144.png (144x144 pixels)
- icon-192.png (192x192 pixels)
- icon-512.png (512x512 pixels)

## Maskable Icons (purpose: "maskable")
- maskable-icon-48.png (48x48 pixels)
- maskable-icon-72.png (72x72 pixels)
- maskable-icon-96.png (96x96 pixels)
- maskable-icon-144.png (144x144 pixels)
- maskable-icon-192.png (192x192 pixels)
- maskable-icon-512.png (512x512 pixels)

You can use the existing SVG icons from your project and convert them to these sizes.

## Difference Between Standard and Maskable Icons

- **Standard Icons**: Traditional app icons with some padding around the logo and possible transparency.
- **Maskable Icons**: Icons where the important content is in the center "safe zone" (80% of the image) and the background extends to the edges with no transparency. These can be safely cropped into different shapes by the device.

## Instructions for creating Android icons

1. Start with your high-resolution icon (preferably the SVG version)
2. Create both standard and maskable PNG versions in each required size
3. Place them in this folder
4. Make sure they follow Android icon guidelines:
   - Adaptive icon format is recommended (foreground and background layers)
   - Material Design principles
   - Square with rounded corners
   - No transparency for the Play Store icon
   
You can use online tools like:
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) for standard icons
- [Maskable.app Editor](https://maskable.app/editor) for maskable icons

See the main `app-packages/icons-guide.md` for more detailed instructions on creating both icon types.