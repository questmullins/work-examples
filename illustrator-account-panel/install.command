#!/bin/bash
# Installs the Demo Account panel for the current Mac user. Run it again to update.
# If double-clicking is blocked, open Terminal, type "bash " (with the space), drag this file in, and press Return.
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.demopkg.account"

echo "Installing the Demo Account panel for Illustrator..."
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/CSXS" "$DEST/"
cp "$SRC/index.html" "$SRC/account_panel.js" "$SRC/demo_account.js" "$SRC/demo_gate.js" "$SRC/demo_panel.css" "$SRC/.debug" "$DEST/"
if [ ! -f "$DEST/CSXS/manifest.xml" ]; then
  echo "Something went wrong: the files were not copied to $DEST"
  exit 1
fi

# The panel is not signed by Adobe, so Illustrator only loads it with this per-user setting turned on.
for V in 9 10 11 12 13; do defaults write "com.adobe.CSXS.$V" PlayerDebugMode 1; done
killall cfprefsd 2>/dev/null

echo
echo "Done. Quit and reopen Illustrator, then choose"
echo "  Window > Extensions (Legacy) > Demo Account"
echo "Then paste your Quickbase token there once. It unlocks every Demo panel."
