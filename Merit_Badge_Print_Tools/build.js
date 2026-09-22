#!/usr/bin/env node
/* Builds merit-badge-print-tools.html: one TroopWebHost custom page with
   each standalone tool on its own tab.

   The two tools are embedded UNMODIFIED. Nothing inside either tool is
   rewritten; the build only
     - lifts each file's leading <!-- notes --> block into one combined header,
     - lifts every <script src="..."> out (de-duplicated, so pdf-lib loads once),
     - keeps each tool's markup+<style> and inline <script> exactly as-is,
     - and wraps them in a tab bar plus a small wrapper script.
   When you update either standalone tool, just run this again:

       node build.js
       node build.js --pocket ./src/merit-badge-pocket-cert.html \
                     --blue   ./src/blue-card.html --out merit-badge-print-tools.html
       node build.js --slim --out merit-badge-print-tools-slim.html   (drops the tools' notes comments)

   The build FAILS LOUDLY (instead of producing a subtly broken page) if the
   sources no longer fit the assumptions below. No dependencies. */
'use strict';
const fs = require('fs'), path = require('path');

const TOOLS = [
  { key: 'pocket', label: 'Pocket Certificates', root: 'mbc-root',
    file: './src/merit-badge-pocket-cert.html',
    title: 'Merit Badge Pocket Certificate Filler' },
  { key: 'blue', label: 'Blue Cards', root: 'bcp-root',
    file: './src/blue-card.html',
    title: 'Blue Card Printer' }
];
// Fields that mean the same thing on every tab. The value is copied into the
// other tab only when that box is empty, and edits are mirrored afterwards.
const SHARED_FIELDS = [
  ['mbc-unit', 'bcp-unit'], ['mbc-council', 'bcp-council'],
  // Same site-level settings on both tabs: which Adult Directory report to
  // read, and which Leadership title identifies the unit leader (exact match).
  ['mbc-adultdirid', 'bcp-adultdirid'], ['mbc-leadertitle', 'bcp-leader-title']
];

function arg(name, dflt){
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const OUT = path.resolve(__dirname, arg('out', 'merit-badge-print-tools.html'));
const overrides = { pocket: arg('pocket', null), blue: arg('blue', null) };
const SLIM = process.argv.indexOf('--slim') > -1;
function fail(msg){ console.error('BUILD FAILED: ' + msg); process.exit(1); }

/* ---- split one standalone tool file into its parts ---- */
function parseTool(tool){
  const file = path.resolve(__dirname, overrides[tool.key] || tool.file);
  if(!fs.existsSync(file)) fail(tool.title + ': source file not found: ' + file);
  let src = fs.readFileSync(file, 'utf8');
  const cm = src.match(/^\s*<!--([\s\S]*?)-->\s*/);
  const comment = cm ? cm[1].trim() : '';
  if(cm) src = src.slice(cm[0].length);
  const ext = [];
  src = src.replace(/<script\s+src="([^"]+)"[^>]*>\s*<\/script>\s*/g, (_, u) => { ext.push(u); return ''; });
  const inline = [];
  src = src.replace(/<script>([\s\S]*?)<\/script>\s*/g, (_, c) => { inline.push(c); return ''; });
  const markup = src.trim();
  if(/<script/i.test(markup)) fail(tool.title + ': found a <script> tag of a kind this build does not handle (only <script src="..."> and plain <script>).');
  if(!markup.startsWith('<div id="' + tool.root + '"')) fail(tool.title + ': expected the file to start with <div id="' + tool.root + '"> after its notes comment.');
  if(!/<\/div>\s*$/.test(markup)) fail(tool.title + ': expected the markup to end with the closing </div> of the root.');
  if(inline.length < 1) fail(tool.title + ': no inline <script> found.');
  if(/<!doctype|<html|<body/i.test(markup)) fail(tool.title + ': contains <html>/<body>; custom pages are pasted as a fragment.');
  return { tool, file, comment, ext, inline, markup };
}
const parts = TOOLS.map(parseTool);

/* ---- collision checks between the tools ---- */
const seenIds = {};
parts.forEach(p => {
  (p.markup.match(/\bid="([^"]+)"/g) || []).forEach(m => {
    const id = m.slice(4, -1);
    if(seenIds[id]) fail('duplicate element id "' + id + '" in ' + seenIds[id] + ' and ' + p.tool.title);
    seenIds[id] = p.tool.title;
  });
});
if(parts[0].tool.root === parts[1].tool.root) fail('both tools use the same root id.');
SHARED_FIELDS.forEach(pair => pair.forEach(id => { if(!seenIds[id]) console.warn('note: shared field #' + id + ' not found in the sources (skipped at run time).'); }));

