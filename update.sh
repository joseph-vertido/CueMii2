#!/bin/bash
# ============================================
# BADDIXX CueMii App - Update Script
# Downloads latest version from GitHub and
# replaces files in current directory
# ============================================

echo ""
echo "========================================"
echo "  BADDIXX CueMii App Updater"
echo "========================================"
echo ""

REPO_URL="https://github.com/joseph-vertido/CueMii/archive/refs/heads/main.zip"
TEMP_ZIP="/tmp/cuemii-update.zip"
TEMP_DIR="/tmp/cuemii-update"

echo "[1/5] Preparing update..."
rm -f "$TEMP_ZIP"
rm -rf "$TEMP_DIR"

echo "[2/5] Downloading latest version from GitHub..."
echo "      $REPO_URL"
echo ""

# Download using curl or wget
if command -v curl &> /dev/null; then
    curl -L -o "$TEMP_ZIP" "$REPO_URL"
elif command -v wget &> /dev/null; then
    wget -O "$TEMP_ZIP" "$REPO_URL"
else
    echo ""
    echo "ERROR: Neither curl nor wget found. Please install one of them."
    echo ""
    exit 1
fi

if [ ! -f "$TEMP_ZIP" ]; then
    echo ""
    echo "ERROR: Failed to download update. Please check your internet connection."
    echo ""
    exit 1
fi

echo "[3/5] Extracting files..."
mkdir -p "$TEMP_DIR"
unzip -q "$TEMP_ZIP" -d "$TEMP_DIR"

if [ ! -d "$TEMP_DIR/CueMii-main" ]; then
    echo ""
    echo "ERROR: Failed to extract update. The downloaded file may be corrupted."
    echo ""
    exit 1
fi

echo "[4/5] Updating files..."
# Copy all files from the extracted folder to current directory
cp -R "$TEMP_DIR/CueMii-main/"* .

echo "[5/5] Cleaning up..."
rm -f "$TEMP_ZIP"
rm -rf "$TEMP_DIR"

echo ""
echo "========================================"
echo "  Update Complete!"
echo "========================================"
echo ""
echo "Please run the following commands to finish:"
echo "  1. npm install"
echo "  2. npm start"
echo ""
