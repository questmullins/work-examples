/*
  Demo Gate: the lock every Demo Packaging Illustrator panel puts in front of itself. Browser side of a CEP panel.

  DemoGate.start({ name, onUnlock(user, token), onLock() }) checks the shared sign-in (demo_account.js). Signed
  in: a thin bar shows whose account it is and onUnlock runs. Not signed in: the panel is covered with a message
  that points to the Demo Account panel, and it unlocks by itself as soon as someone signs in there.

  This file is the same in every panel. Edit the copy in account_illustrator_panel and run build_plugins.py.
*/
(function () {
  'use strict';
  const nodeRequire = window.cep_node ? window.cep_node.require : window.require;
  const path = nodeRequire('path');
  const here = path.resolve(decodeURIComponent(location.pathname).replace(/^\/(?=[A-Za-z]:)/, ''), '..');
  const account = nodeRequire(path.join(here, 'demo_account.js'));

  const style = document.createElement('style');
  style.textContent =
    '.xg-bar{flex:none;display:flex;align-items:center;gap:6px;padding:4px 10px;border-bottom:1px solid #3a3a3a;background:#484848;color:#c8c8c8;font:11px/1.3 "Segoe UI",-apple-system,BlinkMacSystemFont,Arial,sans-serif}' +
    '.xg-bar b{overflow:hidden;color:#f0f0f0;font-weight:600;text-overflow:ellipsis;white-space:nowrap}' +
    '.xg-bar i{flex:none;width:7px;height:7px;border-radius:50%;background:#86dcae}.xg-bar i.off{background:#e0b25c}' +
    '.xg-bar small{flex:none;color:#e0b25c;font-size:10.5px}' +
    '.xg-bar span{margin-left:auto;flex:none;color:#b4b4b4;font-size:10.5px}' +
    '.xg-bar a{flex:none;padding:1px 6px;border-radius:3px;background:#ffd166;color:#132a35;font-size:10.5px;font-weight:600;text-decoration:none;cursor:pointer}' +
    '.xg-lock{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:22px;background:#535353;color:#dedede;font:12.5px/1.45 "Segoe UI",-apple-system,BlinkMacSystemFont,Arial,sans-serif}' +
    '.xg-lock h1{margin:0;color:#f2f2f2;font-size:15px;font-weight:600}.xg-lock p{margin:0}.xg-lock .xg-path{color:#f2f2f2;font-weight:600}' +
    '.xg-lock button{align-self:flex-start;height:26px;padding:0 12px;border:1px solid #8c8c8c;border-radius:3px;background:#4a4a4a;color:#f0f0f0;font:600 11.5px "Segoe UI",-apple-system,BlinkMacSystemFont,Arial,sans-serif;cursor:pointer}' +
    '.xg-lock button:hover{background:#5e5e5e}.xg-lock small{color:#b4b4b4}' +
    '[hidden].xg-lock,[hidden].xg-bar{display:none}';
  document.head.append(style);

  const bar = document.createElement('div');
  bar.className = 'xg-bar';
  bar.hidden = true;
  const lock = document.createElement('div');
  lock.className = 'xg-lock';
  document.body.prepend(bar);
  document.body.append(lock);

  const MESSAGES = {
    'signed-out': ['Sign in to use NAME', 'Open the Demo Account panel and paste your Quickbase token. You only do it once, for every Demo panel.'],
    rejected: ['Your sign-in has expired', 'Quickbase no longer accepts the saved token. Open the Demo Account panel and paste a new one.'],
    offline: ["Can't reach Quickbase", `NAME checks your sign-in online, and the last successful check was more than ${account.GRACE_DAYS} days ago. Connect to the internet and try again.`]
  };

  // This panel's own version is stamped into its index.html by demo_versions.py.
  const stamped = document.querySelector('meta[name="app-version"]');
  const panel = { id: stamped ? stamped.getAttribute('data-tool') : '', version: stamped ? stamped.content : '' };
  // A newer version on the Demo Downloads page turns the version into a yellow "Update" link.
  async function checkVersion(token) {
    if (!panel.id || !panel.version) return;
    const latest = (await account.latestVersions(token))[panel.id];
    const label = bar.querySelector('span');
    if (!latest || !label || !account.isNewer(latest, panel.version)) return;
    const link = document.createElement('a');
    link.textContent = 'v' + panel.version + ' \u2192 v' + latest + ': update';
    link.title = 'A newer version is on the Demo Downloads page. Click to open it, download the zip and run its installer.';
    link.addEventListener('click', () => { if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(account.downloadsUrl); });
    label.replaceWith(link);
    link.style.marginLeft = 'auto';
  }

  function start(options) {
    let unlocked = false, seen = '', busy = false;

    function showLock(result) {
      const [title, text] = MESSAGES[result.reason] || ['Locked', result.message || ''];
      lock.innerHTML = '<h1></h1><p></p><p class="xg-path">Window &gt; Extensions (Legacy) &gt; Demo Account</p><button type="button">Try again</button><small>This panel unlocks by itself once you are signed in.</small>';
      lock.querySelector('h1').textContent = title.replace('NAME', options.name);
      lock.querySelector('p').textContent = text.replace('NAME', options.name);
      lock.querySelector('button').addEventListener('click', run);
      if (result.reason === 'offline') { lock.querySelector('.xg-path').hidden = true; lock.querySelector('small').textContent = result.message || ''; }
      lock.hidden = false;
      bar.hidden = true;
    }

    async function run() {
      if (busy) return;
      busy = true;
      try {
        if (!unlocked) { lock.innerHTML = '<p>Checking your sign-in…</p>'; lock.hidden = false; }
        const result = await account.check();
        seen = account.stamp();
        if (result.ok) {
          bar.innerHTML = '<i></i><b></b>' + (result.offline ? '<small>offline</small>' : '') + (panel.version ? '<span>v' + panel.version + '</span>' : '');
          bar.querySelector('b').textContent = result.user.name;
          bar.querySelector('b').title = result.user.email;
          if (result.offline) bar.querySelector('i').className = 'off';
          bar.hidden = false;
          lock.hidden = true;
          unlocked = true;
          options.onUnlock(result.user, result.token);
          checkVersion(result.token);
        } else {
          if (unlocked && options.onLock) options.onLock();
          unlocked = false;
          showLock(result);
        }
      } catch (error) {
        unlocked = false;
        showLock({ reason: 'error', message: error.message });
      } finally { busy = false; }
    }

    // Sign-in, sign-out or a different person in the Demo Account panel: follow it without a restart.
    setInterval(() => { if (!busy && account.stamp() !== seen) run(); }, 2500);
    run();
  }

  window.DemoGate = { start, account, panel };
})();
