/*
  Demo Annotation panel: the Annotation Generator running inside Illustrator.

  The panel carries its own copies of the generator screen (app/generator.html) and the drawing script
  (app/annotation.jsx). They started as Quickbase pages 158 and 159 but are edited here only; the Quickbase
  pages are not read or changed by the panel. Only record data comes from Quickbase.
  The screen talks to this shell through window.AnnotationHost:
    fetch(url, init)  Quickbase requests, sent with the signed-in person's token (demo_account.js, qb.js)
    run(jsx)          draws the annotation in Illustrator instead of downloading a .jsx
    email             the token owner's email, for the initials after the date
*/
(function () {
  'use strict';
  const JSX_PAGE = 159;
  const nodeRequire = window.cep_node ? window.cep_node.require : window.require;
  const fs = nodeRequire('fs'), path = nodeRequire('path');
  const extensionDir = path.resolve(decodeURIComponent(location.pathname).replace(/^\/(?=[A-Za-z]:)/, ''), '..');
  const qb = nodeRequire(path.join(extensionDir, 'qb.js'));
  const $ = selector => document.querySelector(selector);
  const nativeFetch = window.fetch.bind(window);
  let jsxSource = '', user = { email: '', name: '' };

  const appFile = name => fs.readFileSync(path.join(extensionDir, 'app', name), 'utf8');
  const openInBrowser = url => { if (window.cep && window.cep.util) window.cep.util.openURLInDefaultBrowser(url); else window.open(url); };
  const reply = (text, status, type) => new Response(text, { status: status || 200, headers: { 'Content-Type': type || 'text/plain' } });

  // Stands in for window.fetch inside the generator screen.
  async function hostFetch(input, init) {
    const url = String(input && input.url ? input.url : input);
    init = init || {};
    // The screen asks for its drawing script by the old Quickbase name; it gets the panel's own copy.
    if (/annotation_jsx_159\.js/i.test(url) || (/[?&]a=dbpage/i.test(url) && new RegExp(`pageID=${JSX_PAGE}\\b`, 'i').test(url))) {
      jsxSource = jsxSource || appFile('annotation.jsx');
      return reply(jsxSource, 200, 'text/javascript');
    }
    // The page asks for a temporary session token first; the real requests are signed here instead.
    if (/^https:\/\/api\.quickbase\.com\/v1\/auth\/temporary\//i.test(url)) return reply('{"temporaryAuthorization":"illustrator-panel"}', 200, 'application/json');
    if (/^https:\/\/api\.quickbase\.com\/v1\//i.test(url)) {
      const target = new URL(url);
      const response = await qb.rest(init.method || 'GET', target.pathname + target.search, init.body ? String(init.body) : '');
      return reply(response.text, response.status, 'application/json');
    }
    return nativeFetch(input, init);
  }

  // Runs a populated JSX in Illustrator. Resolves to 'OK' or a message describing what went wrong.
  function run(jsx) {
    return new Promise(resolve => {
      if (!window.__adobe_cep__) { resolve('This panel is not running inside Illustrator.'); return; }
      const body = String(jsx).replace(/^[ \t]*#target[^\n]*\n/gm, '\n');
      const wrapped = '(function(){try{\n' + body + '\n;return "OK";}catch(e){return "Illustrator error: "+e.message+(e.line?" (line "+e.line+")":"");}})()';
      window.__adobe_cep__.evalScript(wrapped, result => resolve(result === 'OK' ? 'OK' : (result || 'Illustrator did not answer.')));
    });
  }

  window.AnnotationHost = { fetch: hostFetch, run, openInBrowser, get email() { return user.email; }, version: '1.0.0' };

  // Chromium 99 (Illustrator's panel engine) doesn't know the dvh unit; vh is the same thing in a panel.
  const forPanel = html => html.replace(/<style[\s\S]*?<\/style>/gi, block => block.replace(/(\d)dvh\b/g, '$1vh'));

  function loadPage() {
    let html = appFile('generator.html');
    const hook = '<script>window.AnnotationHost=parent.AnnotationHost;window.fetch=parent.AnnotationHost.fetch;<\/script>';
    html = forPanel(html);
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, match => match + hook) : hook + html;
    const frame = $('#app');
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      // Links leave the panel for the normal browser; nothing should navigate the panel itself away.
      doc.addEventListener('click', event => {
        const link = event.target.closest && event.target.closest('a[href]');
        if (!link || !/^https?:/i.test(link.href)) return;
        event.preventDefault(); event.stopPropagation(); openInBrowser(link.href);
      }, true);
      doc.addEventListener('dblclick', event => {
        if (event.target.closest && event.target.closest('a[href]')) { event.preventDefault(); event.stopPropagation(); }
      }, true);
    };
    frame.srcdoc = html;
    frame.hidden = false;
  }

  // The shared Demo sign-in (demo_gate.js) decides whether the panel opens, and whose token is used.
  window.DemoGate.start({
    name: 'Demo Annotation',
    onUnlock(person, token) {
      qb.useToken(token);
      // A re-check of the same person must not reload the screen and wipe what they have typed.
      if (person.email === user.email && $('#app').srcdoc) return;
      user = person;
      loadPage();
    },
    onLock() {
      qb.useToken('');
      user = { email: '', name: '' };
      $('#app').srcdoc = '';
      $('#app').hidden = true;
    }
  });
})();
