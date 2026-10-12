#!/usr/bin/env bash
# Build ekstensi -> extension/dist siap Load unpacked di chrome://extensions.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
npx tsc -p tsconfig.json

# File statis (HTML/CSS/manifest) mengikuti struktur src/ -> dist/
mkdir -p dist/popup dist/offscreen dist/content
cp manifest.json dist/
cp src/popup/popup.html src/popup/popup.css dist/popup/
cp src/offscreen/offscreen.html dist/offscreen/
cp assets/icon.svg dist/ 2>/dev/null || true

echo "OK -> extension/dist"
ls dist dist/popup dist/offscreen dist/background dist/content
