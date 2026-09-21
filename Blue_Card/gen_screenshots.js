/* Generates the README screenshots for the Blue Card Printer using ONLY
   synthetic data (fixtures.js) served by a local stand-in for TroopWebHost
   (fake_twh.js). Requires: npm i playwright pdf-lib ; poppler's pdftoppm
   (only for the two card-render images).
   Run from this folder:  node gen_screenshots.js                        */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const create = require('./fake_twh'); const fx = require('./fixtures.js');
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const OUT = path.join(__dirname, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
async function session(bg, title){
  const srv = await create({ toolPath: path.join(__dirname,'blue-card.html'), exportHtml: fx.exportHtml(), csv: fx.csv(), scoutDir: fx.scoutDir(), adultDir: fx.adultDir(), templatePath: path.join(__dirname,'blue-card-template.pdf'), bg, title });
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport:{ width:1180, height:900 }, acceptDownloads:true, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ body: pdflib, contentType:'application/javascript' }));
  await page.route('https://raw.githubusercontent.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname,'blue-card-template.pdf')), contentType:'text/plain', headers:{'access-control-allow-origin':'*'} }));
  await page.goto('http://127.0.0.1:'+srv.port+'/Custom.aspx');
  return { srv, browser, page };
}
(async () => {
  let s = await session('#1b2233');
  await s.page.fill('#bcp-district','Sample District'); await s.page.fill('#bcp-council','Example Council');
  await s.page.screenshot({ path: path.join(OUT,'01-settings-and-load.png'), fullPage:true });
  await s.page.click('#bcp-load-btn'); await s.page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await s.page.locator('.bcp-grp-cb').nth(3).uncheck();
  await s.page.screenshot({ path: path.join(OUT,'02-choose-cards.png'), fullPage:true });
  const [d] = await Promise.all([ s.page.waitForEvent('download'), s.page.click('#bcp-gen-btn') ]);
  const pdf = path.join(OUT,'sample-output.pdf'); await d.saveAs(pdf);
  await s.page.waitForTimeout(300);
  await s.page.locator('#bcp-gen-card').screenshot({ path: path.join(OUT,'03-generate-done.png') });
  try{
    execSync('pdftoppm -r 110 -f 1 -l 2 -png "'+pdf+'" "'+path.join(OUT,'render')+'"');
    for(const [n,name] of [['1','05-sample-front'],['2','06-sample-back']]){
      const f = fs.readdirSync(OUT).find(x => /^render-0?\d\.png$/.test(x) && parseInt(x.replace(/\D/g,''),10)===parseInt(n,10));
      if(f){ fs.renameSync(path.join(OUT,f), path.join(OUT,name+'.png')); }
    }
  }catch(e){ console.warn('pdftoppm not available -- skipped card render images'); }
  fs.unlinkSync(pdf);
  await s.browser.close(); s.srv.close();
  s = await session('#fbf8f0');
  await s.page.click('#bcp-load-btn'); await s.page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await s.page.screenshot({ path: path.join(OUT,'04-light-theme.png'), fullPage:true });
  await s.browser.close(); s.srv.close();
  console.log('screenshots written to', OUT);
})().catch(e => { console.error(e); process.exit(1); });
