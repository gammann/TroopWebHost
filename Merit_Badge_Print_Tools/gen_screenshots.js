/* Screenshots for the README -- synthetic data only (src/fixtures.js and
   the local TroopWebHost stand-in src/fake_twh.js). Every name, address,
   and email below is invented.
   Run from this folder: node gen_screenshots.js
   Requires: npm i playwright pdf-lib xlsx ; pdftoppm (poppler, optional --
   the rendered-PDF images are skipped with a warning if it's missing)    */
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const SRC = path.join(__dirname, 'src');
const create = require(path.join(SRC, 'fake_twh.js'));
const fx = require(path.join(SRC, 'fixtures.js'));
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const sheetjs = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
const BLUE_TEMPLATE = fs.readFileSync(path.join(SRC, 'blue-card-template.pdf'));
const POCKET_TEMPLATE = fs.readFileSync(path.join(SRC, 'merit-badge-pocket-cert-template.pdf'));
const OUT = path.join(__dirname, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });

const AW = [['Alder, Jamie R', 'Merit Badge', 'Camping*', '6/2/2026'], ['Alder, Jamie R', 'Merit Badge', 'First Aid*', '6/2/2026'],
  ['Brannigan, Cole T', 'Merit Badge', 'Archery', '5/20/2026'], ['Castellano, Ren A', 'Merit Badge', 'American Business', '4/11/2026'],
  ['Delgado, Skyler M', 'Merit Badge', 'Space Exploration', '5/2/2026']];
const report = () => '<html><body><form id="easyform" action="FormDetail.aspx" method="post"><table class="table-striped"><thead><tr><th>Adult</th><th>Scout</th><th>Patrol</th><th>Type</th><th>Award</th><th>Earned</th><th>Awarded</th><th>COH</th><th>Council</th></tr></thead><tbody>' +
  AW.map(r => '<tr><td>No</td><td>' + r[0] + '</td><td>Hawk</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td></td><td></td><td></td></tr>').join('') + '</tbody></table></form></body></html>';

async function session(bg, hash) {
  const srv = await create({ toolPath: path.join(__dirname, 'merit-badge-print-tools.html'), exportHtml: fx.exportHtml(), csv: fx.csv(), scoutDir: fx.scoutDir(), adultDir: fx.adultDir(), templatePath: path.join(SRC, 'blue-card-template.pdf'), bg });
  const orig = srv.server.listeners('request')[0]; srv.server.removeAllListeners('request');
  srv.server.on('request', (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/FormDetail.aspx' && u.searchParams.get('Menu_Item_ID') === '45952') { req.on('data', () => {}); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(report()); }); return; }
    orig(req, res);
  });
  const browser = await chromium.launch(); const page = await (await browser.newContext({ acceptDownloads: true, viewport: { width: 1180, height: 900 } })).newPage();
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ body: pdflib, contentType: 'application/javascript' }));
  await page.route('https://cdn.sheetjs.com/**', r => r.fulfill({ body: sheetjs, contentType: 'application/javascript' }));
  await page.route('https://mediafiles.scoutshop.org/**', r => r.fulfill({ body: POCKET_TEMPLATE, contentType: 'application/pdf', headers: { 'access-control-allow-origin': '*' } }));
  await page.route('https://raw.githubusercontent.com/**', r => r.fulfill({ body: r.request().url().indexOf('Pocket') !== -1 ? POCKET_TEMPLATE : BLUE_TEMPLATE, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('http://127.0.0.1:' + srv.port + '/Custom.aspx' + (hash || ''));
  return { srv, browser, page };
}
async function download(page, btn) { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(btn)]); const f = path.join(OUT, '_' + d.suggestedFilename()); await d.saveAs(f); return f; }
// Renders pages 1..count of pdfFile and returns their final paths as
// outBase-1.png, outBase-2.png, ... (poppler pads the number to match the
// SOURCE document's total page count, not the printed range, so results
// are renamed to a fixed, predictable pattern here).
function renderFirstPages(pdfFile, outBase, count) {
  try {
    execSync('pdftoppm -r 110 -f 1 -l ' + count + ' -png "' + pdfFile + '" "' + path.join(OUT, outBase) + '"');
  } catch (e) { console.warn('  pdftoppm not available -- skipped ' + outBase); return []; }
  const made = fs.readdirSync(OUT).filter(f => f.startsWith(outBase + '-') && f.endsWith('.png')).sort();
  const out = [];
  made.forEach((f, i) => { const dest = outBase + '-' + (i + 1) + '.png'; if (f !== dest) fs.renameSync(path.join(OUT, f), path.join(OUT, dest)); out.push(dest); });
  return out;
}

(async () => {
  console.log('writing screenshots to', OUT);

  let s = await session('#1b2233');
  await s.page.click('#mbc-load-btn'); await s.page.waitForSelector('#mbc-results-card:not(.mbc-hidden)');
  await s.page.waitForFunction(() => document.getElementById('mbc-leader').value !== '');
  await s.page.fill('#mbc-council', 'Example Council'); await s.page.dispatchEvent('#mbc-council', 'change');
  await s.page.locator('#mbt-root').screenshot({ path: path.join(OUT, '01-pocket-tab.png') });
  const pf = await download(s.page, '#mbc-gen-btn');
  if (renderFirstPages(pf, 'pocket-sample', 1)[0]) fs.renameSync(path.join(OUT, 'pocket-sample-1.png'), path.join(OUT, '02-pocket-sample.png'));
  await s.page.check('#mbc-blankmode');
  const pfb = await download(s.page, '#mbc-gen-btn');
  if (renderFirstPages(pfb, 'pocket-blank-sample', 1)[0]) fs.renameSync(path.join(OUT, 'pocket-blank-sample-1.png'), path.join(OUT, '03-pocket-blankmode-sample.png'));
  await s.browser.close(); s.srv.close();

  s = await session('#1b2233', '#blue');
  await s.page.click('#bcp-load-btn'); await s.page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await s.page.locator('#mbt-root').screenshot({ path: path.join(OUT, '04-blue-card-tab.png') });
  const bf = await download(s.page, '#bcp-gen-btn');
  const bfPages = renderFirstPages(bf, 'blue-sample', 2);
  if (bfPages[0]) fs.renameSync(path.join(OUT, 'blue-sample-1.png'), path.join(OUT, '05-blue-card-sample-front.png'));
  if (bfPages[1]) fs.renameSync(path.join(OUT, 'blue-sample-2.png'), path.join(OUT, '06-blue-card-sample-back.png'));
  await s.page.selectOption('#bcp-layout', '3');
  const b3 = await download(s.page, '#bcp-gen-btn');
  if (renderFirstPages(b3, 'blue-3up', 1)[0]) fs.renameSync(path.join(OUT, 'blue-3up-1.png'), path.join(OUT, '07-blue-card-three-up.png'));
  await s.browser.close(); s.srv.close();

  s = await session('#fbf8f0', '#blue');
  await s.page.screenshot({ path: path.join(OUT, '08-light-theme.png'), clip: { x: 0, y: 0, width: 1180, height: 520 } });
  await s.browser.close(); s.srv.close();

  fs.readdirSync(OUT).filter(f => f.startsWith('_')).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  console.log('done:', fs.readdirSync(OUT).sort().join(', '));
})().catch(e => { console.error(e); process.exit(1); });
