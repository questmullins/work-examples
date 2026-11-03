#!/bin/bash
# Removes the Demo Annotation panel for the current Mac user.
rm -rf "$HOME/Library/Application Support/Adobe/CEP/extensions/com.demopkg.annotation"
echo "The Demo Annotation panel was removed. Restart Illustrator."
echo "(The setting that lets Illustrator load unsigned panels was left on, in case another panel needs it.)"