/* ---- assemble ---- */
const extScripts = [];
parts.forEach(p => p.ext.forEach(u => { if(extScripts.indexOf(u) === -1) extScripts.push(u); }));

const header =
'Merit Badge Print Tools -- Pocket Certificates + Blue Cards\n' +
'----------------------------------------\n' +
'GENERATED FILE. Do not edit by hand: edit the standalone tools and run\n' +
'"node build.js" in Merit_Badge_Print_Tools/ to regenerate this page.\n\n' +
'Paste this WHOLE block into TroopWebHost: Manage Custom Pages -> (new or\n' +
'existing Custom Page) -> HTML editor. It must run ON troopwebhost.org\n' +
'(same-origin) so the fetch calls inherit your logged-in session.\n\n' +
'This page hosts each tool on its own tab. The tools are independent: each\n' +
'keeps its own settings, and only the Unit number and Council are shared\n' +
'(filled into the other tab when empty, and mirrored when changed).\n' +
'The notes below are each tool\'s own "read before using" notes, unchanged.\n\n' +
(SLIM
  ? 'SLIM BUILD: the tools\' own "read before using" notes were left out to save\nspace. They are in each tool\'s README and in the standalone HTML files.'
  : parts.map(p => '==== ' + p.tool.title + ' ====\n' + p.comment).join('\n\n'));
if(/-->/.test(header)) fail('a tool\'s notes comment contains "-->" and cannot be nested.');

const css = `
#mbt-root{
  max-width:1100px; margin:20px auto 0;
  font-family:'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}
#mbt-root, #mbt-root *{ box-sizing:border-box; }
/* Theme colors are copied from the active tool at run time (see script), so
   the tabs always match whatever the live site's palette resolved to. */
#mbt-root .mbt-tabs{ display:flex; flex-wrap:wrap; gap:6px; padding:0 4px; }
#mbt-root .mbt-tabs button{
  font-family:inherit; font-weight:700; font-size:13.5px; letter-spacing:.01em;
  padding:11px 20px; cursor:pointer;
  border:1px solid var(--mbt-hair, rgba(128,128,128,0.45)); border-bottom:none;
  border-radius:6px 6px 0 0;
  background:var(--mbt-paper, #2e2a20); color:var(--mbt-ink, #f0ead8);
  opacity:.82; transition:opacity .12s, filter .12s;
}
#mbt-root .mbt-tabs button:hover{ opacity:1; }
#mbt-root .mbt-tabs button:focus-visible{ outline:2px solid var(--mbt-brass, #b8863b); outline-offset:2px; opacity:1; }
#mbt-root .mbt-tabs button[aria-selected="true"]{
  background:var(--mbt-brass, #b8863b); color:var(--mbt-accent-ink, #241a08);
  border-color:var(--mbt-brass, #b8863b); opacity:1;
}
/* Each tool's own root normally centers itself with a 20px top margin; inside
   a tab it sits flush under the tab bar. (Two ids beat the tool's one id.) */
#mbt-root .mbt-panel > div[id]{ margin-top:0 !important; border-top-left-radius:0 !important; }
#mbt-root .mbt-hidden{ display:none !important; }
`;

const tabsHtml = TOOLS.map((t, i) =>
  '  <button type="button" role="tab" id="mbt-tab-' + t.key + '" data-tab="' + t.key + '" aria-controls="mbt-panel-' + t.key + '"' +
  ' aria-selected="' + (i === 0 ? 'true' : 'false') + '"' + (i === 0 ? '' : ' tabindex="-1"') + '>' + t.label + '</button>'
).join('\n');
const panelsHtml = parts.map((p, i) =>
  '<div class="mbt-panel' + (i === 0 ? '' : ' mbt-hidden') + '" id="mbt-panel-' + p.tool.key + '" role="tabpanel" aria-labelledby="mbt-tab-' + p.tool.key + '">\n' +
  p.markup + '\n</div>'
).join('\n\n');

