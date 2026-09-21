/* Tests for the combined Merit Badge Print Tools page.
   Part 1: static checks on the generated file (and that it is up to date
           with the two standalone tools).
   Part 2: end to end in headless Chromium: tab behaviour, shared settings,
           and a full workflow on EACH tab inside the same page, against a
           local stand-in for TroopWebHost that issues real 302s.
   ALL data is synthetic. Uses the fake server and fixtures from ../Blue_Card.
   Requires: npm i playwright pdf-lib xlsx ; qpdf and pdftotext (poppler).
   Run from this folder:  node test_combined.js                            */
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const BLUE = path.join(__dirname, '..', 'Blue_Card');
const POCKET = path.join(__dirname, '..', 'Merit_Badge_Pocket_Cert');
const HTML = path.join(__dirname, 'merit-badge-print-tools.html');
const create = require(path.join(BLUE, 'fake_twh.js'));
const fx = require(path.join(BLUE, 'fixtures.js'));
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const sheetjs = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
const BLUE_TEMPLATE = fs.readFileSync(path.join(BLUE, 'blue-card-template.pdf'));
const POCKET_TEMPLATE = fs.readFileSync(path.join(POCKET, 'merit-badge-pocket-cert-template.pdf'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'mbt-test-'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };

/* ---------- synthetic Award Report for the Pocket Certificate tab ---------- */
const AWARDS = [
  ['Alder, Jamie R', 'Merit Badge', 'Camping*', '6/2/2026'], ['Alder, Jamie R', 'Merit Badge', 'First Aid*', '6/2/2026'],
  ['Alder, Jamie R', 'Rank', 'Star', '5/1/2026'], ['Brannigan, Cole T', 'Merit Badge', 'Archery', '5/20/2026'],
  ['Brannigan, Cole T', 'Merit Badge', 'Metalwork', '5/19/2026'], ['Castellano, Ren A', 'Merit Badge', 'American Business', '4/11/2026'],
  ['Castellano, Ren A', 'Award', "Totin' Chip", '3/1/2026'], ['Delgado, Skyler M', 'Merit Badge', 'Space Exploration', '5/2/2026']
];
const awardReportHtml = () => '<html><body><form enctype="multipart/form-data" action="FormDetail.aspx" method="post" name="easyform" id="easyform">' +
  '<input type="hidden" name="NewRowsPerPage" id="NewRowsPerPage" value=""><input type="hidden" name="Menu_Item_ID" value="45952"><input type="hidden" name="Form_ID" value="253">' +
  '<table class="table-striped table-bordered table-condensed table-curved sortable"><thead><tr><th>Adult</th><th>Scout</th><th>Patrol</th><th>Type</th><th>Award</th><th>Earned</th><th>Awarded</th><th>COH</th><th>Council</th></tr></thead><tbody>' +
  AWARDS.map(r => '<tr><td>No</td><td>' + r[0] + '</td><td>Hawk</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td></td><td></td><td></td></tr>').join('') +
  '</tbody></table></form></body></html>';

/* ---------- Part 1: static ---------- */
console.log('== 1. generated file');
const html = fs.readFileSync(HTML, 'utf8');
const ids = (html.match(/\bid="([^"]+)"/g) || []).map(s => s.slice(4, -1));
ok(new Set(ids).size === ids.length, 'every element id is unique (' + ids.length + ' ids)');
ok((html.match(/pdf-lib\.min\.js/g) || []).length === 1, 'pdf-lib is loaded exactly once');
ok((html.match(/xlsx\.full\.min\.js/g) || []).length === 1, 'SheetJS (needed by the Pocket tool) is loaded exactly once');
ok(!/[^\x00-\x7F]/.test(html), 'pure ASCII');
ok(!/<form/i.test(html.replace(/<!--[\s\S]*?-->/, '').replace(/<script[\s\S]*?<\/script>/g, '')), 'no <form> element in the page markup (outside scripts)');
ok(/id="mbc-root"/.test(html) && /id="bcp-root"/.test(html) && /id="mbt-root"/.test(html), 'both tool roots and the tab wrapper are present');
const tmp = path.join(OUT, 'rebuilt.html');
execSync('node "' + path.join(__dirname, 'build.js') + '" --out "' + tmp + '"', { stdio: 'pipe' });
ok(fs.readFileSync(tmp, 'utf8') === html, 'checked-in page is up to date with the two standalone tools (rebuild is byte-identical)');
{ // each tool is embedded verbatim
  const src = f => fs.readFileSync(f, 'utf8');
  const strip = s => s.replace(/^\s*<!--[\s\S]*?-->\s*/, '').replace(/<script\s+src="[^"]+"[^>]*>\s*<\/script>\s*/g, '');
  ok(html.includes(strip(src(path.join(BLUE, 'blue-card.html'))).trim().split('<script>')[0].trim()), 'Blue Card markup embedded unmodified');
  ok(html.includes(strip(src(path.join(POCKET, 'merit-badge-pocket-cert.html'))).trim().split('<script>')[0].trim()), 'Pocket Certificate markup embedded unmodified');
}

/* ---------- Part 2: browser ---------- */
async function boot(o = {}) {
  const srv = await create({ toolPath: HTML, exportHtml: fx.exportHtml(), csv: fx.csv(), scoutDir: fx.scoutDir(), adultDir: fx.adultDir(), templatePath: path.join(BLUE, 'blue-card-template.pdf') });
  // answer the Pocket Certificate's Award Report ahead of the Blue Card routes
  const orig = srv.server.listeners('request')[0]; srv.server.removeAllListeners('request');
  srv.server.on('request', (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/FormDetail.aspx' && u.searchParams.get('Menu_Item_ID') === '45952') {
      req.on('data', () => {}); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(awardReportHtml()); }); return;
    }
    orig(req, res);
  });
  const browser = await chromium.launch(); const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1240, height: 900 } });
  if (o.storage) await ctx.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, o.storage);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ body: pdflib, contentType: 'application/javascript' }));
  await page.route('https://cdn.sheetjs.com/**', r => r.fulfill({ body: sheetjs, contentType: 'application/javascript' }));
  await page.route('https://mediafiles.scoutshop.org/**', r => r.fulfill({ body: POCKET_TEMPLATE, contentType: 'application/pdf', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://raw.githubusercontent.com/**', r => r.fulfill({ body: r.request().url().includes('Merit_Badge_Pocket_Cert') ? POCKET_TEMPLATE : BLUE_TEMPLATE, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('http://127.0.0.1:' + srv.port + '/Custom.aspx' + (o.hash || ''));
  return { srv, browser, page, errs, url: 'http://127.0.0.1:' + srv.port + '/Custom.aspx' };
}
const vis = (p, sel) => p.locator(sel).isVisible();
const txt = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const pages = f => +execSync('qpdf --show-npages "' + f + '"').toString().trim();
const pdftext = f => execSync('pdftotext -layout "' + f + '" -').toString();
async function download(page, btn) { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(btn)]); const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return f; }

