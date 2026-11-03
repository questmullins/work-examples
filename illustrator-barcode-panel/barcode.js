/*
  Demo Barcode panel. Turns 10, 11 or 12 digits into a UPC-A symbol and asks Illustrator (jsx/barcode.jsx)
  to draw it as 100% K vector bars.

    12 digits  used as typed; the last one must be the right check digit
    11 digits  the check digit is worked out and added
    10 digits  the first digit (0 unless changed) and the check digit are added; both can be typed in by hand

  Optional: type the last five digits and click Find to fill the number in from the Artwork table.
*/
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  // Left-hand patterns for 0-9; the right-hand patterns are the same with bars and spaces swapped.
  const LEFT = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const NOMINAL = { xMm: 0.33, barMm: 22.85, minMag: 80, maxMag: 200 };

  function checkDigit(eleven) {
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += Number(eleven[i]) * (i % 2 === 0 ? 3 : 1);
    return String((10 - sum % 10) % 10);
  }

  // What was typed -> the 12 digits to encode, or the reason it can't be.
  // `ends` only matters for 10 digits: { first, last } are the two digits the person can type in themselves.
  function resolve(text, ends) {
    const typed = String(text).replace(/[\s\-.]/g, '');
    if (!typed) return { error: '', empty: true };
    if (/\D/.test(typed)) return { error: 'Digits only, please.' };
    if (typed.length < 10) return { error: `${typed.length} digits so far. A UPC needs 10, 11 or 12` + (typed.length >= 5 ? ', or click Find to look it up in Quickbase.' : '.') };
    if (typed.length > 12) return { error: `${typed.length} digits is too many. A UPC has 12.` };
    if (typed.length === 12) {
      const expected = checkDigit(typed.slice(0, 11));
      if (expected !== typed[11]) return { error: `The last digit should be ${expected}, not ${typed[11]}. Check the number.` };
      return { digits: typed, note: 'Check digit is correct.' };
    }
    if (typed.length === 11) { const digits = typed + checkDigit(typed); return { digits, note: `Added check digit ${digits[11]}.` }; }
    // Ten digits is the middle of a UPC: the first digit and the check digit are missing. The first defaults to 0
    // and the last is worked out from the other eleven, and the person can type either one. A typed last digit
    // has to agree with the arithmetic, because a barcode with the wrong check digit does not scan.
    const first = ends && ends.first !== undefined ? ends.first : '0', last = ends && ends.last || '';
    if (!/^\d$/.test(first)) return { ten: true, error: 'Type the first digit of the barcode in the box below (usually 0).' };
    const expected = checkDigit(first + typed);
    if (last && last !== expected) return { ten: true, expected, error: `With ${first} as the first digit, the last digit works out to ${expected}, not ${last}. Check both against the customer's number.` };
    return { ten: true, expected, digits: first + typed + expected,
             note: last ? 'First and last digit match.' : `First digit ${first} and check digit ${expected} added. Change them below if the customer's number differs.` };
  }

  function encode(digits) {
    const right = pattern => pattern.replace(/[01]/g, bit => bit === '1' ? '0' : '1');
    let modules = '101';
    for (let i = 0; i < 6; i++) modules += LEFT[digits[i]];
    modules += '01010';
    for (let i = 6; i < 12; i++) modules += right(LEFT[digits[i]]);
    return modules + '101';
  }

  const number = value => { const parsed = parseFloat(String(value).replace(',', '.')); return isFinite(parsed) ? parsed : NaN; };
  function settings() {
    // Bar width reduction is typed in microns, inches or millimetres; Illustrator is given inches.
    const perInch = { um: 25400, mm: 25.4, in: 1 }[$('#bwrUnit').value];
    return { mag: number($('#mag').value), height: number($('#height').value), bwr: number($('#bwr').value) / perInch, perInch, unit: $('#bwrUnit').selectedOptions[0].textContent,
             digits: $('#digits').checked, outline: $('#outline').checked, white: $('#white').checked };
  }
  function settingsError(s) {
    if (!(s.mag >= 50 && s.mag <= 500)) return 'Magnification has to be between 50 and 500%.';
    if (!(s.height >= 25 && s.height <= 200)) return 'Bar height has to be between 25 and 200%.';
    const barInches = NOMINAL.xMm * s.mag / 100 / 25.4;
    if (!(s.bwr >= 0 && s.bwr < barInches)) return `Bar width reduction has to be less than one bar (${+(barInches * s.perInch).toPrecision(3)} ${s.unit} at this size).`;
    return '';
  }

  // A picture of the symbol in module units, same geometry the Illustrator script uses.
  function previewSvg(digits, modules, s) {
    const tall = i => i < 10 || (i >= 45 && i < 50) || i >= 85;
    const bar = NOMINAL.barMm / NOMINAL.xMm * (s.height / 100), reduce = s.bwr * 25.4 / (NOMINAL.xMm * s.mag / 100);
    let rects = '', i = 0;
    while (i < 95) {
      if (modules[i] !== '1') { i++; continue; }
      const start = i, long = tall(i);
      while (i < 95 && modules[i] === '1' && tall(i) === long) i++;
      rects += `<rect x="${(start + reduce / 2).toFixed(3)}" y="0" width="${(i - start - reduce).toFixed(3)}" height="${(bar + (long ? 5 : 0)).toFixed(2)}"/>`;
    }
    let text = '';
    const baseline = bar + 3.06 / NOMINAL.xMm, size = 2.75 / NOMINAL.xMm / 0.69;
    if (s.digits) {
      const put = (character, x, scale) => { text += `<text x="${x}" y="${baseline.toFixed(2)}" font-size="${(size * scale).toFixed(2)}" text-anchor="middle">${character}</text>`; };
      put(digits[0], -5, 0.8);
      for (let d = 1; d <= 5; d++) put(digits[d], 3 + 7 * d + 3.5, 1);
      for (let d = 6; d <= 10; d++) put(digits[d], 50 + 7 * (d - 6) + 3.5, 1);
      put(digits[11], 100, 0.8);
    }
    const height = (s.digits ? baseline : bar + 5) + 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -1 113 ${height.toFixed(2)}" role="img" aria-label="UPC-A ${digits}"><g fill="#000" font-family="DemoGrotesk-Book,'Demo Grotesk','Demo Grotesk',Arial,sans-serif">${rects}${text}</g></svg>`;
  }

  let current = null;
  // Inside Illustrator the panel only draws for a signed-in person (demo_gate.js). A plain browser preview has no gate.
  let unlocked = !window.__adobe_cep__;
  function refresh() {
    const result = resolve($('#number').value, { first: $('#firstDigit').value.trim(), last: $('#lastDigit').value.trim() }), s = settings(), problem = settingsError(s), readout = $('#readout');
    current = null;
    readout.className = 'readout' + (result.error ? ' bad' : '');
    $('#ends').hidden = !result.ten;
    $('#lastDigit').placeholder = result.expected || '';
    if (result.empty) readout.textContent = 'Type the number. Spaces and dashes are fine.';
    else if (result.error) readout.textContent = result.error;
    else {
      const d = result.digits;
      readout.innerHTML = `<b>${d[0]} ${d.slice(1, 6)} ${d.slice(6, 11)} ${d[11]}</b> &nbsp;${result.note}`;
    }
    const ready = Boolean(result.digits) && !problem;
    if (result.digits && !problem) {
      current = { digits: result.digits, modules: encode(result.digits), settings: s };
      $('#preview').innerHTML = previewSvg(current.digits, current.modules, s);
    } else $('#preview').innerHTML = '';
    $('#outline').disabled = !s.digits;
    if (problem) setStatus(problem, 'bad'); else if ($('#status').className === 'bad') setStatus('');
    const width = 113 * NOMINAL.xMm * s.mag / 100, x = NOMINAL.xMm * s.mag / 100;
    const tall = (NOMINAL.barMm * s.height / 100 + (s.digits ? 3.06 : 1.65)) * s.mag / 100;
    $('#sizeNote').textContent = problem ? '' :
      `Size with quiet zones: ${width.toFixed(2)} x ${tall.toFixed(2)} mm (${(width / 25.4).toFixed(3)} x ${(tall / 25.4).toFixed(3)} in). Narrowest bar: ${(x * 1000).toFixed(0)} µm (${(x / 25.4 * 1000).toFixed(1)} mil).` +
      (s.mag < NOMINAL.minMag || s.mag > NOMINAL.maxMag ? ' Outside the standard 80 to 200% range.' : '') +
      (s.height < 100 ? ' Bars are shortened, which makes scanning less forgiving.' : '');
    $('#create').disabled = !ready;
  }
  function setStatus(text, kind) { const status = $('#status'); status.textContent = text; status.className = kind || ''; }

  function create() {
    if (!current) return;
    if (!unlocked) { setStatus('Sign in from the Demo Account panel first.', 'bad'); return; }
    if (!window.__adobe_cep__) { setStatus('This panel is not running inside Illustrator.', 'bad'); return; }
    const s = current.settings, button = $('#create');
    const call = `demoBarcode("${current.digits}","${current.modules}",${s.mag},${s.bwr},${s.height},${s.digits},${s.outline},${s.white})`;
    button.disabled = true;
    setStatus('Drawing…');
    window.__adobe_cep__.evalScript(call, answer => {
      button.disabled = false;
      const text = String(answer || ''), ok = text.indexOf('OK|') === 0;
      setStatus(ok ? text.slice(3) : (text.indexOf('ERR|') === 0 ? text.slice(4) : text || 'Illustrator did not answer. Restart Illustrator and try again.'), ok ? 'good' : 'bad');
    });
  }

  // A new number starts over with the worked-out check digit; the first digit stays as the person left it.
  $('#number').addEventListener('input', () => { $('#lastDigit').value = ''; });
  for (const id of ['firstDigit', 'lastDigit']) $('#' + id).addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(-1); refresh(); });
  for (const id of ['number', 'mag', 'height', 'bwr']) $('#' + id).addEventListener('input', refresh);
  for (const id of ['digits', 'outline', 'white', 'bwrUnit']) $('#' + id).addEventListener('change', refresh);
  $('#number').addEventListener('keydown', event => { if (event.key === 'Enter' && !$('#create').disabled) create(); });
  $('#create').addEventListener('click', create);
  // Reset puts the panel back the way it opens.
  $('#reset').addEventListener('click', () => {
    for (const [id, value] of [['number', ''], ['firstDigit', '0'], ['lastDigit', ''], ['mag', '100'], ['height', '100'], ['bwr', '0']]) $('#' + id).value = value;
    $('#bwrUnit').value = 'um';
    $('#digits').checked = $('#outline').checked = true;
    $('#white').checked = false;
    $('#found').textContent = '';
    $('#messy').hidden = true;
    refresh();
    if (typeof syncFind === 'function') syncFind();
    setStatus('Reset. Type a UPC, or the last five digits and Find.');
    $('#number').focus();
  });

  // ---------- Optional: fill the number in from Quickbase ----------
  // Type the last five (or more) digits and click Find. The Artwork table is searched the same way the
  // Annotation panel does it, and when several different barcodes share those digits the person picks one.
  const ART = { table: 'bdemoartv', upc: 58, upc2: 624, current: 205, brand: 330, brand2: 84, item: 59, item2: 40, rev: 152, rev2: 61 };
  let qb = null;
  const cell = (row, fid) => row && row[fid] && row[fid].value != null ? String(row[fid].value).trim() : '';
  const typedDigits = () => $('#number').value.replace(/\D/g, '');
  function syncFind() { $('#find').disabled = !qb || typedDigits().length < 5; }

  async function findInQuickbase() {
    const typed = typedDigits(), tail = typed.slice(-5), button = $('#find');
    if (!qb || typed.length < 5) return;
    const ask = async currentOnly => {
      const where = `({${ART.upc}.CT.'${tail}'}OR{${ART.upc2}.CT.'${tail}'})` + (currentOnly ? `AND{${ART.current}.EX.'1'}` : '');
      const body = JSON.stringify({ from: ART.table, select: [3, ART.upc, ART.upc2, ART.brand, ART.brand2, ART.item, ART.item2, ART.rev, ART.rev2], where, sortBy: [{ fieldId: 3, order: 'DESC' }], options: { skip: 0, top: 50 } });
      const response = await qb.rest('POST', '/v1/records/query', body);
      if (response.status !== 200) throw new Error(`Quickbase answered ${response.status}. Try again, or type the full number.`);
      return JSON.parse(response.text).data || [];
    };
    const upcOf = row => cell(row, ART.upc) || cell(row, ART.upc2);
    // More than five digits typed narrows the match; a full number typed is only matched on its last five.
    const wanted = typed.length <= 9 ? typed : tail;
    button.disabled = true;
    $('#found').textContent = '';
    $('#messy').hidden = true;
    setStatus(`Looking for a barcode ending ${wanted}\u2026`);
    try {
      let rows = await ask(true);
      if (!rows.some(row => upcOf(row).replace(/\D/g, '').endsWith(wanted))) rows = await ask(false);
      rows = rows.filter(row => upcOf(row).replace(/\D/g, '').endsWith(wanted));
      if (!rows.length) { setStatus(`Quickbase has no artwork with a barcode ending ${wanted}.`, 'bad'); return; }
      rows = await window.DemoChoice.resolve({ code: wanted, rows, upc: upcOf, brand: row => cell(row, ART.brand) || cell(row, ART.brand2),
        detail: row => [cell(row, ART.item) || cell(row, ART.item2), (cell(row, ART.rev) || cell(row, ART.rev2)) ? `Revision ${cell(row, ART.rev) || cell(row, ART.rev2)}` : ''].filter(Boolean).join(' | '),
        link: row => window.DemoChoice.record(ART.table, cell(row, 3)) });
      if (!rows) { setStatus('No barcode was chosen.', 'bad'); return; }
      const row = rows[0], written = upcOf(row);
      // Only a plain 10 to 12 digit number goes into the box. Anything else is shown as Quickbase has it, to copy from.
      if (!/^\d{10,12}$/.test(written.replace(/[\s\-.]/g, ''))) {
        $('#messyText').textContent = written;
        $('#messy').hidden = false;
        $('#found').textContent = [cell(row, ART.brand) || cell(row, ART.brand2), cell(row, ART.item) || cell(row, ART.item2)].filter(Boolean).join(' | ');
        setStatus('Quickbase has this barcode written in a way the panel cannot use directly. Copy the part you need into the number box.', 'bad');
        return;
      }
      $('#number').value = written;
      $('#firstDigit').value = '0';
      $('#lastDigit').value = '';
      refresh();
      $('#found').textContent = [cell(row, ART.brand) || cell(row, ART.brand2), cell(row, ART.item) || cell(row, ART.item2)].filter(Boolean).join(' | ');
      setStatus(current ? 'Filled in from Quickbase. Check the number above before you create it.' : 'Filled in from Quickbase, but it needs fixing before it can be drawn. See the note under the number.', current ? 'good' : 'bad');
    } catch (error) { setStatus(error.message || String(error), 'bad'); }
    finally { syncFind(); }
  }
  $('#find').addEventListener('click', findInQuickbase);
  $('#number').addEventListener('input', () => { $('#found').textContent = ''; syncFind(); });
  $('#messyCopy').addEventListener('click', () => {
    const range = document.createRange();
    range.selectNodeContents($('#messyText'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (ignored) {}
    setStatus(copied ? 'Copied. Paste it into the number box and remove what you do not need.' : 'It is selected: press Ctrl+C (Cmd+C on Mac) to copy.', copied ? 'good' : '');
  });
  // Links in the choice dialog open in the normal browser, not inside the panel.
  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || !/^https?:/i.test(link.href)) return;
    event.preventDefault();
    if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(link.href);
  }, true);
  window.DemoBarcode = { resolve, encode, checkDigit };
  if (window.DemoGate) window.DemoGate.start({
    name: 'Demo Barcode',
    onUnlock(user, token) {
      unlocked = true;
      try {
        // Quickbase lookups run under the signed-in person's own token.
        const nodeRequire = window.cep_node ? window.cep_node.require : window.require, path = nodeRequire('path');
        qb = nodeRequire(path.join(path.resolve(decodeURIComponent(location.pathname).replace(/^\/(?=[A-Za-z]:)/, ''), '..'), 'qb.js'));
        qb.useToken(token);
      } catch (error) { qb = null; }
      syncFind();
    },
    onLock() { unlocked = false; if (qb) qb.useToken(''); qb = null; syncFind(); }
  });
  refresh();
  // Node.js is switched on in the manifest, which Illustrator only reads when it starts.
  if (window.__adobe_cep__ && !window.DemoGate) setStatus('Quit and reopen Illustrator to finish updating this panel.', 'bad');
})();