const wrapperJs = `
(function(){
'use strict';
var TABS = ${JSON.stringify(TOOLS.map(t => ({ key: t.key, root: t.root })))};
var SHARED = ${JSON.stringify(SHARED_FIELDS)};
var STORE_KEY = 'mbtActiveTab';
function byId(id){ return document.getElementById(id); }
var wrap = byId('mbt-root');

// The tabs borrow the active tool's resolved theme colors.
function syncTheme(key){
  try{
    var t = TABS.filter(function(x){ return x.key === key; })[0];
    var root = t && byId(t.root);
    if(!root) return;
    var cs = getComputedStyle(root);
    [['--brass','--mbt-brass'],['--accent-ink','--mbt-accent-ink'],['--ink','--mbt-ink'],['--paper-800','--mbt-paper'],['--hair-strong','--mbt-hair']].forEach(function(p){
      var v = cs.getPropertyValue(p[0]).trim();
      if(v) wrap.style.setProperty(p[1], v);
    });
  }catch(e){ /* cosmetic only */ }
}
function select(key, focus){
  if(!TABS.some(function(x){ return x.key === key; })) key = TABS[0].key;
  TABS.forEach(function(t){
    var on = t.key === key;
    var btn = byId('mbt-tab-' + t.key), panel = byId('mbt-panel-' + t.key);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
    panel.classList.toggle('mbt-hidden', !on);
    if(on && focus) btn.focus();
  });
  syncTheme(key);
  try{ localStorage.setItem(STORE_KEY, key); }catch(e){}
  try{ if(history.replaceState) history.replaceState(null, '', '#' + key); }catch(e){}
}
function initialTab(){
  var h = (location.hash || '').replace('#', '');
  if(TABS.some(function(x){ return x.key === h; })) return h;
  try{ var s = localStorage.getItem(STORE_KEY); if(s) return s; }catch(e){}
  return TABS[0].key;
}
function wire(){
  var bar = wrap.querySelector('.mbt-tabs');
  bar.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('button[data-tab]') : null;
    if(b){ e.preventDefault(); select(b.getAttribute('data-tab'), false); }
  });
  bar.addEventListener('keydown', function(e){
    var i = -1;
    TABS.forEach(function(t, n){ if(byId('mbt-tab-' + t.key) === document.activeElement) i = n; });
    if(i < 0) return;
    var next = null;
    if(e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if(e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if(e.key === 'Home') next = 0;
    else if(e.key === 'End') next = TABS.length - 1;
    if(next !== null){ e.preventDefault(); select(TABS[next].key, true); }
  });
  window.addEventListener('hashchange', function(){
    var h = (location.hash || '').replace('#', '');
    if(TABS.some(function(x){ return x.key === h; })) select(h, false);
  });
  // Shared settings: fill an empty box from its partner, then mirror edits.
  SHARED.forEach(function(pair){
    var a = byId(pair[0]), b = byId(pair[1]);
    if(!a || !b) return;
    if(a.value && !b.value){ b.value = a.value; b.dispatchEvent(new Event('change')); }
    else if(b.value && !a.value){ a.value = b.value; a.dispatchEvent(new Event('change')); }
    function mirror(from, to){
      from.addEventListener('change', function(){
        if(to.value !== from.value){ to.value = from.value; to.dispatchEvent(new Event('change')); }
      });
    }
    mirror(a, b); mirror(b, a);
  });
  select(initialTab(), false);
}
// The tools load their saved settings on DOMContentLoaded; this listener is
// registered after theirs, so it runs after they have filled their boxes.
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
})();
`;

const out =
'<!--\n' + header + '\n-->\n' +
'<div id="mbt-root">\n<style>' + css + '</style>\n' +
'<div class="mbt-tabs" role="tablist" aria-label="Advancement printing tools">\n' + tabsHtml + '\n</div>\n\n' +
panelsHtml + '\n</div>\n\n' +
extScripts.map(u => '<script src="' + u + '"></script>').join('\n') + (extScripts.length ? '\n' : '') +
parts.map(p => p.inline.map(c => '<script>' + c + '</script>').join('\n')).join('\n') + '\n' +
'<script>' + wrapperJs + '</script>\n';

if(/[^\x00-\x7F]/.test(out)) fail('output contains non-ASCII characters (TroopWebHost\'s editor corrupts raw UTF-8). First offender: ' + JSON.stringify(out.match(/[^\x00-\x7F]/)[0]));
fs.writeFileSync(OUT, out);
console.log('Built ' + path.relative(process.cwd(), OUT) + ' (' + Math.round(out.length / 1024) + ' KB)');
parts.forEach(p => console.log('  tab "' + p.tool.label + '" <- ' + path.relative(process.cwd(), p.file) + '  (' + p.inline.length + ' inline script, ext: ' + (p.ext.join(', ') || 'none') + ')'));
console.log('  external scripts (de-duplicated): ' + (extScripts.join(', ') || 'none'));
