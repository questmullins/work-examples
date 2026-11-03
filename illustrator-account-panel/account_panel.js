/*
  Demo Account panel: the one place a person signs in for every Demo Packaging Illustrator panel.
  The saving and checking live in demo_account.js; this file is only the screen. The look is demo_panel.css,
  shared with the other panels: name bar on top, sections in the middle, status and buttons in the footer.
*/
(function () {
  'use strict';
  const nodeRequire = window.cep_node ? window.cep_node.require : window.require;
  const path = nodeRequire('path');
  const here = path.resolve(decodeURIComponent(location.pathname).replace(/^\/(?=[A-Za-z]:)/, ''), '..');
  const account = nodeRequire(path.join(here, 'demo_account.js'));
  const $ = selector => document.querySelector(selector);
  const stamped = document.querySelector('meta[name="app-version"]'), mine = stamped ? stamped.content : '';
  let signedIn = false;

  function setStatus(text, kind) { const status = $('#status'); status.textContent = text || ''; status.className = kind || ''; }
  function bar(name, on) {
    $('#barName').textContent = name;
    $('#bar i').className = on ? '' : 'off';
  }
  function showForm(note, kind) {
    $('#token').value = '';
    $('#signedIn').hidden = $('#actionsIn').hidden = true;
    $('#signedOut').hidden = $('#actionsOut').hidden = false;
    $('#cancel').hidden = !signedIn;
    if (!signedIn) bar('Not signed in', false);
    setStatus(note || 'Paste your own Quickbase token and click Sign in.', kind);
    $('#token').focus();
  }
  function showUser(user, note, kind) {
    signedIn = true;
    $('#name').textContent = user.name;
    $('#email').textContent = user.email;
    $('#signedOut').hidden = $('#actionsOut').hidden = true;
    $('#signedIn').hidden = $('#actionsIn').hidden = false;
    bar(user.name, true);
    setStatus(note, kind);
  }

  async function refresh() {
    setStatus('Checking your sign-in…');
    try {
      const result = await account.check();
      if (result.ok) showUser(result.user, result.offline ? "Couldn't reach Quickbase just now. The panels keep working for a few days on the last check." : 'Checked with Quickbase just now.', result.offline ? '' : 'good');
      else { signedIn = false; showForm(result.reason === 'signed-out' ? '' : result.message, result.reason === 'signed-out' ? '' : 'bad'); }
      return result;
    } catch (error) { signedIn = false; showForm(error.message, 'bad'); return null; }
  }

  $('#signedOut').addEventListener('submit', async event => {
    event.preventDefault();
    const value = $('#token').value.trim(), buttons = [$('#save'), $('#saveMain')];
    if (!value) { setStatus('Paste your token first.', 'bad'); $('#token').focus(); return; }
    buttons.forEach(button => { button.disabled = true; });
    setStatus('Checking the token with Quickbase…');
    try {
      const user = await account.signIn(value);
      $('#token').value = '';
      showUser(user, 'Signed in. Open panels unlock by themselves in a few seconds.', 'good');
    } catch (error) {
      setStatus(error.auth ? 'Quickbase did not accept that token. Check that you copied all of it.' : error.message, 'bad');
    } finally { buttons.forEach(button => { button.disabled = false; }); }
  });
  $('#cancel').addEventListener('click', refresh);
  $('#recheck').addEventListener('click', refresh);
  $('#change').addEventListener('click', () => showForm('Paste the new token and click Sign in.', ''));
  $('#signOut').addEventListener('click', () => { account.signOut(); signedIn = false; showForm('Signed out. The Demo panels on this computer are locked until someone signs in.', ''); });
  $('#tokenLink').addEventListener('click', event => {
    event.preventDefault();
    if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(event.currentTarget.href);
  });

  // This panel's version at the right of the bar; a yellow link instead when Demo Downloads lists a newer one.
  if (mine) $('#barVersion').textContent = 'v' + mine;
  async function checkVersion(result) {
    if (!result || !result.ok || !mine) return;
    const latest = (await account.latestVersions(result.token)).account;
    if (!latest || !account.isNewer(latest, mine)) return;
    const link = document.createElement('a');
    link.textContent = 'v' + mine + ' → v' + latest + ': update';
    link.title = 'A newer version is on the Demo Downloads page. Click to open it, download the zip and run its installer.';
    link.addEventListener('click', () => { if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(account.downloadsUrl); });
    $('#barVersion').replaceWith(link);
  }
  refresh().then(checkVersion).catch(() => {});
})();