(async () => {
  console.log('== 2. tabs');
  let { srv, browser, page, errs, url } = await boot();
  ok(await page.locator('#mbc-root.mbc-ready').count() === 1 && await page.locator('#bcp-root.bcp-ready').count() === 1, 'both tools initialised (each ran its own theme setup)');
  ok((await page.locator('[role=tab]').allTextContents()).join('|') === 'Pocket Certificates|Blue Cards', 'two tabs: Pocket Certificates, Blue Cards');
  ok(await page.getAttribute('#mbt-tab-pocket', 'aria-selected') === 'true', 'Pocket Certificates is the default tab');
  ok(await vis(page, '#mbc-root') && !(await vis(page, '#bcp-root')), 'default: pocket tool visible, blue card tool hidden');
  ok((await page.evaluate(() => document.getElementById('mbt-root').style.getPropertyValue('--mbt-brass'))).length > 0, 'tab colours copied from the resolved theme');
  await page.click('#mbt-tab-blue');
  ok(!(await vis(page, '#mbc-root')) && await vis(page, '#bcp-root'), 'clicking Blue Cards swaps the visible tool');
  ok(await page.getAttribute('#mbt-tab-blue', 'aria-selected') === 'true' && await page.getAttribute('#mbt-tab-pocket', 'aria-selected') === 'false', 'aria-selected follows the active tab');
  ok((await page.evaluate(() => location.hash)) === '#blue', 'URL hash records the tab (#blue)');
  await page.reload(); ok(await vis(page, '#bcp-root'), 'reload remembers the last tab');
  await page.goto(url + '#pocket'); ok(await vis(page, '#mbc-root') && !(await vis(page, '#bcp-root')), '#pocket in the URL overrides the remembered tab');
  await page.focus('#mbt-tab-pocket'); await page.keyboard.press('ArrowRight');
  ok(await vis(page, '#bcp-root') && await page.evaluate(() => document.activeElement.id) === 'mbt-tab-blue', 'ArrowRight moves to (and focuses) the next tab');
  await page.keyboard.press('ArrowRight'); ok(await vis(page, '#mbc-root'), 'ArrowRight wraps around');
  await page.keyboard.press('End'); ok(await vis(page, '#bcp-root'), 'End -> last tab');
  await page.keyboard.press('Home'); ok(await vis(page, '#mbc-root'), 'Home -> first tab');
  await page.screenshot({ path: path.join(OUT, 'tabs.png') });
  ok(errs.length === 0, 'no page or console errors (' + errs.join(' | ') + ')');
  await browser.close(); srv.close();

  console.log('== 3. shared Unit / Council settings');
  ({ srv, browser, page, errs, url } = await boot({ storage: { mbcCouncil: 'Seeded Council' } }));
  ok(await page.inputValue('#mbc-unit') === '1776' && await page.inputValue('#bcp-unit') === '1776', 'unit auto-detected on both tabs');
  ok(await page.inputValue('#bcp-council') === 'Seeded Council', 'council saved on the Pocket tab pre-fills an empty Blue Card box');
  await page.fill('#mbc-council', 'Edited Council'); await page.dispatchEvent('#mbc-council', 'change');
  ok(await page.inputValue('#bcp-council') === 'Edited Council', 'editing council on Pocket tab updates Blue Card tab');
  await page.click('#mbt-tab-blue');
  await page.fill('#bcp-unit', '4321'); await page.dispatchEvent('#bcp-unit', 'change');
  await page.click('#mbt-tab-pocket');
  ok(await page.inputValue('#mbc-unit') === '4321', 'editing unit on Blue Card tab updates Pocket tab');
  await page.click('#mbt-tab-blue');
  ok(await page.evaluate(() => localStorage.getItem('bcpCouncil')) === 'Edited Council', 'Blue Card persisted the mirrored value (no infinite change loop)');
  ok(await page.inputValue('#bcp-district') === '', 'unshared fields (district) are untouched');
  const setVal = (sel, v) => page.evaluate(([q, x]) => { const e = document.querySelector(q); e.value = x; e.dispatchEvent(new Event('change')); }, [sel, v]);
  ok(await page.inputValue('#mbc-leadertitle') === 'Scoutmaster' && await page.inputValue('#bcp-leader-title') === 'Scoutmaster', 'leader title defaults agree on both tabs');
  await setVal('#bcp-leader-title', 'Assistant Scoutmaster');
  ok(await page.inputValue('#mbc-leadertitle') === 'Assistant Scoutmaster', 'leader title edited on Blue Cards mirrors to the Pocket tab');
  await page.click('#mbt-tab-pocket'); await page.click('#mbc-leader-detect');
  await page.waitForFunction(() => /Rosales/.test(document.getElementById('mbc-leader').value), null, { timeout: 15000 });
  ok(/Rosales/.test(await page.inputValue('#mbc-leader')), 'Pocket tab "Detect" uses the title set on the Blue Cards tab (found the Assistant Scoutmaster)');
  await setVal('#mbc-adultdirid', '46099');
  ok(await page.inputValue('#bcp-adultdirid') === '46099', 'Adult Directory Menu_Item_ID is shared too');
  await page.click('#mbt-tab-blue');
  await browser.close(); srv.close();

  console.log('== 4. Pocket Certificates workflow inside the combined page');
  ({ srv, browser, page, errs } = await boot());
  await page.click('#mbc-load-btn'); await page.waitForSelector('#mbc-results-card:not(.mbc-hidden)', { timeout: 20000 });
  const pst = await txt(page, '#mbc-load-status'); console.log('     ', pst);
  ok(/Loaded 8 award rows, 6 of them Merit Badges/.test(pst), 'award report loaded; only Merit Badge rows kept');
  await page.waitForFunction(() => document.getElementById('mbc-leader').value !== '', null, { timeout: 15000 });
  ok(/Fernsby/.test(await page.inputValue('#mbc-leader')), 'Unit Leader auto-detected from the Adult Directory: "' + await page.inputValue('#mbc-leader') + '"');
  const pf = await download(page, '#mbc-gen-btn');
  ok(pages(pf) >= 1 && /Alder|Jamie/.test(pdftext(pf)), 'pocket-certificate PDF generated, contains a synthetic Scout name (' + pages(pf) + ' page)');
  await page.check('#mbc-blankmode');
  const pfb = await download(page, '#mbc-gen-btn');
  ok(pages(pfb) >= 1 && /Alder|Jamie/.test(pdftext(pfb)) && fs.statSync(pfb).size < fs.statSync(pf).size, 'pre-printed cardstock mode: valid, contains the name, and smaller (data only, no artwork)');
  ok(!(await vis(page, '#bcp-root')), 'blue card tool stayed hidden the whole time');
  ok(errs.length === 0, 'no errors (' + errs.join(' | ') + ')');
  await browser.close(); srv.close();

  console.log('== 5. Blue Cards workflow inside the combined page');
  ({ srv, browser, page, errs } = await boot({ hash: '#blue' }));
  ok(await vis(page, '#bcp-root'), 'opened directly on the Blue Cards tab via #blue');
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)', { timeout: 20000 });
  const bst = await txt(page, '#bcp-load-status'); console.log('     ', bst);
  ok(/Loaded 15 unfinished merit badges for 8 Scouts/.test(bst), 'export ran through the real POST -> 302 -> CSV path');
  ok(srv.state.posts.length === 1 && srv.state.posts[0].some(p => p.name === 'Selected_Button_ID' && p.value === 'BUTTON7'), 'export POST carried BUTTON7');
  const bf = await download(page, '#bcp-gen-btn');
  ok(pages(bf) === 16 && /Lindqvist/.test(pdftext(bf)), 'blue card PDF generated (16 pages = 8 double-sided sheets)');
  ok(execSync('qpdf --check "' + bf + '" 2>&1').toString().includes('No syntax or stream encoding errors'), 'qpdf --check clean');
  await page.click('#mbt-tab-pocket');
  ok(await vis(page, '#mbc-root') && !(await vis(page, '#bcp-root')), 'switching back to Pocket works after generating');
  await page.click('#mbt-tab-blue'); ok(await vis(page, '#bcp-results-card') && (await page.locator('tr.bcp-row').count()) === 15, 'Blue Cards tab kept its loaded table while hidden');
  ok(errs.length === 0, 'no errors (' + errs.join(' | ') + ')');
  await browser.close(); srv.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  fs.rmSync(OUT, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
