#target illustrator

/*
  Demo Packaging Quickbase annotation renderer.
  QUICKBASE PAGE 159 MASTER TEMPLATE - do not run this file directly.
  VARIANT B (captions shrink to fit), chosen from the A/B test. Used by the Annotation Generator, page 158.
  Build: 2026-10-01 / 15px visible-edge artboard / centered 2-line captions / pure CMYK process chips.
  The HTML builder replaces the marker below with one record's JSON data.
*/
(function () {
  var DATA = /*__ANNOTATION_DATA_JSON__*/null;
  if (!DATA) {
    alert("This is the JSX template. Download a populated JSX from the Annotation Builder first.");
    return;
  }

  var W = 495.9251;
  var H = 677.0901;
  var ARTBOARD_PADDING = 15;
  var ACTIVE_TAG_PREFIX = "";

  // Demo Grotesk is used when it is installed; otherwise Arial, and the final message says so.
  // The trial files ("DemoGrotesk-...") only contain letters, digits, space and period, so in
  // those every other character (: # & / - and so on) is set in Arial to avoid gaps.
  var missingFonts = [];
  function getFont(names) {
    for (var i = 0; i < names.length; i++) {
      try {
        var found = app.textFonts.getByName(names[i]);
        if (i > 0 && !/DemoGrotesk/i.test(names[i])) noteMissingFont(names[0]);  // the trial counts as installed
        return found;
      } catch (ignoredFont) {}
    }
    noteMissingFont(names[0]);
    return app.textFonts.getByName("ArialMT");
  }
  function noteMissingFont(name) {
    for (var m = 0; m < missingFonts.length; m++) if (missingFonts[m] === name) return;
    missingFonts.push(name);
  }

  function cmyk(values) {
    var color = new CMYKColor();
    color.cyan = values[0]; color.magenta = values[1]; color.yellow = values[2]; color.black = values[3];
    return color;
  }

  function rgb(hex) {
    var value = String(hex || "#FFFFFF").replace("#", "");
    if (!/^[0-9A-Fa-f]{6}$/.test(value)) value = "FFFFFF";
    var color = new RGBColor();
    color.red = parseInt(value.substr(0, 2), 16);
    color.green = parseInt(value.substr(2, 2), 16);
    color.blue = parseInt(value.substr(4, 2), 16);
    return color;
  }

  function tag(item, code) {
    if (!code) return item;
    var fullCode = ACTIVE_TAG_PREFIX + code;
    item.name = "TAG." + fullCode;
    item.note = "{{" + fullCode + "}}";
    return item;
  }

  function text(layer, value, x, y, size, font, color, code) {
    var frame = layer.textFrames.pointText([x, y]);
    frame.contents = String(value == null ? "" : value);
    frame.textRange.characterAttributes.textFont = font;
    frame.textRange.characterAttributes.size = size;
    frame.textRange.characterAttributes.fillColor = color;
    fillMissingGlyphs(frame, font);
    return tag(frame, code);
  }

  var TRIAL_SAFE = /[A-Za-z0-9 .]/;
  function fillMissingGlyphs(frame, font) {
    if (!/TRIAL/i.test(font.name || "")) return;
    var fallback = font === bold ? boldFallback : bookFallback;
    var value = frame.contents, chars = null;
    for (var c = 0; c < value.length; c++) {
      if (TRIAL_SAFE.test(value.charAt(c)) || /[\r\n]/.test(value.charAt(c))) continue;
      if (!chars) chars = frame.textRange.characters;
      chars[c].characterAttributes.textFont = fallback;
    }
  }

  function areaText(layer, value, left, top, width, height, size, leading, font, color, code, justification) {
    var path = layer.pathItems.rectangle(top, left, width, height);
    path.stroked = false;
    path.filled = false;
    var frame = layer.textFrames.areaText(path);
    frame.contents = String(value == null ? "" : value);
    frame.textRange.characterAttributes.textFont = font;
    frame.textRange.characterAttributes.size = size;
    frame.textRange.characterAttributes.fillColor = color;
    frame.textRange.paragraphAttributes.leading = leading;
    if (justification != null) frame.textRange.paragraphAttributes.justification = justification;
    fillMissingGlyphs(frame, font);
    return tag(frame, code);
  }

  function centeredText(layer, value, x, y, size, font, color, code) {
    var frame = text(layer, value, x, y, size, font, color, code);
    frame.textRange.paragraphAttributes.justification = Justification.CENTER;
    return frame;
  }

  function rect(layer, left, top, width, height, fill, stroke, strokeWidth, code) {
    var item = layer.pathItems.rectangle(top, left, width, height);
    item.filled = !!fill;
    if (fill) item.fillColor = fill;
    item.stroked = !!stroke;
    if (stroke) item.strokeColor = stroke;
    item.strokeWidth = strokeWidth || 0.8;
    return tag(item, code);
  }

  function line(layer, x1, y1, x2, y2, color, width) {
    var item = layer.pathItems.add();
    item.setEntirePath([[x1, y1], [x2, y2]]);
    item.filled = false;
    item.stroked = true;
    item.strokeColor = color;
    item.strokeWidth = width || 1;
    return item;
  }

  function cleanFilePart(value) {
    return String(value || "annotation").replace(/[\\\/:*?\"<>|]/g, "-").replace(/^\s+|\s+$/g, "") || "annotation";
  }

  // The fill for one cylinder chip.
  // - item.cmyk: exact process values (C, M, Y, K are 100% of one plate, not a 4-color mix).
  // - item.spotName: a named spot swatch is added to the Swatches panel.
  // - item.noFill (MATTE): the chip is left with no fill. If it also has a spotName, the
  //   swatch is still added to the panel so prepress has it, but it is not applied.
  function spotFill(doc, item, fallback) {
    var name = String(item.spotName || "").replace(/^\s+|\s+$/g, "");
    var base = item.cmyk && item.cmyk.length === 4 ? cmyk(item.cmyk) : rgb(item.hex || fallback || "#FFFFFF");
    if (!name) return item.noFill ? null : base;
    var spot;
    try {
      spot = doc.spots.getByName(name);
    } catch (missingSpot) {
      spot = doc.spots.add();
      spot.name = name;
      spot.colorType = ColorModel.SPOT;
      spot.color = base;
    }
    if (item.noFill) return null;
    var color = new SpotColor();
    color.spot = spot;
    color.tint = 100;
    return color;
  }

  function taggedValue(layer, value, x, y, size, font, color, code) {
    return text(layer, value, x, y, size, font, color, code);
  }

  function nativeColor(data) {
    if (!data) return null;
    var color;
    if (data.type === "cmyk") {
      color = new CMYKColor();
      color.cyan = data.c; color.magenta = data.m; color.yellow = data.y; color.black = data.k;
      return color;
    }
    if (data.type === "rgb") {
      color = new RGBColor();
      color.red = data.r; color.green = data.g; color.blue = data.b;
      return color;
    }
    color = new GrayColor(); color.gray = data.g; return color;
  }

  function buildNativeLogoItem(parent, data, left, top) {
    var item;
    var i;
    if (data.type === "group") {
      item = parent.groupItems.add();
      for (i = 0; i < data.children.length; i++) buildNativeLogoItem(item, data.children[i], left, top);
      return item;
    }
    if (data.type === "compound") {
      item = parent.compoundPathItems.add();
      for (i = 0; i < data.children.length; i++) buildNativeLogoItem(item, data.children[i], left, top);
      return item;
    }
    item = parent.pathItems.add();
    var anchors = [];
    for (i = 0; i < data.points.length; i++) anchors.push([left + data.points[i].a[0], top + data.points[i].a[1]]);
    item.setEntirePath(anchors);
    item.closed = data.closed;
    for (i = 0; i < data.points.length; i++) {
      item.pathPoints[i].leftDirection = [left + data.points[i].l[0], top + data.points[i].l[1]];
      item.pathPoints[i].rightDirection = [left + data.points[i].r[0], top + data.points[i].r[1]];
      item.pathPoints[i].pointType = data.points[i].s ? PointType.SMOOTH : PointType.CORNER;
    }
    item.filled = data.filled;
    if (data.filled && data.fill) item.fillColor = nativeColor(data.fill);
    item.stroked = data.stroked;
    if (data.stroked && data.stroke) item.strokeColor = nativeColor(data.stroke);
    if (data.stroked) item.strokeWidth = data.strokeWidth;
    return item;
  }

  function placeDemoLogo(doc, layer, left, top) {
    var mark = layer.textFrames.add();
    mark.contents = "Demo Packaging";
    mark.position = [left, top];
    mark.textRange.characterAttributes.size = 14;
    return mark;
}
  // The Illustrator panel sets DATA.intoActiveDocument: the annotations go on a new layer in the document
  // that is open, beside its active artboard. Otherwise (or with nothing open) a new document is made.
  var INTO_OPEN = DATA.intoActiveDocument === true && app.documents.length > 0;
  var doc, rootLayer;
  if (INTO_OPEN) {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    doc = app.activeDocument;
    rootLayer = doc.layers.add();
  } else {
    doc = app.documents.add(DocumentColorSpace.CMYK, W, H);
    rootLayer = doc.layers[0];
  }
  rootLayer.name = "ANNOTATION VARIANTS - NATIVE VECTORS";
  var variantGroups = [];

  // Bold for labels and headings (BRAND:, DATE:, PRINT METHOD:, ITEM SPECIFICATIONS:, the cylinder
  // headings); Book for everything else.
  var bold = getFont(["DemoGrotesk-Bold", "DemoGrotesk-Bold", "Arial-BoldMT", "ArialMT"]);
  var book = getFont(["DemoGrotesk-Book", "DemoGrotesk-Book", "ArialMT"]);
  var medium = book;
  var thin = book;
  var blackFont = bold;   // swatch names, chip numbers and chip labels
  var boldFallback = getFont(["Arial-BoldMT", "ArialMT"]);
  var bookFallback = getFont(["ArialMT"]);
  // Pure K black and paper white, so text, borders and chip outlines print on the black plate only.
  var black = cmyk([0, 0, 0, 100]);
  var windowBlue = cmyk([25, 0, 0, 0]);
  var LABEL_GAP = 4;

  // Places a value just after its label (one space), whatever width the font gives the label.
  function valueAfter(layer, label, value, y, code) {
    return taggedValue(layer, value, label.geometricBounds[2] + LABEL_GAP, y, 13.8548, thin, black, code);
  }
  var white = cmyk([0, 0, 0, 0]);
  var gray = rgb("#4B4B4B");
  var navy = rgb("#003D5B");
  var red = rgb("#ED1C24");

  function drawPanel(variantGroup, variant, compact) {
  ACTIVE_TAG_PREFIX = "V" + variant + ".";
  var staticLayer = variantGroup.groupItems.add();
  staticLayer.name = "STATIC - DO NOT REPLACE";
  var taggedLayer = variantGroup.groupItems.add();
  taggedLayer.name = "REPLACEABLE - CODE TAGGED";
  var outerLeft = 13.3687;
  var outerTop = 599.2195;
  var outerRight = 1207.0894;
  var outerBottom = compact ? 129.1920 : 40.3058;
  var outerHeight = outerTop - outerBottom;
  var rightLeft = 364.8790;
  var leftWidth = rightLeft - outerLeft;
  var x = 396.5835;
  var rightEdge = 1194.8056;

  var panelBorder = rect(staticLayer, outerLeft, outerTop, outerRight - outerLeft, outerHeight, null, black, 0.8);
  panelBorder.name = "PANEL BORDER";
  line(staticLayer, rightLeft, outerTop, rightLeft, outerBottom, black, 0.8);

  var legalHeight = compact ? 321.3042 : 341.3042;
  var legalTextHeight = compact ? 288.3 : 308.3;
  rect(staticLayer, outerLeft, outerTop, leftWidth, legalHeight, black, null, 0);
  var LEGAL_DROP = 8.5;   // the legal heading and paragraph sit half a line (half of 17 pt) lower
  areaText(staticLayer, "LIMITATION OF LIABILITY:", 32.1434, 591.8331 - LEGAL_DROP, 315, 18, 13.8548, 16.6258, bold, white, null, Justification.LEFT);
  var legal = "Sample proof notice, for demonstration only.";
  areaText(staticLayer, legal, 31.4574, 574.35 - LEGAL_DROP, 315.5805, legalTextHeight, 13.8548, 17.0, thin, white);

  // Logo, phone and address are centered top-to-bottom in the white box under the legal text
  // (the block runs from the logo top, 231.0485, to the second address line, 114.5366).
  var identityShift = (outerTop - legalHeight + outerBottom) / 2 - (231.0485 + 114.5366) / 2;
  placeDemoLogo(doc, taggedLayer, 104.7923, 231.0485 + identityShift, 168.6635, 49.1902);
  centeredText(taggedLayer, DATA.phone, 189.1239, 151.0468 + identityShift, 15, medium, navy, "COMPANY_PHONE");
  centeredText(taggedLayer, DATA.address1, 189.1239, 131.3316 + identityShift, 14, medium, navy, "COMPANY_ADDRESS_LINE_1");
  centeredText(taggedLayer, DATA.address2, 189.1239, 114.5366 + identityShift, 14, medium, navy, "COMPANY_ADDRESS_LINE_2");

  // The Brand/Date row, the Print Method block and the Item Specifications block sit half a line (half of their
  // 20.78 pt line spacing) lower than the original layout. The divider lines don't move.
  var SECTION_DROP = 10.3911;
  // Each value sits one space after its label (measured), instead of at a fixed offset.
  valueAfter(taggedLayer, text(staticLayer, "BRAND:", x, 584.3262 - SECTION_DROP, 13.8548, bold, black), DATA.brand, 584.3262 - SECTION_DROP, "BRAND_NAME");
  valueAfter(taggedLayer, text(staticLayer, "DATE:", 976.0661, 584.3262 - SECTION_DROP, 13.8548, bold, black), DATA.date, 584.3262 - SECTION_DROP, "DATE");
  line(staticLayer, 394.0558, 556.4194, rightEdge, 556.4194, black, 0.8);

  valueAfter(taggedLayer, text(staticLayer, "PRINT METHOD:", x, 539.5701 - SECTION_DROP, 13.8548, bold, black), "Roto", 539.5701 - SECTION_DROP, "PRINT_METHOD");
  valueAfter(taggedLayer, text(staticLayer, "Barcode:", x, 522.9443 - SECTION_DROP, 13.8548, thin, black), DATA.barcode, 522.9443 - SECTION_DROP, "BARCODE");
  line(staticLayer, 394.0558, 500.9943, rightEdge, 500.9943, black, 0.8);

  text(staticLayer, "ITEM SPECIFICATIONS:", x, 483.1074 - SECTION_DROP, 13.8548, bold, black);
  valueAfter(taggedLayer, text(staticLayer, "DIELINE RECORD ID#:", x, 462.3252 - SECTION_DROP, 13.8548, thin, black), DATA.dielineRecordId, 462.3252 - SECTION_DROP, "DIELINE_RECORD_ID");
  taggedValue(taggedLayer, DATA.size, x, 441.5430 - SECTION_DROP, 13.8548, thin, black, "FINISHED_SIZE");
  taggedValue(taggedLayer, DATA.style, x, 420.7608 - SECTION_DROP, 13.8548, thin, black, "PACKAGE_STYLE");
  valueAfter(taggedLayer, text(staticLayer, "FBB:", x, 399.9786 - SECTION_DROP, 13.8548, thin, black), DATA.layers, 399.9786 - SECTION_DROP, "MATERIAL_STRUCTURE");
  valueAfter(taggedLayer, text(staticLayer, "Side:", x, 379.1964 - SECTION_DROP, 13.8548, thin, black), DATA.sideLayers || "Same as FBB", 379.1964 - SECTION_DROP, "SIDE_MATERIAL_STRUCTURE");
  taggedValue(taggedLayer, DATA.features, x, 358.4142 - SECTION_DROP, 13.8548, thin, black, "FEATURES");
  line(staticLayer, 394.0556, 325.8958, 1196.2616, 325.8958, black, 0.8);

  function drawBank(bankKey, heading, headingY, top, captionY) {
    var bank = DATA.colors && DATA.colors[bankKey] ? DATA.colors[bankKey] : [];
    var bankName = bankKey.toUpperCase();
    areaText(staticLayer, heading, x, headingY, 420, 18, 13.8548, 16.6258, bold, black, null, Justification.LEFT);
    var count = 0;
    for (var n = 0; n < bank.length; n++) if (String(bank[n].label || "").replace(/^\s+|\s+$/g, "")) count++;
    var hiddenCount = taggedValue(taggedLayer, String(count), outerLeft + 4, outerBottom + 4, 1, book, white, "CYLINDER_" + bankName + "_COUNT");
    hiddenCount.hidden = true;
    var swatchX = [399.2994,462.5601,525.8208,586.0812,649.3421,712.6028,775.8635,839.1241,902.5518,965.8124];
    var swatchW = 47.5478;
    var swatchH = 36.7732;
    // Caption boxes are centered under their chip, 3 points wider on each side, and tall
    // enough for two lines, so long or multi-word color names wrap instead of overflowing.
    var captionW = swatchW + 6;
    for (var i = 0; i < 10; i++) {
      var item = i < bank.length ? bank[i] : {label:"", hex:"#FFFFFF", spotName:""};
      var used = !!String(item.label || "").replace(/^\s+|\s+$/g, "");
      if (DATA.hideUnusedSwatches && !used) continue;
      var index = i + 1;
      var suffix = index < 10 ? "0" + index : String(index);
      var sx = swatchX[i];
      var fill = spotFill(doc, item, "#FFFFFF");
      rect(taggedLayer, sx, top, swatchW, swatchH, fill, black, 0.55, "CYLINDER_" + bankName + "_" + suffix + "_COLOR");
      // The number box ends 5.12 pt left of the chip (as before) but is 20 pt wide, so "10)" in Bold isn't overset.
      areaText(staticLayer, String(index) + ")", sx - 5.1224 - 20, captionY, 20, 11, 7.4222, 8.9067, blackFont, black, null, Justification.RIGHT);
      drawCaption(item.label || " ", sx + swatchW / 2 - captionW / 2, captionY, captionW, "CYLINDER_" + bankName + "_" + suffix + "_LABEL");
    }
  }

  // VARIANT B: shrink to fit. Every name starts at full size (8.48 pt) and steps down only
  // until it fits the two-line box, never below 6 pt, so short names stay large and long
  // names never overflow.
  function drawCaption(captionText, left, top, width, code) {
    var fullSize = 8.4826, minSize = 6, boxHeight = 10.1791 * 2 + 1;
    // Measure in a tall scratch box (nothing can overflow it), counting wrapped lines, and
    // keep the largest size that wraps to two lines or fewer, with no word split mid-way.
    var probe = areaText(taggedLayer, captionText, left, top, width, 200, fullSize, fullSize * 1.2, blackFont, black, null, Justification.CENTER);
    var size = fullSize;
    for (; size > minSize; size -= 0.25) {
      probe.textRange.characterAttributes.size = size;
      probe.textRange.paragraphAttributes.leading = size * 1.2;
      if (probe.lines.length <= 2 && !splitsWord(probe, captionText)) break;
    }
    probe.remove();
    size = Math.max(size, minSize);
    return areaText(taggedLayer, captionText, left, top, width, boxHeight, size, size * 1.2, blackFont, black, code, Justification.CENTER);
  }

  // True when a single word is too wide for the box and has been broken across lines.
  // Every piece on every line must be one of the name's whole words.
  function splitsWord(frame, captionText) {
    var words = {}, all = String(captionText).split(/\s+/);
    for (var w = 0; w < all.length; w++) if (all[w]) words[all[w]] = true;
    for (var l = 0; l < frame.lines.length; l++) {
      var pieces = String(frame.lines[l].contents || "").replace(/^\s+|\s+$/g, "").split(/\s+/);
      for (var p = 0; p < pieces.length; p++) if (pieces[p] && !words[pieces[p]]) return true;
    }
    return false;
  }

  if (variant === 1) {
    drawBank("a", "FRONT CYLINDERS:", 319.7344, 296.8290, 255.2994);
    drawBank("b", "BACK & BOTTOM CYLINDERS:", 230.4375, 207.5327, 166.0030);
    drawBank("c", "SIDE CYLINDERS:", 141.0527, 118.1508, 76.6211);
  } else if (variant === 2) {
    drawBank("a", "FRONT BACK BOTTOM CYLINDERS:", 319.7344, 296.8290, 255.2994);
    drawBank("c", "SIDE CYLINDERS:", 230.4375, 207.5327, 166.0030);
  } else {
    drawBank("a", "FRONT BACK BOTTOM CYLINDERS:", 319.7344, 296.8290, 255.2994);
  }

  // Chips stack top-down in one column: finish, special dieline, window. The stack lines up with the
  // first swatch row, and moves up only if it would otherwise run past the bottom border.
  var chipLeft = 1097.3353, chipW = 47.5249, chipGap = 8;
  var showFinish = DATA.finishEnabled !== false;
  var stackHeight = (showFinish ? 51.3904 + chipGap : 0) + 52.8855 + (DATA.windowEnabled ? chipGap + 52.8855 : 0);
  var chipTop = Math.max(296.8290, outerBottom + chipGap + stackHeight);
  if (showFinish) {
    rect(taggedLayer, chipLeft, chipTop, chipW, 51.3904, white, black, 0.55, "FINISH_CHIP_COLOR");
    areaText(taggedLayer, DATA.finishLabel || "SOFT TOUCH\rMATTE", chipLeft, chipTop - 11.078, chipW, 51.3904, 8.4826, 10.1791, blackFont, black, "FINISH_CHIP_LABEL", Justification.CENTER);
    chipTop -= 51.3904 + chipGap;
  }
  labeledChip(chipTop, red, null, "SPECIAL\rDIELINE", black, "SPECIAL_DIELINE");
  chipTop -= 27.0860 + 25.7995 + chipGap;
  // Window chip: light blue, under special dieline.
  if (DATA.windowEnabled) labeledChip(chipTop, windowBlue, black, DATA.windowLabel || "WINDOW", black, "WINDOW_CHIP");

  // A color block with a white label box under it (special dieline, window).
  function labeledChip(top, fill, stroke, label, labelColor, code) {
    rect(taggedLayer, chipLeft, top, chipW, 27.0860, fill, stroke, stroke ? 0.55 : 0, code === "SPECIAL_DIELINE" ? "SPECIAL_DIELINE_COLOR" : code + "_COLOR");
    rect(staticLayer, chipLeft, top - 27.0860, chipW, 25.7995, white, black, 0.55);
    areaText(taggedLayer, label, chipLeft, top - 32.086, chipW, 25.7995, 8.4785, 8.2127, blackFont, labelColor, code === "SPECIAL_DIELINE" ? "SPECIAL_DIELINE_LABEL" : code + "_LABEL", Justification.CENTER);
  }

  taggedValue(taggedLayer, String(DATA.rid || ""), outerLeft + 18, 112, 7, book, white, "QUICKBASE_RECORD_ID").hidden = true;
  taggedValue(taggedLayer, String(DATA.revision || ""), outerLeft + 18, 100, 7, book, white, "REVISION").hidden = true;
  taggedValue(taggedLayer, String(DATA.totalColors || "0"), outerLeft + 18, 88, 7, book, white, "TOTAL_COLOR_COUNT").hidden = true;
  return panelBorder;
  }

  function addVariant(number, compact, left, top, scalePercent) {
    var group = rootLayer.groupItems.add();
    group.name = "ANNOTATION VARIANT " + number;
    var panelBorder = drawPanel(group, number, compact);
    group.resize(scalePercent, scalePercent, true, true, true, true, scalePercent, Transformation.TOPLEFT);
    var borderBounds = panelBorder.geometricBounds;
    group.translate(left - borderBounds[0], top - borderBounds[1]);
    variantGroups.push(group);
  }

  addVariant(1, false, 15.0000, 662.0901, 39.03133);
  addVariant(2, true, 15.0000, 415.4130, 39.00410);
  addVariant(3, true, 15.0000, 198.3590, 39.01530);
  ACTIVE_TAG_PREFIX = "";

  /*__ARTBOARD_EDGE_CROP__*/
  // The three panel-border bounds are deterministic. Keep the artboard fixed
  // to those borders plus 15 points, ignoring hidden metadata and text bounds.
  if (!INTO_OPEN) doc.artboards[0].artboardRect = [0, H, W, 0];

  var suffixMatch = String(DATA.barcode || "").match(/\d{5}$/);
  var suggestedName = "Annotations 1-3 " + cleanFilePart(suffixMatch ? suffixMatch[0] : DATA.rid) + ".ai";
  var fontNote = missingFonts.length
    ? "\n\nDemo Grotesk isn't installed on this computer (" + missingFonts.join(", ") + "), so Arial was used. Install it from the Annotation Generator's Fonts list and restart Illustrator."
    : "";
  if (INTO_OPEN) {
    // Sit the block to the right of the active artboard, tops level, and leave it selected so it's easy to move.
    var board = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    for (var g = 0; g < variantGroups.length; g++) variantGroups[g].translate(board[2] + 36, board[1] - H);
    rootLayer.name = "ANNOTATIONS " + cleanFilePart(suffixMatch ? suffixMatch[0] : DATA.rid);
    // The groups hold hidden record tags, which Illustrator refuses to select; selecting is only a convenience.
    try { doc.selection = variantGroups; } catch (ignoredSelection) {}
    if (fontNote) alert("The annotation was added to this document." + fontNote);
    return;
  }
  var output = new File(Folder.desktop + "/" + suggestedName).saveDlg("SAVE GENERATED ANNOTATION AS", "Adobe Illustrator:*.ai");
  if (!output) {
    alert("The annotation is open in Illustrator but has not been saved." + fontNote);
    return;
  }
  if (!/\.ai$/i.test(output.name)) output = new File(output.fsName + ".ai");
  var options = new IllustratorSaveOptions();
  options.pdfCompatible = true;
  doc.saveAs(output, options);
  alert("Annotation created and saved:\n" + output.fsName + fontNote);
})();
