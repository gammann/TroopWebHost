/* Merit Badge Print Tools -- full test suite (this is the only test file;
   there is no longer a separate Blue_Card or Merit_Badge_Pocket_Cert repo
   folder to hold its own tests, so everything lives here).

   Part 1: unit tests of the Blue Cards tab's pure logic (extracted from
           src/blue-card.html between its BEGIN/END PURE LOGIC markers --
           no DOM, no network).
   Part 2: static checks on the generated file, including that it is
           byte-identical to a fresh rebuild from src/.
   Part 3: end-to-end tests in headless Chromium against a local stand-in
           for TroopWebHost (src/fake_twh.js, which issues genuine 302s),
           covering tabs, shared settings, and a full workflow -- including
           every edge case -- on EACH tab inside the one page.

   ALL data is synthetic (src/fixtures.js and the AWARDS table below).
   Requires: npm i playwright pdf-lib xlsx ; qpdf, pdftotext, pdftoppm (poppler).
   Run from this folder:  node test.js                                    */
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const { execSync } = require('child_process');
const SRC = path.join(__dirname, 'src');
const HTML = path.join(__dirname, 'merit-badge-print-tools.html');
const BLUE_TEMPLATE = fs.readFileSync(path.join(SRC, 'blue-card-template.pdf'));
const POCKET_TEMPLATE = fs.readFileSync(path.join(SRC, 'merit-badge-pocket-cert-template.pdf'));
const fx = require(path.join(SRC, 'fixtures.js'));
const create = require(path.join(SRC, 'fake_twh.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };

/* ================= Part 1: pure logic (Blue Cards tab) ================= */
console.log('== 1. unit tests (pure logic)');
const blueSrc = fs.readFileSync(path.join(SRC, 'blue-card.html'), 'utf8');
const pureLogic = blueSrc.slice(blueSrc.indexOf('/* BEGIN PURE LOGIC */'), blueSrc.indexOf('/* END PURE LOGIC */'));
const api = new Function(pureLogic + '\nreturn {bcpParseCsv,bcpCsvObjects,bcpBuildCards,bcpBuildCells,bcpBuildPieces,bcpFmtDate,bcpCityStateZip,bcpDirKey,bcpFindByName,bcpHasLeadership,bcpDisplayName,BCP_GRID_SLOTS};')();
const P = (t, m) => api.bcpBuildPieces(t.split(';'), m || 'compact');
eq(P('01.a;01.b;01.c;01.d;01.e;01.f;01.g'), ['1a-g']);
eq(P('02.;02.a;02.b'), ['2'], 'parent listed -> children folded');
eq(P('03.;04.a;04.b;05.a;05.c'), ['3', '4a-b', '5a,c']);
eq(P('09.b.1;09.b.3;09.b.4'), ['9b(1,3-4)']);
eq(P('2.b;2.b.01;2.b.02'), ['2b']);
eq(P('2A.a;2A.b;2A.c'), ['2A.a-c']);
eq(P('5.B.a;5.B.b'), ['5B.a-b']);
eq(P('11.;12.;13.;14.'), ['11-14']);
eq(P('11.;12.'), ['11', '12']);
eq(P('10.;2.;1.'), ['1', '2', '10'], 'natural sort');
eq(P('01.a;01.b', 'full'), ['1a', '1b']);
eq(P('9.b.3', 'full'), ['9b(3)']);
eq(P('1.a;1.a;01.a'), ['1a'], 'dedupe');
eq(P(''), []);
eq(api.bcpParseCsv('a,b\r\n"x,1","he said ""hi"""\r\n\r\n'), [['a', 'b'], ['x,1', 'he said "hi"']]);
eq(api.bcpParseCsv('\uFEFFa,b\n1,2')[0], ['a', 'b'], 'BOM stripped');
eq(api.bcpFmtDate('1/28/2024 12:00:00 AM'), '1/28/2024');
eq(api.bcpFmtDate('5/19/2024 11:59:00 PM'), '5/19/2024', 'late-evening stamp keeps its date');
eq(api.bcpCityStateZip('Springfield', 'VA', ''), 'Springfield, VA');
eq(api.bcpCityStateZip('', '', '20147'), '20147');
const ents = ['Marlowe, Jesse Q', 'Van Der Berg, Jan "Johnny"', "O'Neill, Wren", 'Smith, Pat', 'Smith, Pat'].map(n => ({ key: api.bcpDirKey(n), row: { Name: n } }));
eq(api.bcpFindByName('Jesse Quinn Marlowe', ents).row.Name, 'Marlowe, Jesse Q');
eq(api.bcpFindByName('Johnny Van Der Berg', ents).row.Name, 'Van Der Berg, Jan "Johnny"', 'nickname + multi-word surname');
eq(api.bcpFindByName('Wren Avery ONeill', ents).row.Name, "O'Neill, Wren", 'apostrophe ignored');
eq(api.bcpFindByName('Pat Smith', ents), null, 'ambiguous match -> null (never guess)');
eq(api.bcpFindByName('Zed Nobody', ents), null);
eq(api.bcpHasLeadership('Assistant Scoutmaster', 'Scoutmaster'), false, 'exact-token leadership match');
eq(api.bcpHasLeadership('Scoutmaster, Committee Member', 'Scoutmaster'), true);
{ // fixtures through the real pipeline
  const { headers, objects } = api.bcpCsvObjects(fx.csv());
  const c = api.bcpBuildCards(headers, objects, 'compact');
  eq(c.length, 15, 'fixture rows -> 15 cards');
  eq(c.find(x => x.badge === 'First Aid').all.join('; '), '1a-g; 2; 3; 4a-b; 7a-g; 8a-d; 9-12');
  eq(c.find(x => x.badge === 'Camping').all.join('; '), '1a-c; 2; 3; 4a-b; 5a-c; 6a; 7a-b; 8b; 9a; 9b(3); 10');
  ok(c.every(x => x.overflow.length === 0), 'compact mode: no fixture card overflows the 22 columns');
  const f = api.bcpBuildCards(headers, objects, 'full');
  ok(f.some(x => x.overflow.length > 0), 'full mode: at least one card overflows into Remarks');
}
console.log('  ' + pass + ' unit assertions passed');

/* ================= Part 2: static checks on the generated file ================= */
console.log('== 2. generated file');
const html = fs.readFileSync(HTML, 'utf8');
const ids = (html.match(/\bid="([^"]+)"/g) || []).map(s => s.slice(4, -1));
ok(new Set(ids).size === ids.length, 'every element id is unique (' + ids.length + ' ids)');
ok((html.match(/pdf-lib\.min\.js/g) || []).length === 1, 'pdf-lib is loaded exactly once');
ok((html.match(/xlsx\.full\.min\.js/g) || []).length === 1, 'SheetJS (needed by the Pocket tab) is loaded exactly once');
ok(!/[^\x00-\x7F]/.test(html), 'pure ASCII');
ok(!/<form/i.test(html.replace(/<!--[\s\S]*?-->/, '').replace(/<script[\s\S]*?<\/script>/g, '')), 'no <form> element in the page markup (outside scripts)');
ok(/id="mbc-root"/.test(html) && /id="bcp-root"/.test(html) && /id="mbt-root"/.test(html), 'both tool roots and the tab wrapper are present');
{
  const tmp = path.join(os.tmpdir(), 'mbt-rebuild-' + process.pid + '.html');
  execSync('node "' + path.join(__dirname, 'build.js') + '" --out "' + tmp + '"', { stdio: 'pipe' });
  ok(fs.readFileSync(tmp, 'utf8') === html, 'checked-in page is up to date with src/ (rebuild is byte-identical)');
  fs.unlinkSync(tmp);
  const strip = s => s.replace(/^\s*<!--[\s\S]*?-->\s*/, '').replace(/<script\s+src="[^"]+"[^>]*>\s*<\/script>\s*/g, '');
  ok(html.includes(strip(blueSrc).trim().split('<script>')[0].trim()), 'Blue Card markup embedded unmodified');
  ok(html.includes(strip(fs.readFileSync(path.join(SRC, 'merit-badge-pocket-cert.html'), 'utf8')).trim().split('<script>')[0].trim()), 'Pocket Certificate markup embedded unmodified');
}

/* ================= Part 3: end to end ================= */
const { chromium } = require('playwright');
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const sheetjs = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'mbt-test-'));

