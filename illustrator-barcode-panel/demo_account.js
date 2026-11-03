/*
  Demo Account: the one sign-in every Demo Packaging Illustrator panel shares. Node.js side of a CEP panel.

  Each person pastes their own Quickbase user token once, in the Demo Account panel. It is saved for their
  login on that computer only (Windows: DPAPI-encrypted file; Mac: login Keychain) and never inside a plugin's
  files, so nothing in a zip or in git identifies or works for anyone. Every other panel asks check() when it
  opens: a token Quickbase accepts unlocks the panel and gives the person's name; no token, or a rejected one,
  keeps it locked.

  This file is the same in every panel. Edit the copy in account_illustrator_panel and run build_plugins.py.
*/
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const REALM = 'demo.quickbase.example';
const MAC = process.platform === 'darwin';
const BASE = MAC ? path.join(os.homedir(), 'Library', 'Application Support', 'Demo Packaging')
                 : path.join(process.env.APPDATA || os.homedir(), 'Demo Packaging');
const DIR = path.join(BASE, 'account');
const TOKEN_FILE = path.join(DIR, 'token.dat');
const WHO_FILE = path.join(DIR, 'account.json');          // name and email only, never the token
const OLD_TOKEN_FILE = path.join(BASE, 'annotation-panel', 'token.dat');   // where the Annotation panel kept it before
const KEYCHAIN = 'Demo Packaging Account', OLD_KEYCHAIN = 'Demo Annotation Panel';
const VERSIONS_FILE = path.join(DIR, 'versions.json');   // newest panel versions, as last read from Quickbase
const DOWNLOADS = { app: 'bdemoapp0', page: 171, url: 'https://demo.quickbase.example/db/bdemoapp0?a=dbpage&pageID=1' };
const GRACE_DAYS = 7;    // how long panels keep working when Quickbase can't be reached
const AGENT = 'DemoPackagingIllustratorPanels/1.0';

// Secrets go to PowerShell on standard input, so they never show up in a command line.
function powershell(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `PowerShell exited with ${code}`)));
    child.stdin.end(input);
  });
}
const PROTECT = "Add-Type -AssemblyName System.Security; $t = [Console]::In.ReadToEnd().Trim(); " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($t), $null, 'CurrentUser'))";
const UNPROTECT = "Add-Type -AssemblyName System.Security; $t = [Console]::In.ReadToEnd().Trim(); " +
  "[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($t), $null, 'CurrentUser'))";
const keychain = args => new Promise((resolve, reject) => execFile('/usr/bin/security', args, (error, out) => error ? reject(error) : resolve(String(out).trim())));
const keychainItem = service => ['-a', os.userInfo().username, '-s', service];

async function writeToken(token) {
  fs.mkdirSync(DIR, { recursive: true });
  if (MAC) await keychain(['add-generic-password', ...keychainItem(KEYCHAIN), '-U', '-w', token]);
  else fs.writeFileSync(TOKEN_FILE, await powershell(PROTECT, token), 'utf8');
}
async function readStored(file, service) {
  try {
    if (MAC) return await keychain(['find-generic-password', ...keychainItem(service), '-w']);
    return fs.existsSync(file) ? await powershell(UNPROTECT, fs.readFileSync(file, 'utf8')) : '';
  } catch (error) { return ''; }
}
async function readToken() {
  let token = await readStored(TOKEN_FILE, KEYCHAIN);
  if (!token) {
    // First run after the Annotation panel had its own sign-in: carry that token over.
    token = await readStored(OLD_TOKEN_FILE, OLD_KEYCHAIN);
    if (token) { try { await writeToken(token); } catch (ignored) {} }
  }
  return token;
}

function readWho() {
  try { return JSON.parse(fs.readFileSync(WHO_FILE, 'utf8')); } catch (error) { return null; }
}
function writeWho(user, signedInAt) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(WHO_FILE, JSON.stringify({ name: user.name, email: user.email, signedInAt, checkedAt: Date.now() }), 'utf8');
}
// Changes when someone signs in, signs out or switches account; open panels watch it to lock or unlock.
function stamp() {
  const who = readWho();
  return who ? `${who.email}|${who.signedInAt}` : 'signed-out';
}

