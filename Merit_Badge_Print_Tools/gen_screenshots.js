/* Screenshots for the README -- synthetic data only (fixtures + fake server
   from ../Blue_Card). Run from this folder: node gen_screenshots.js
   Requires: npm i playwright pdf-lib xlsx                                   */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BLUE = path.join(__dirname, '..', 'Blue_Card'), POCKET = path.join(__dirname, '..', 'Merit_Badge_Pocket_Cert');
const create = require(path.join(BLUE, 'fake_twh.js')); const fx = require(path.join(BLUE, 'fixtures.js'));
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const sheetjs = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
const OUT = path.join(__dirname, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const AW = [['Alder, Jamie R','Merit Badge','Camping*','6/2/2026'],['Alder, Jamie R','Merit Badge','First Aid*','6/2/2026'],['Brannigan, Cole T','Merit Badge','Archery','5/20/2026'],['Castellano, Ren A','Merit Badge','American Business','4/11/2026'],['Delgado, Skyler M','Merit Badge','Space Exploration','5/2/2026']];
const report = () => '<html><body><form id="easyform" action="FormDetail.aspx" method="post"><table class="table-striped"><thead><tr><th>Adult</th><th>Scout</th><th>Patrol</th><th>Type</th><th>Award</th><th>Earned</th><th>Awarded</th><th>COH</th><th>Council</th></tr></thead><tbody>' + AW.map(r => '<tr><td>No</td><td>'+r[0]+'</td><td>Hawk</td><td>'+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td><td></td><td></td><td></td></tr>').join('') + '</tbody></table></form></body></html>';
async function session(bg) {
  const srv = await create({ toolPath: path.join(__dirname, 'merit-badge-print-tools.html'), exportHtml: fx.exportHtml(), csv: fx.csv(), scoutDir: fx.scoutDir(), adultDir: fx.adultDir(), templatePath: path.join(BLUE, 'blue-card-template.pdf'), bg });
  const orig = srv.server.listeners('request')[0]; srv.server.removeAllListeners('request');
  srv.server.on('request', (req, res) => { const u = new URL(req.url, 'http://x');
    if (u.pathname === '/FormDetail.aspx' && u.searchParams.get('Menu_Item_ID') === '45952') { req.on('data', () => {}); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(report()); }); return; }
    orig(req, res); });
  const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 } })).newPage();
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ body: pdflib, contentType: 'application/javascript' }));
  await page.route('https://cdn.sheetjs.com/**', r => r.fulfill({ body: sheetjs, contentType: 'application/javascript' }));
  await page.goto('http://127.0.0.1:' + srv.port + '/Custom.aspx');
  return { srv, browser, page };
}
(async () => {
  let s = await session('#1b2233');
  await s.page.click('#mbc-load-btn'); await s.page.waitForSelector('#mbc-results-card:not(.mbc-hidden)');
  await s.page.waitForFunction(() => document.getElementById('mbc-leader').value !== ''); await s.page.fill('#mbc-council', 'Example Council');
  await s.page.locator('#mbt-root').screenshot({ path: path.join(OUT, '01-pocket-tab.png') });
  await s.page.click('#mbt-tab-blue'); await s.page.click('#bcp-load-btn'); await s.page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await s.page.locator('#mbt-root').screenshot({ path: path.join(OUT, '02-blue-card-tab.png') });
  await s.browser.close(); s.srv.close();
  s = await session('#fbf8f0');
  await s.page.click('#mbt-tab-blue'); await s.page.screenshot({ path: path.join(OUT, '03-light-theme.png'), clip: { x: 0, y: 0, width: 1180, height: 520 } });
  await s.browser.close(); s.srv.close();
  console.log('screenshots written to', OUT);
})().catch(e => { console.error(e); process.exit(1); });
