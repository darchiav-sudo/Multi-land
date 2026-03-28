# Multi Land App Icon Guide

This guide explains the app icon requirements for Multi Land mobile submissions and how to create compliant icons for both Android and iOS platforms.

## Icon Types & Purposes

Multi Land uses two main types of app icons:

1. **Standard Icons** - Regular app icons with transparency/padding allowed
2. **Maskable Icons** - Icons that can be safely cropped to different shapes by the OS

## Icon Sizes Required

### Android Requirements

| Size | Purpose | Type |
|------|---------|------|
| 48x48 | Small launcher icon | Both standard & maskable |
| 72x72 | Medium launcher icon | Both standard & maskable |
| 96x96 | Medium-large launcher icon | Both standard & maskable |
| 144x144 | Large launcher icon | Both standard & maskable |
| 192x192 | Extra-large launcher icon | Both standard & maskable |
| 512x512 | Play Store listing | Both standard & maskable |
| 1024x1024 | Marketing | Standard only (usually) |

### iOS Requirements

| Size | Purpose | Type |
|------|---------|------|
| 120x120 | iPhone home screen | Standard only |
| 152x152 | iPad home screen | Standard only |
| 167x167 | iPad Pro home screen | Standard only |
| 180x180 | iPhone Plus/X home screen | Standard only |
| 1024x1024 | App Store listing | Standard only |

## Maskable Icon Safe Zone

When creating maskable icons:

1. Keep all important visual elements within the central 80% safe zone
2. The outer 20% may be cropped by the OS into circles, squircles, rounded squares, etc.
3. Background color should extend to the edges (no transparency)

![Maskable Icon Safe Zone](https://web.dev/articles/maskable-icon/safe-zone.png)

## SVG Icons for Multi Land

For Multi Land, we use SVG icons for better scaling. The following icons are included:

### Standard Icons (with padding)
- `/icons/icon-48.svg` - Small Android icon
- `/icons/icon-192.svg` - Medium Android/iOS icon
- `/icons/icon-512.svg` - Large Android icon
- `/icons/icon-1024.svg` - App Store submission

### Maskable Icons (full bleed)
- `/icons/maskable-icon-48.svg` - Small Android icon
- `/icons/maskable-icon-192.svg` - Medium Android icon
- `/icons/maskable-icon-512.svg` - Large Android icon
- `/icons/maskable-icon-1024.svg` - Extra Large (optional)

## How to Create Additional Sizes

If you need additional icon sizes:

1. Use Inkscape, Adobe Illustrator or other vector editing tools to open the SVG files
2. Resize to the needed dimensions (the benefit of SVG is perfect scaling)
3. Export to the required format (SVG, PNG)
4. For PNG exports, use high quality settings (no compression)

## Manifest.json Configuration

The `manifest.json` file should reference all icon sizes and types:

```json
"icons": [
  {
    "src": "/icons/icon-48.svg",
    "sizes": "48x48",
    "type": "image/svg+xml",
    "purpose": "any"
  },
  {
    "src": "/icons/maskable-icon-48.svg",
    "sizes": "48x48",
    "type": "image/svg+xml",
    "purpose": "maskable"
  },
  // ... additional sizes ...
]
```

## Converting SVG to PNG (if needed)

Some app store submission processes may require PNG format. To convert:

1. Use online tools like [SVGOMG](https://jakearchibald.github.io/svgomg/) to optimize SVGs
2. Convert to PNG using:
   - Inkscape: File > Export PNG Image
   - Adobe Illustrator: File > Export > Export As... > PNG
   - Command line: `svgexport icon.svg icon.png 1024:1024`

## Pre-submission Checklist

Before submitting to app stores:

1. Verify all icon sizes are available
2. Confirm maskable icons have content properly contained in the safe zone
3. Test icons on different devices and backgrounds
4. Ensure icon files are properly referenced in the manifest.json
5. Verify app screenshots include the icon in context

## Resources

- [Maskable.app Editor](https://maskable.app/editor) - Test maskable icons
- [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator) - Generate app icons
- [Android Icon Guidelines](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [iOS Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)