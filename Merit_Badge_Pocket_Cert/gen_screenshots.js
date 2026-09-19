// Screenshot generator for the Merit Badge Pocket Certificate Filler --
// drives the ACTUAL shipped merit-badge-pocket-cert.html in headless
// Chromium against an in-memory fake TroopWebHost backend (synthetic
// data only, see the fixture data below -- no real names, dates, or
// troop numbers).
//
// Requires: playwright, and a real Chromium binary available to it
// (PLAYWRIGHT_BROWSERS_PATH env var, or a system-installed one
// Playwright can find). Run from this folder:
//   node gen_screenshots.js
// Output: ./screenshots/*.png (matching the README) plus
// ./screenshots/generated-sample.pdf and generated-sample-blankmode.pdf
// -- rasterize separately for the PDF screenshots, e.g.:
//   pdftoppm -png -r 150 -f 1 -l 1 screenshots/generated-sample.pdf screenshots/06-pdf-raw

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

// ---- Synthetic fixture data. No real names, no real troop numbers, no
// real locations -- entirely fictional, per repo convention. ----

// Award Report rows: "Last, First [Middle]" as TWH's own report renders
// it. Mix of Type=Merit Badge / Rank / Award, some Eagle-required badges
// carrying the trailing "*" TWH itself appends, and two Scouts sharing
// one Merit Badge date to show natural grouping.
var AWARD_ROWS = [
  { adult:'No', scout:'Alder, Jamie R',    patrol:'Hawk',   type:'Merit Badge', award:'Camping*',                earned:'6/2/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Alder, Jamie R',    patrol:'Hawk',   type:'Merit Badge', award:'First Aid*',              earned:'6/2/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Alder, Jamie R',    patrol:'Hawk',   type:'Rank',        award:'Star',                    earned:'5/1/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Brannigan, Cole T', patrol:'Fox',    type:'Merit Badge', award:'Archery',                 earned:'5/20/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Brannigan, Cole T', patrol:'Fox',    type:'Merit Badge', award:'Graphic Arts',            earned:'5/20/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Brannigan, Cole T', patrol:'Fox',    type:'Merit Badge', award:'Metalwork',               earned:'5/19/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Castellano, Ren A', patrol:'Fox',    type:'Merit Badge', award:'Citizenship in the World*',earned:'4/11/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Castellano, Ren A', patrol:'Fox',    type:'Merit Badge', award:'American Business',       earned:'4/11/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Castellano, Ren A', patrol:'Fox',    type:'Award',       award:'Totin\' Chip',            earned:'3/1/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Delgado, Skyler M', patrol:'Hawk',   type:'Merit Badge', award:'Space Exploration',       earned:'5/2/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Emerson, Piper L',  patrol:'Hawk',   type:'Merit Badge', award:'Camping*',                earned:'6/2/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Emerson, Piper L',  patrol:'Hawk',   type:'Merit Badge', award:'Swimming*',               earned:'5/28/2026', awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Fennimore, Tate J', patrol:'Wolf',   type:'Rank',        award:'Life',                    earned:'4/2/2026',  awarded:'', coh:'', council:'' },
  { adult:'No', scout:'Gallo, Wren S',     patrol:'Wolf',   type:'Merit Badge', award:'First Aid*',              earned:'5/14/2026', awarded:'', coh:'', council:'' },
  { adult:'Yes',scout:'Ibarra, Dana P',    patrol:'',       type:'Award',       award:'Scouter\'s Key',          earned:'2/2/2026',  awarded:'', coh:'', council:'' }
];

// Adult Directory export (single-GET FormReport.aspx CSV, confirmed
// column names: Name, Leadership, plus address/contact columns this
// tool never reads).
var ADULTS = [
  { name:'Ibarra, Dana P',   leadership:'Scoutmaster',              email:'dana.ibarra@example.com' },
  { name:'Jessup, Morgan K', leadership:'Assistant Scoutmaster',    email:'morgan.jessup@example.com' },
  { name:'Kowalski, Sam R',  leadership:'Committee Chair',          email:'sam.kowalski@example.com' }
];

function csvEscape(s){
  s = String(s == null ? '' : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function adultDirectoryCsv(){
  var header = ['Name','Leadership','Mailing Address Line 1','Mailing Address Line 2','City','State','Zip Code','Home Phone','Cell Phone','Business Phone','Email','Email #2'];
  var lines = [header.join(',')];
  ADULTS.forEach(function(a){
    lines.push([a.name, a.leadership, '123 Example St', '', 'Sampletown', 'VA', '20147', '', '', '', a.email, ''].map(csvEscape).join(','));
  });
  return lines.join('\r\n') + '\r\n';
}

function awardReportHtml(rows){
  var trs = rows.map(function(r){
    return '<tr>' +
      '<td>'+r.adult+'</td><td>'+r.scout+'</td><td>'+r.patrol+'</td><td>'+r.type+'</td>' +
      '<td>'+r.award+'</td><td>'+r.earned+'</td><td>'+r.awarded+'</td><td>'+r.coh+'</td><td>'+r.council+'</td>' +
      '</tr>';
  }).join('');
  return '<html><body>' +
    '<form enctype="multipart/form-data" action="FormDetail.aspx" method="post" name="easyform" id="easyform">' +
    '<input type="hidden" name="NewRowsPerPage" id="NewRowsPerPage" value="">' +
    '<input type="hidden" name="Menu_Item_ID" value="45952">' +
    '<input type="hidden" name="Form_ID" value="253">' +
    '<table class="table-striped table-bordered table-condensed table-curved sortable">' +
    '<thead><tr><th>Adult</th><th>Scout</th><th>Patrol</th><th>Type</th><th>Award</th><th>Earned</th><th>Awarded</th><th>COH</th><th>Council</th></tr></thead>' +
    '<tbody>'+trs+'</tbody></table>' +
    '</form></body></html>';
}

const TOOL_HTML_PATH = path.join(__dirname, 'merit-badge-pocket-cert.html');
const TEMPLATE_PDF_PATH = path.join(__dirname, 'merit-badge-pocket-cert-template.pdf');
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'https://sample-troop.troopwebhost.org';

fs.mkdirSync(OUT_DIR, { recursive: true });

function wrapPage(toolHtml){
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troop 1776 - Custom Page</title></head>' +
    '<body>' + toolHtml + '</body></html>';
}
function htmlResponse(body){ return { status: 200, contentType: 'text/html', body: body }; }

async function main(){
  const toolHtml = fs.readFileSync(TOOL_HTML_PATH, 'utf8');
  const templatePdfBytes = fs.readFileSync(TEMPLATE_PDF_PATH);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    const params = url.searchParams;

    if(pathname.endsWith('/CustomPage.aspx')){
      return route.fulfill(htmlResponse(wrapPage(toolHtml)));
    }
    if(pathname.endsWith('/FormDetail.aspx')){
      // Both the initial GET and the resubmit-with-NewRowsPerPage=ALL
      // POST return the same full table here -- the real report's
      // paging behavior isn't what this harness is testing.
      if(params.get('Menu_Item_ID') === '45952' && params.get('Form_ID') === '253'){
        return route.fulfill(htmlResponse(awardReportHtml(AWARD_ROWS)));
      }
      return route.fulfill(htmlResponse('<html><body>OK</body></html>'));
    }
    if(pathname.endsWith('/FormReport.aspx')){
      if(params.get('Menu_Item_ID') === '46013'){
        return route.fulfill({ status: 200, contentType: 'text/csv', body: adultDirectoryCsv() });
      }
      return route.fulfill({ status: 200, contentType: 'text/csv', body: '' });
    }
    if(url.hostname === 'mediafiles.scoutshop.org'){
      // This sandbox's own egress proxy blocks the real Scout Shop
      // media host -- serve the identical real template bytes locally
      // for the harness (same file this repo folder ships).
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: templatePdfBytes });
    }
    if(url.hostname === 'raw.githubusercontent.com'){
      // GitHub-staged fallback copy -- served here too so the harness
      // doesn't depend on this file actually having been pushed yet.
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: templatePdfBytes });
    }
    if(url.hostname === 'cdnjs.cloudflare.com' && url.pathname.indexOf('pdf-lib') !== -1){
      const bytes = fs.readFileSync(path.join(__dirname, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js'));
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: bytes });
    }
    if(url.hostname === 'cdn.sheetjs.com'){
      const bytes = fs.readFileSync(path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'));
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: bytes });
    }
    return route.continue();
  });

  page.on('console', msg => { if(msg.type()==='error') console.log('PAGE ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE EXCEPTION:', err.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(BASE + '/CustomPage.aspx');
  await page.waitForSelector('#mbc-root.mbc-ready', { timeout: 15000 });
  await page.waitForTimeout(300);

  // ---- Screenshot 1: initial settings + load screen ----
  await page.locator('#mbc-root').screenshot({ path: path.join(OUT_DIR, '01-initial.png') });
  console.log('captured 01-initial.png');

  // ---- Load the Award Report ----
  await page.locator('#mbc-load-btn').click();
  await page.waitForSelector('#mbc-results-card:not(.mbc-hidden)', { timeout: 15000 });
  await page.waitForTimeout(400);

  // Confirm Unit Leader auto-detected exactly one Scoutmaster.
  const leaderVal = await page.locator('#mbc-leader').inputValue();
  console.log('auto-detected Unit Leader field value:', JSON.stringify(leaderVal));

  // Fill in Council (not auto-detectable) for a realistic screenshot.
  await page.locator('#mbc-council').fill('National Capital Area Council');

  await page.locator('#mbc-root').screenshot({ path: path.join(OUT_DIR, '02-report-loaded.png') });
  console.log('captured 02-report-loaded.png');

  // ---- Deselect a couple of rows, to show the selection UI in use ----
  await page.locator('.mbc-row-cb').nth(2).uncheck();
  await page.locator('.mbc-row-cb').nth(7).uncheck();
  await page.waitForTimeout(150);
  await page.locator('#mbc-root').screenshot({ path: path.join(OUT_DIR, '03-selection.png') });
  console.log('captured 03-selection.png');

  // ---- Generate PDF (normal mode, full template) ----
  const [ download1 ] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('#mbc-gen-btn').click()
  ]);
  await page.waitForTimeout(200);
  await page.locator('#mbc-root').screenshot({ path: path.join(OUT_DIR, '04-generated.png') });
  console.log('captured 04-generated.png');
  await download1.saveAs(path.join(OUT_DIR, 'generated-sample.pdf'));
  console.log('saved generated-sample.pdf');

  // ---- Pre-printed cardstock (data-only) mode ----
  await page.locator('#mbc-blankmode').check();
  const [ download2 ] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('#mbc-gen-btn').click()
  ]);
  await page.waitForTimeout(200);
  await page.locator('#mbc-root').screenshot({ path: path.join(OUT_DIR, '05-blankmode-generated.png') });
  console.log('captured 05-blankmode-generated.png');
  await download2.saveAs(path.join(OUT_DIR, 'generated-sample-blankmode.pdf'));
  console.log('saved generated-sample-blankmode.pdf');

  await browser.close();

  try{
    const { execFileSync } = require('child_process');
    execFileSync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', path.join(OUT_DIR, 'generated-sample.pdf'), path.join(OUT_DIR, '06-pdf-raw')]);
    console.log('rasterized generated-sample.pdf -> 06-pdf-raw-1.png (rename to 06-generated-pdf-sample.png)');
    execFileSync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', path.join(OUT_DIR, 'generated-sample-blankmode.pdf'), path.join(OUT_DIR, '07-pdf-raw')]);
    console.log('rasterized generated-sample-blankmode.pdf -> 07-pdf-raw-1.png (rename to 07-generated-pdf-blankmode-sample.png)');
  }catch(e){
    console.log('pdftoppm not available or failed -- PDFs left un-rasterized:', e.message);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
