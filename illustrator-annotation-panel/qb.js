/*
  Quickbase record requests for the Demo Illustrator panels. Runs in a panel's Node.js side.
  The token is the signed-in person's own, handed over by the shared Demo sign-in (demo_account.js) each time
  the panel unlocks. Nothing is stored here.

  This file is the same in every panel. Edit the copy in account_illustrator_panel and run build_plugins.py.
*/
'use strict';
const https = require('https');

const REALM = 'demo.quickbase.example';
const AGENT = 'DemoPackagingIllustratorPanels/1.0';
let token = '';

function useToken(value) { token = String(value || '').trim(); }

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', error => reject(new Error(`Couldn't reach Quickbase (${error.message}).`)));
    req.setTimeout(60000, () => req.destroy(new Error('timed out')));
    if (body) req.write(body);
    req.end();
  });
}

// Quickbase REST API (records/query and the like), signed with the user token.
function rest(method, pathAndQuery, body) {
  if (!token) return Promise.resolve({ status: 401, text: '{"message":"Not signed in"}' });
  const headers = { 'QB-Realm-Hostname': REALM, Authorization: `QB-USER-TOKEN ${token}`, 'User-Agent': AGENT };
  if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
  return request({ host: 'api.quickbase.com', path: pathAndQuery, method, headers }, body);
}

module.exports = { useToken, rest };