// Asks Quickbase whose token this is. The token goes in the request body, never in a URL.
function userInfo(token) {
  const escapeXml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = `<?xml version="1.0" encoding="UTF-8"?><qdbapi><usertoken>${escapeXml(token)}</usertoken></qdbapi>`;
  return new Promise((resolve, reject) => {
    const req = https.request({ host: REALM, path: '/db/main?a=API_GetUserInfo', method: 'POST',
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'QUICKBASE-ACTION': 'API_GetUserInfo', 'Content-Length': Buffer.byteLength(body), 'User-Agent': AGENT } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const code = (/<errcode>(\d+)<\/errcode>/.exec(text) || [])[1];
        if (code !== '0') {
          const error = new Error(code ? 'Quickbase did not accept the token.' : `Quickbase answered ${res.statusCode}.`);
          error.auth = Boolean(code);
          reject(error);
          return;
        }
        const pick = tag => ((new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text) || [])[1] || '')
          .replace(/&(lt|gt|quot|apos|amp|#039);/g, (match, name) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', '#039': "'" }[name]));
        const email = pick('email') || pick('login');
        resolve({ name: `${pick('firstName')} ${pick('lastName')}`.trim() || email, email });
      });
    });
    req.on('error', error => reject(new Error(`Couldn't reach Quickbase (${error.message}).`)));
    req.setTimeout(30000, () => req.destroy(new Error('timed out')));
    req.end(body);
  });
}

// Used by the Demo Account panel only.
async function signIn(token) {
  token = String(token || '').trim();
  const user = await userInfo(token);     // throws if Quickbase rejects it
  await writeToken(token);
  writeWho(user, Date.now());
  return user;
}
function signOut() {
  for (const file of [TOKEN_FILE, WHO_FILE, OLD_TOKEN_FILE]) { try { fs.unlinkSync(file); } catch (ignored) {} }
  if (MAC) for (const service of [KEYCHAIN, OLD_KEYCHAIN]) keychain(['delete-generic-password', ...keychainItem(service)]).catch(() => {});
}

/*
  Used by every panel. Resolves to one of:
    { ok: true, user: { name, email }, token, offline }   offline = Quickbase unreachable, allowed on the grace period
    { ok: false, reason: 'signed-out' | 'rejected' | 'offline', message }
*/
async function check() {
  const token = await readToken();
  if (!token) return { ok: false, reason: 'signed-out', message: 'Nobody is signed in on this computer.' };
  const who = readWho();
  try {
    const user = await userInfo(token);
    writeWho(user, who && who.email === user.email ? who.signedInAt : Date.now());
    return { ok: true, user, token, offline: false };
  } catch (error) {
    if (error.auth) return { ok: false, reason: 'rejected', message: 'Quickbase no longer accepts the saved token.' };
    if (who && Date.now() - who.checkedAt < GRACE_DAYS * 86400000) return { ok: true, user: { name: who.name, email: who.email }, token, offline: true };
    return { ok: false, reason: 'offline', message: error.message };
  }
}

// The Demo Downloads page lists the newest version of every panel between two markers. Asked at most every
// twelve hours and shared by all panels; resolves to {} when it can't be read, so a panel never breaks over it.
async function latestVersions(token) {
  try {
    const cached = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
    if (Date.now() - cached.fetchedAt < 12 * 3600000) return cached.versions || {};
  } catch (ignored) {}
  try {
    const escapeXml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const body = `<?xml version="1.0" encoding="UTF-8"?><qdbapi><usertoken>${escapeXml(token)}</usertoken><pageID>${DOWNLOADS.page}</pageID></qdbapi>`;
    const text = await new Promise((resolve, reject) => {
      const req = https.request({ host: REALM, path: `/db/${DOWNLOADS.app}?a=API_GetDBPage`, method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'QUICKBASE-ACTION': 'API_GetDBPage', 'Content-Length': Buffer.byteLength(body), 'User-Agent': AGENT } }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      req.on('error', reject);
      req.setTimeout(60000, () => req.destroy(new Error('timed out')));
      req.end(body);
    });
    const found = /\/\*tool-versions\*\/([\s\S]*?)\/\*\/tool-versions\*\//.exec(text);
    if (!found) return {};
    const versions = JSON.parse(found[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'));
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify({ fetchedAt: Date.now(), versions }), 'utf8');
    return versions;
  } catch (error) { return {}; }
}
const isNewer = (a, b) => {
  const left = String(a).split('.').map(Number), right = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0);
  return false;
};

module.exports = { check, signIn, signOut, stamp, who: readWho, GRACE_DAYS, latestVersions, isNewer, downloadsUrl: DOWNLOADS.url };