/* synthetic Award Report for the Pocket Certificate tab */
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

async function boot(o = {}) {
  const srv = await create(Object.assign({ toolPath: HTML, exportHtml: fx.exportHtml(), csv: fx.csv(), scoutDir: fx.scoutDir(), adultDir: fx.adultDir(), templatePath: path.join(SRC, 'blue-card-template.pdf') }, o.srv || {}));
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
  await page.route('https://raw.githubusercontent.com/**', r => {
    const u = r.request().url();
    if (u.indexOf('Pocket') !== -1) return r.fulfill({ body: POCKET_TEMPLATE, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' } });
    if (o.pdfBad) return r.abort();
    if (o.pdfStale404) {
      if (u.indexOf('v=') === -1) return r.fulfill({ status: 404, body: '404: Not Found', contentType: 'text/plain' });
      return r.fulfill({ body: BLUE_TEMPLATE, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' } });
    }
    return r.fulfill({ body: BLUE_TEMPLATE, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('http://127.0.0.1:' + srv.port + '/Custom.aspx' + (o.hash || ''));
  return { srv, browser, page, errs, url: 'http://127.0.0.1:' + srv.port + '/Custom.aspx' };
}
const vis = (p, sel) => p.locator(sel).isVisible();
const txt = async (p, sel) => (await p.textContent(sel)).replace(/\s+/g, ' ').trim();
const pages = f => +execSync('qpdf --show-npages "' + f + '"').toString().trim();
const pdftext = (f, p) => p ? execSync('pdftotext -f ' + p + ' -l ' + p + ' -layout "' + f + '" -').toString() : execSync('pdftotext -layout "' + f + '" -').toString();
const cnt = (t, re) => (t.match(re) || []).length;
async function download(page, btn) { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(btn)]); const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return f; }
// 72-dpi greyscale render -> bounding box of the "ink" (1 px = 1 pt)
function inkBox(file, page) {
  const pre = path.join(OUT, 'ink' + page + '-' + Date.now());
  execSync('pdftoppm -r 72 -gray -f ' + page + ' -l ' + page + ' "' + file + '" "' + pre + '"');
  const f = fs.readdirSync(OUT).find(x => x.startsWith(path.basename(pre)) && x.endsWith('.pgm'));
  const buf = fs.readFileSync(path.join(OUT, f)); fs.unlinkSync(path.join(OUT, f));
  const m = buf.toString('latin1', 0, 30).match(/^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/); const w = +m[1], h = +m[2], off = m[0].length;
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[off + y * w + x] < 200) { if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x; }
  return { w, h, top, bottom: h - 1 - bottom, left, right: w - 1 - right };
}
const MIN = 17; // 0.25 in = 18 pt, less 1 px of rounding

(async () => {
  console.log('== 3. tabs');
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
  ok(errs.length === 0, 'no page or console errors (' + errs.join(' | ') + ')');
  await browser.close(); srv.close();

  console.log('== 4. shared Unit / Council / Adult Directory / Leader title settings');
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
  await browser.close(); srv.close();

  console.log('== 5. Pocket Certificates workflow');
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

  console.log('== 6. Blue Cards workflow: happy path, enrichment, selection, both name panels');
  ({ srv, browser, page, errs } = await boot({ hash: '#blue' }));
  ok(await vis(page, '#bcp-root'), 'opened directly on the Blue Cards tab via #blue');
  ok(await page.inputValue('#bcp-unit') === '1776', 'unit number auto-detected from page title');
  ok(await page.inputValue('#bcp-since') === (new Date().getFullYear() - 6) + '-01-01', 'started-since defaults to Jan 1 six years back');
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)', { timeout: 20000 });
  const bst = await txt(page, '#bcp-load-status'); console.log('     ', bst);
  ok(/Loaded 15 unfinished merit badges for 8 Scouts/.test(bst), '15 badges / 8 scouts loaded');
  ok(/Scout emails found for 4 of 8/.test(bst), '4 of 8 scout emails matched (incl. Email #2 fallback)');
  ok(/2 assigned counselor\(s\) matched/.test(bst), '2 counselors matched (unlisted one skipped)');
  ok(await page.inputValue('#bcp-leader-email') === 'scoutmaster@example.com', 'leader email = Scoutmaster (not Assistant Scoutmaster)');
  const post = srv.state.posts[0]; const g = n => (post.find(p => p.name === n) || {}).value;
  ok(g('ENTRY9999001') === (new Date().getFullYear() - 6) + '/01/01' || /^01\/01\/\d{4}$/.test(g('ENTRY9999001')), 'POST carried the chosen date (MM/DD/YYYY): ' + g('ENTRY9999001'));
  ok(g('Selected_Button_ID') === 'BUTTON7' && g('Selected_Action') === 'save continue', 'POST used BUTTON7 / "save continue"');
  ok(g('Report_option') === '2' && g('Page_Layout') === '1', 'radio defaults preserved in POST');
  ok(!post.some(p => p.name === 'BUTTON12'), 'awards-file button not submitted');
  await page.fill('#bcp-filter', 'cook'); ok(await page.locator('tr.bcp-row:not(.bcp-hidden)').count() === 2, 'filter "cook" shows 2 rows');
  await page.click('#bcp-select-none'); ok(/13 of 15 selected/.test(await txt(page, '#bcp-count')), 'select-none acts on visible rows only');
  await page.fill('#bcp-filter', '');
  await page.locator('.bcp-grp-cb').first().uncheck(); ok(/10 of 15|11 of 15/.test(await txt(page, '#bcp-count')), 'scout group checkbox toggles all of a scout\'s rows');
  await page.click('#bcp-select-all');
  ok(/15 of 15 selected . 8 sheets/.test(await txt(page, '#bcp-count')), '15 cards -> 8 sheets at 2-up');
  let d = await download(page, '#bcp-gen-btn');
  ok(path.basename(d) === 'Blue_Cards.pdf', 'multi-card filename is Blue_Cards.pdf');
  ok(pages(d) === 16, '2-up: 8 sheets x (front+back) = 16 pages');
  const all = pdftext(d); const t1 = pdftext(d, 1);
  ok(/Avery Jordan Lindqvist/.test(all) && /Emerson Quinn Halvorsen/.test(all), 'scout names printed');
  ok(/First Aid/.test(pdftext(d, 2)) || /First Aid/.test(all), 'badge printed');
  ok(/1776/.test(t1) && /scoutmaster@example\.com/.test(t1), 'unit number and leader email printed');
  ok(/avery\.sample@example\.com/.test(all) && /casey\.alt@example\.com/.test(all), 'scout emails printed (incl. Email #2 fallback)');
  ok(/Morgan Ellery/.test(pdftext(d, 2) + pdftext(d, 4) + pdftext(d, 6)), 'counselor name printed');
  ok(/400 Counselor Court, Suite 2/.test(all), 'counselor address (line1 + line2) printed');
  ok(execSync('pdftoppm -r 20 -png "' + d + '" "' + path.join(OUT, 'chk') + '" 2>&1 || true').toString().trim() === '', 'poppler renders with zero warnings');
  ok(execSync('qpdf --check "' + d + '" 2>&1').toString().includes('No syntax or stream encoding errors'), 'qpdf --check clean');
  await page.selectOption('#bcp-layout', '1'); await page.click('#bcp-select-none');
  await page.locator('tr.bcp-row', { hasText: 'Photography' }).locator('.bcp-row-cb').check();
  d = await download(page, '#bcp-gen-btn');
  ok(/^Avery Jordan Lindqvist Photography 1776\.pdf$/.test(path.basename(d)), 'single-card filename: "<Scout> <Badge> <Unit>.pdf"');
  ok(pages(d) === 2, '1-up single card = 2 pages');
  await page.selectOption('#bcp-reqmode', 'full'); await page.click('#bcp-select-none');
  await page.locator('tr.bcp-row', { hasText: 'First Aid' }).first().locator('.bcp-row-cb').check();
  ok(await page.locator('.bcp-chip').count() >= 1, 'overflow chip shown in the table in "as recorded" mode');
  d = await download(page, '#bcp-gen-btn');
  ok(/Also completed/.test(pdftext(d, 2)), 'overflow requirements written into the Remarks box');
  ok(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
  await browser.close(); srv.close();

  console.log('== 7. Blue Cards: access denied on the initial GET');
  ({ srv, browser, page } = await boot({ hash: '#blue', srv: { denyExport: true } }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('.bcp-restricted');
  ok(/Restricted/.test(await txt(page, '#bcp-load-status')), 'GET redirect -> friendly "Restricted" message');
  ok(srv.state.posts.length === 0, 'no POST attempted'); await browser.close(); srv.close();

  console.log('== 8. Blue Cards: POST redirects somewhere other than FormCSV.aspx');
  ({ srv, browser, page } = await boot({ hash: '#blue', srv: { postRedirectsElsewhere: true } }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('.bcp-restricted');
  ok(true, 'POST redirect elsewhere -> "Restricted" (not treated as success)'); await browser.close(); srv.close();

  console.log('== 9. Blue Cards: directories denied -- cards still load, notes shown');
  ({ srv, browser, page } = await boot({ hash: '#blue', srv: { denyDirs: true } }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  const s9 = await txt(page, '#bcp-load-status'); console.log('     ', s9);
  ok(/Loaded 15/.test(s9) && /Scout Directory not available/.test(s9) && /Adult Directory not available/.test(s9), 'graceful degradation with clear notes');
  await browser.close(); srv.close();

  console.log('== 10. Blue Cards: CSV upload path + empty result + wrong file');
  ({ srv, browser, page } = await boot({ hash: '#blue' }));
  fs.writeFileSync(path.join(OUT, 'up.csv'), fx.csv());
  await page.setInputFiles('#bcp-csv-file', path.join(OUT, 'up.csv')); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  ok(/Loaded 15/.test(await txt(page, '#bcp-load-status')), 'uploaded CSV loads');
  fs.writeFileSync(path.join(OUT, 'hdr.csv'), 'ScoutName,MeritBadge,DateStarted,ScoutAddress,ScoutCity,ScoutState,ScoutZip,CounselorName,CompletedRequirements\r\n');
  await page.setInputFiles('#bcp-csv-file', path.join(OUT, 'hdr.csv')); await page.waitForTimeout(400);
  ok(/no unfinished merit badges/.test(await txt(page, '#bcp-load-status')), 'header-only CSV -> "no unfinished merit badges" message');
  fs.writeFileSync(path.join(OUT, 'bad.csv'), 'Foo,Bar\r\n1,2\r\n'); await page.setInputFiles('#bcp-csv-file', path.join(OUT, 'bad.csv')); await page.waitForTimeout(400);
  ok(/does not look like the Troop Awards/.test(await txt(page, '#bcp-load-status')), 'wrong CSV -> clear message');
  await browser.close(); srv.close();

  console.log('== 11. Blue Cards: template unreachable -> visible file box, generation retries by itself');
  ({ srv, browser, page } = await boot({ hash: '#blue', pdfBad: true }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  ok(await page.locator('#bcp-pdf-file').isVisible(), 'template file box is visible without opening anything');
  await page.click('#bcp-gen-btn'); await page.waitForFunction(() => /Could not generate/.test(document.getElementById('bcp-gen-status').textContent));
  ok(/Blank template/.test(await txt(page, '#bcp-gen-status')), 'error points at the "Blank template" box');
  ok(await page.locator('#bcp-pdf-file').isVisible(), 'file box still visible after the error');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.setInputFiles('#bcp-pdf-file', path.join(SRC, 'blue-card-template.pdf'))]);
  const f11 = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(f11);
  ok(pages(f11) >= 2, 'choosing a file generates the PDF automatically'); await browser.close(); srv.close();

  console.log('== 12. Blue Cards: stale 404 from the template host -> cache-busting retry succeeds');
  ({ srv, browser, page } = await boot({ hash: '#blue', pdfStale404: true }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  d = await download(page, '#bcp-gen-btn');
  ok(pages(d) >= 2, 'first request 404s, retry with ?v= succeeds -- no user action needed'); await browser.close(); srv.close();

  console.log('== 13. Blue Cards: three cards per sheet (reduced to 96%)');
  ({ srv, browser, page } = await boot({ hash: '#blue' }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await page.selectOption('#bcp-layout', '3');
  ok(/5 sheets/.test(await txt(page, '#bcp-count')), '15 cards -> 5 sheets at 3-up (count updates with the layout)');
  ok(/96%/.test(await txt(page, '#bcp-gen-hint')), 'hint explains the 96% reduction');
  d = await download(page, '#bcp-gen-btn');
  ok(pages(d) === 10, '3-up: 5 sheets x (front+back) = 10 pages');
  // (pdftotext also reads text clipped out of view, so count Scout names instead:
  //  each card prints its name once on the front, twice on the back)
  const nm = t => cnt(t, /Delacroix-Whitmore/g) + cnt(t, /Halvorsen/g);
  ok(nm(pdftext(d, 1)) === 3, 'front of sheet 1 holds 3 cards (3 names)');
  ok(nm(pdftext(d, 2)) === 6, 'back of sheet 1 holds the same 3 cards (2 name panels each)');
  const front = inkBox(d, 1), back = inkBox(d, 2);
  console.log('     ink margins (pt) front:', JSON.stringify(front), 'back:', JSON.stringify(back));
  ok(front.top >= MIN && front.bottom >= MIN && front.left >= MIN && front.right >= MIN, 'front: every edge clears a 0.25 in printer margin');
  ok(back.top >= MIN && back.bottom >= MIN && back.left >= MIN && back.right >= MIN, 'back: every edge clears a 0.25 in printer margin');
  ok(Math.abs(front.top - back.top) <= 1 && Math.abs(front.bottom - back.bottom) <= 1, 'front and back occupy the same vertical extent (duplex alignment)');
  ok(Math.abs(front.left - back.right) <= 2 && Math.abs(front.right - back.left) <= 2, 'front/back are horizontal mirrors of each other (long-edge flip)');
  await page.click('#bcp-select-none');
  for (const i of [0, 1, 2, 3]) await page.locator('.bcp-row-cb').nth(i).check();
  d = await download(page, '#bcp-gen-btn');
  ok(pages(d) === 4 && nm(pdftext(d, 1)) === 3 && nm(pdftext(d, 3)) === 1, '4 cards -> 2 sheets; the second sheet carries the single leftover card');
  ok(execSync('qpdf --check "' + d + '" 2>&1').toString().includes('No syntax or stream encoding errors'), '3-up PDF passes qpdf --check');
  await browser.close(); srv.close();

  console.log('== 14. Blue Cards: two-up margins (unchanged layout)');
  ({ srv, browser, page } = await boot({ hash: '#blue' }));
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  d = await download(page, '#bcp-gen-btn'); const f2 = inkBox(d, 1), b2 = inkBox(d, 2);
  ok(f2.top >= MIN && f2.bottom >= MIN && b2.top >= MIN && Math.abs(f2.top - b2.top) <= 1 && Math.abs(f2.bottom - b2.bottom) <= 1, '2-up: margins clear and front/back aligned');
  await browser.close(); srv.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  fs.rmSync(OUT, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
