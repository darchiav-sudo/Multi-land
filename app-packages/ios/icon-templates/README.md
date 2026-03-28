# iOS Icon Templates

This folder should contain icon images in different sizes for iOS. For a complete PWA, you need both standard and maskable icon sets, though iOS itself uses standard icons for display.

## Standard Icons (iOS Default)

- icon-20.png (20x20 pixels)
- icon-29.png (29x29 pixels)
- icon-40.png (40x40 pixels)
- icon-60.png (60x60 pixels)
- icon-76.png (76x76 pixels)
- icon-83.5.png (83.5x83.5 pixels)
- icon-1024.png (1024x1024 pixels - App Store icon)

You'll also need to create @2x and @3x versions of these icons for different screen densities:

- icon-20@2x.png (40x40 pixels)
- icon-20@3x.png (60x60 pixels)
- icon-29@2x.png (58x58 pixels)
- icon-29@3x.png (87x87 pixels)
- icon-40@2x.png (80x80 pixels)
- icon-40@3x.png (120x120 pixels)
- icon-60@2x.png (120x120 pixels)
- icon-60@3x.png (180x180 pixels)
- icon-76@2x.png (152x152 pixels)
- icon-83.5@2x.png (167x167 pixels)

## Maskable Icons (for PWA)

While iOS doesn't use maskable icons directly, you should also create a set of maskable icons for your web manifest to ensure your PWA works well across all platforms:

- maskable-icon-192.png (192x192 pixels)
- maskable-icon-512.png (512x512 pixels)

## Difference Between Standard and Maskable Icons

- **Standard Icons**: Traditional app icons with some padding around the logo and possible transparency.
- **Maskable Icons**: Icons where the important content is in the center "safe zone" (80% of the image) and the background extends to the edges with no transparency. These can be safely cropped into different shapes by devices.

## Instructions for creating iOS icons

1. Start with your high-resolution icon (preferably the SVG version)
2. Create PNG versions in each required size
3. Place them in this folder
4. Make sure they follow iOS icon guidelines:
   - Square shape with rounded corners (iOS will automatically apply the rounded corners)
   - No transparency
   - No alpha channel
   - sRGB color space
   - No shadows or borders

You can use online tools like:
- [AppIcon Generator](https://appicon.co/) or [MakeAppIcon](https://makeappicon.com/) for standard iOS icons
- [Maskable.app Editor](https://maskable.app/editor) for maskable PWA icons

## App Store Requirements

For the App Store submission, the icon-1024.png file is especially important:
- Must be exactly 1024x1024 pixels
- Must have a square aspect ratio (no rounded corners)
- Must have no alpha transparency
- Must be in the sRGB color space
- Must be less than 8MB in size
- PNG format

These icons will be used by PWA Builder when generating your iOS app package.

See the main `app-packages/icons-guide.md` for more detailed instructions on creating both icon types.