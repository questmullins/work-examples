/*
  Demo Barcode panel: draws a UPC-A symbol in Illustrator. ExtendScript (ES3).

  The panel (index.html) validates the number, works out the check digit and the 95-module bar pattern,
  then calls demoBarcode(). Everything here is geometry, in points, from the GS1 nominal UPC-A sizes:
  X (one module) 0.33 mm, bar height 22.85 mm, guard bars 5 modules longer, quiet zones 9 modules.

  digits         the 12 digits, check digit included
  modules        95 characters, "1" = bar, "0" = space
  magPercent     100 = nominal size
  bwrInches      bar width reduction: every bar is made this much narrower, spaces grow to match
  heightPercent  100 = full bar height; lower values truncate the bars
  showDigits     human-readable digits under the bars
  outlineDigits  convert those digits to outlines
  whiteBox       white rectangle behind the symbol, quiet zones included

  Returns "OK|message" or "ERR|message".
*/
function demoBarcode(digits, modules, magPercent, bwrInches, heightPercent, showDigits, outlineDigits, whiteBox) {
  try {
    var MM = 2.834645669;
    var mag = magPercent / 100;
    var X = 0.33 * MM * mag;
    var bwr = bwrInches * 72;
    if (bwr < 0 || bwr >= X) return "ERR|The bar width reduction has to be smaller than one bar (" + (X / 72).toFixed(4) + " in at this size).";
    var barHeight = 22.85 * MM * mag * (heightPercent / 100);
    var guardExtra = 5 * X;
    var digitDrop = 3.06 * MM * mag;          // bars' bottom edge to the digits' baseline
    var digitSize = 2.75 * MM * mag / 0.69;   // gives digits about 2.75 mm tall at 100%
    var quiet = 9 * X;

    var doc = app.documents.length ? app.activeDocument : app.documents.add(DocumentColorSpace.CMYK);
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    var layer = doc.activeLayer;
    if (layer.locked || !layer.visible) {
      layer = doc.layers.add();
      layer.name = "BARCODE";
    }

    var black = new CMYKColor();
    black.cyan = 0; black.magenta = 0; black.yellow = 0; black.black = 100;
    var white = new CMYKColor();
    white.cyan = 0; white.magenta = 0; white.yellow = 0; white.black = 0;

    var group = layer.groupItems.add();
    group.name = "UPC-A " + digits;

    var box = function (left, top, width, height, color, name) {
      var item = group.pathItems.rectangle(top, left, width, height);
      item.stroked = false;
      item.filled = true;
      item.fillColor = color;
      if (name) item.name = name;
      return item;
    };
    // Start, middle and end guards, plus the first and last digit, run 5 modules longer than the rest.
    var isLong = function (index) {
      return index < 10 || (index >= 45 && index < 50) || index >= 85;
    };

    // One rectangle per bar: neighbouring dark modules are merged, then narrowed by the reduction.
    var bars = 0, i = 0;
    while (i < modules.length) {
      if (modules.charAt(i) !== "1") { i++; continue; }
      var start = i, tall = isLong(i);
      while (i < modules.length && modules.charAt(i) === "1" && isLong(i) === tall) i++;
      box(start * X + bwr / 2, 0, (i - start) * X - bwr, barHeight + (tall ? guardExtra : 0), black);
      bars++;
    }

    var note = "";
    if (showDigits) {
      var font = barcodeFont();
      if (!font.company) note = " Demo Grotesk Book isn't installed, so the digits are set in " + font.font.name + ".";
      var baseline = -(barHeight + digitDrop);
      var frames = [];
      var digit = function (character, centerX, size) {
        var frame = group.textFrames.pointText([centerX, baseline]);
        frame.contents = character;
        frame.textRange.characterAttributes.textFont = font.font;
        frame.textRange.characterAttributes.size = size;
        frame.textRange.characterAttributes.fillColor = black;
        frame.textRange.characterAttributes.stroked = false;
        frame.paragraphs[0].paragraphAttributes.justification = Justification.CENTER;
        frames.push(frame);
      };
      digit(digits.charAt(0), -5 * X, digitSize * 0.8);
      for (var d = 1; d <= 5; d++) digit(digits.charAt(d), (3 + 7 * d + 3.5) * X, digitSize);
      for (var e = 6; e <= 10; e++) digit(digits.charAt(e), (50 + 7 * (e - 6) + 3.5) * X, digitSize);
      digit(digits.charAt(11), 100 * X, digitSize * 0.8);
      if (outlineDigits) for (var f = 0; f < frames.length; f++) frames[f].createOutline();
    }

    if (whiteBox) {
      var bottom = barHeight + (showDigits ? digitDrop + X : guardExtra + X);
      var back = box(-quiet, X, 95 * X + 2 * quiet, bottom + X, white, "WHITE BOX");
      back.zOrder(ZOrderMethod.SENDTOBACK);
    }

    // Centre it in the window, and leave it selected so it can be dragged into place.
    var view = doc.views[0].centerPoint, bounds = group.geometricBounds;
    group.translate(view[0] - (bounds[0] + bounds[2]) / 2, view[1] - (bounds[1] + bounds[3]) / 2);
    try { doc.selection = null; group.selected = true; } catch (ignoredSelection) {}

    return "OK|UPC-A " + digits + " added (" + bars + " bars, 100% K)." + note;
  } catch (error) {
    return "ERR|" + error.message + (error.line ? " (line " + error.line + ")" : "");
  }
}

// The digits are set in the company face, Demo Grotesk Book (the trial files count; they contain all ten digits).
// Falls back to Arial when it isn't installed, and the panel says so.
function barcodeFont() {
  var names = ["DemoGrotesk-Book", "DemoGrotesk-Book"];
  for (var n = 0; n < names.length; n++) {
    try { return { font: app.textFonts.getByName(names[n]), company: true }; } catch (ignoredName) {}
  }
  var fallbacks = ["ArialMT", "Helvetica", "MyriadPro-Regular"];
  for (var b = 0; b < fallbacks.length; b++) {
    try { return { font: app.textFonts.getByName(fallbacks[b]), company: false }; } catch (ignoredFallback) {}
  }
  return { font: app.textFonts[0], company: false };
}
