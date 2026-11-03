#!/bin/bash
# Removes the Demo Barcode panel for the current Mac user.
rm -rf "$HOME/Library/Application Support/Adobe/CEP/extensions/com.demopkg.barcode"
echo "The Demo Barcode panel was removed. Restart Illustrator."
echo "(The setting that lets Illustrator load unsigned panels was left on, in case another panel needs it.)"
