#!/bin/bash
# Removes the Demo Account panel and signs this computer out of every Demo panel for the current Mac user.
rm -rf "$HOME/Library/Application Support/Adobe/CEP/extensions/com.demopkg.account"
rm -rf "$HOME/Library/Application Support/Demo Packaging/account"
security delete-generic-password -a "$USER" -s "Demo Packaging Account" >/dev/null 2>&1
security delete-generic-password -a "$USER" -s "Demo Annotation Panel" >/dev/null 2>&1
echo "The Demo Account panel was removed, and this computer is signed out of the Demo panels. Restart Illustrator."
echo "(The setting that lets Illustrator load unsigned panels was left on, in case another panel needs it.)"
