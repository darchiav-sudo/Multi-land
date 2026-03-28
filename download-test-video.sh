#!/bin/bash

# Create content files directory if it doesn't exist
mkdir -p uploads/content-files

# The video URL is a public domain mp4 from archive.org
VIDEO_URL="https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4"
OUTPUT_FILE="uploads/content-files/content-1744050896708-353731143.mp4"

# Download only the first 5MB to make it faster (for testing purposes)
# curl -L "$VIDEO_URL" | head -c 5242880 > "$OUTPUT_FILE"
# Better approach: Use curl's range option to get a specific part of the file
curl -L --range 0-5242880 "$VIDEO_URL" -o "$OUTPUT_FILE"

# Print success message
echo "Downloaded test video to $OUTPUT_FILE (first 5MB of original video)"
echo "File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "You can now test video playback with /direct-video/content-1744050896708-353731143.mp4"