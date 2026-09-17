// Screenshot generator for the Medical Form Date Bulk Uploader -- drives the
// ACTUAL shipped medical-date-bulk-uploader.html in headless Chromium against
// an in-memory fake TroopWebHost backend (synthetic data only, see the
// fixture data below -- no real names, dates, BSA numbers, or troop numbers).
//
// Requires: playwright, and a real Chromium binary available to it
// (PLAYWRIGHT_BROWSERS_PATH env var, or a system-installed one Playwright
// can find; pass --executable-path=/path/to/chrome if neither applies).
// Run from this folder:
//   node gen_screenshots.js
// Output: ./screenshots/*.png

const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require("playwright");

// ---------------------------------------------------------------------
// Synthetic fixture data. No real names, BSA numbers, or troop numbers --
// entirely fictional, per repo convention. The story this fixture tells,
// on purpose, mirrors the real bug this tool was built to solve: a person
// whose Roster Report First Name ("Morgan") differs from the Preferred
// Name TroopWebHost actually displays ("Robin") -- resolved automatically
// via BSA Number rather than name.
// ---------------------------------------------------------------------

// Medical Recheck grid rows (Menu_Item_ID=56934, Form_ID=9224 -- the single
// combined Scout+Adult grid). "adult" flag drives the grid's own "Adult"
// Yes/No column, which this tool reads to determine each row's type.
var MEDICAL_ROWS = [
  { id: '501', name: 'Alder, Jamie',      adult: false, a: '07/01/2025', b: '07/01/2025', c: '07/01/2025' },
  { id: '502', name: 'Brannigan, Cole',   adult: false, a: '05/01/2026', b: '05/01/2026', c: '05/01/2026' }, // already matches the file -- no change expected
  { id: '503', name: 'Castellano, Ren',   adult: false, a: '03/01/2026', b: '03/01/2026', c: '03/15/2026' },
  { id: '504', name: 'Delgado, Skylar',   adult: false, a: '',           b: '',           c: '' },           // note: grid spells it "Skylar" -- file says "Skyler"
  { id: '505', name: 'Fennimore, Tate',   adult: false, a: '04/01/2026', b: '04/01/2026', c: '' },           // twin 1 -- same name as twin 2, no BSA Number on file for either
  { id: '506', name: 'Fennimore, Tate',   adult: false, a: '04/05/2026', b: '04/05/2026', c: '' },           // twin 2
  { id: '601', name: 'Ibarra, Dana',      adult: true,  a: '07/01/2025', b: '07/01/2025', c: '07/01/2025' },
  { id: '602', name: 'Jessup, Robin',     adult: true,  a: '06/01/2025', b: '06/01/2025', c: '06/01/2025' }, // Preferred Name "Robin" -- file's First Name is "Morgan"
  { id: '603', name: 'Kowalski, Sam',     adult: true,  a: '',           b: '',           c: '' }
];

// BSA ID grids (Form_ID 3547 Scout / 3548 Adult) -- Name + BSA ID + the
// same internal person ID used above. Deliberately blank for the
// Delgado/Fennimore rows to force the name-matching fallback (and, for
// Delgado, the "not matched" -> manual fix-name flow) in the screenshots.
var BSAID_SCOUT_ROWS = [
  { id: '501', name: 'Alder, Jamie',    bsa: '100234561' },
  { id: '502', name: 'Brannigan, Cole', bsa: '100234562' },
  { id: '503', name: 'Castellano, Ren', bsa: '100234563' },
  { id: '504', name: 'Delgado, Skylar', bsa: '' },
  { id: '505', name: 'Fennimore, Tate', bsa: '' },
  { id: '506', name: 'Fennimore, Tate', bsa: '' }
];
var BSAID_ADULT_ROWS = [
  { id: '601', name: 'Ibarra, Dana',    bsa: '200234561' },
  { id: '602', name: 'Jessup, Robin',   bsa: '200234562' }, // same BSA Number as the file's "Morgan Jessup" row
  { id: '603', name: 'Kowalski, Sam',   bsa: '200234563' }
];

// Roster Report CSV upload -- the file a leader would export from
// TroopWebHost and upload into this tool. Deliberately minimal (just the
// columns this tool actually reads) since column position doesn't matter,
// only header text.
var ROSTER_CSV =
  '" ",ADULT MEMBERS\r\n' +
  '" ","First Name","Last Name","BSA Number","Health Form A/B - Health Form C"\r\n' +
  '"1","Dana","Ibarra","200234561","08/01/2026(AB) | 08/01/2026(C)"\r\n' +
  '"2","Morgan","Jessup","200234562","09/15/2026(AB) | 09/15/2026(C)"\r\n' +
  '"3","Sam","Kowalski","200234563",""\r\n' +
  '\r\n\r\n' +
  '" ",YOUTH MEMBERS\r\n' +
  '" ","First Name","Last Name","BSA Number","Health Form A/B - Health Form C"\r\n' +
  '"1","Jamie","Alder","100234561","07/01/2026(AB) | 07/01/2026(C)"\r\n' +
  '"2","Cole","Brannigan","100234562","05/01/2026(AB) | 05/01/2026(C)"\r\n' +
  '"3","Ren","Castellano","100234563","04/01/2026(AB) | 04/20/2026(C)"\r\n' +
  '"4","Skyler","Delgado","","10/01/2026(AB) | 10/01/2026(C)"\r\n' +
  '"5","Tate","Fennimore","","04/10/2026(AB) | "\r\n';

// A second, smaller CSV for the "nothing to update" empty-state screenshot
// -- one person whose file date already matches TroopWebHost exactly.
var ROSTER_CSV_ALL_CURRENT =
  '" ",ADULT MEMBERS\r\n' +
  '" ","First Name","Last Name","BSA Number","Health Form A/B - Health Form C"\r\n' +
  '"1","Dana","Ibarra","200234561","07/01/2025(AB) | 07/01/2025(C)"\r\n' +
  '\r\n\r\n' +
  '" ",YOUTH MEMBERS\r\n' +
  '" ","First Name","Last Name","BSA Number","Health Form A/B - Health Form C"\r\n' +
  '"1","Cole","Brannigan","100234562","05/01/2026(AB) | 05/01/2026(C)"\r\n';

function medicalGridHtml(rows, opts){
  opts = opts || {};
  var trs = rows.map(function(r){
    return '<tr>' +
      '<input type=hidden id="CHILDCB1ROW' + r.id + '" name="CHILDCB1ROW' + r.id + '" value="' + r.id + '">' +
      '<td>' + r.name + '</td>' +
      '<td>' + (r.adult ? 'Yes' : 'No') + '</td>' +
      '<td><input type="text" name="p_' + r.id + '_A" value="' + r.a + '"></td>' +
      '<td><input type="text" name="p_' + r.id + '_B" value="' + r.b + '"></td>' +
      '<td><input type="text" name="p_' + r.id + '_C" value="' + r.c + '"></td>' +
      '<td><input type="text" name="p_' + r.id + '_Tet" value=""></td>' +
      '<td><input type="text" name="p_' + r.id + '_Other" value=""></td>' +
      '</tr>';
  }).join('');
  return '<html><body>' +
    '<form id="easyform" method="post">' +
    '<select id="SelectRowsPerPage"><option value="ALL" selected>ALL</option></select>' +
    '<table><thead><tr><th>Name</th><th>Adult</th><th>Medical Part A</th><th>Medical Part B</th><th>Medical Part C</th><th>Tetanus</th><th>Other Med Date</th></tr></thead>' +
    '<tbody>' + trs + '</tbody></table>' +
    '<input type="button" name="save" id="BUTTON53" value="Save">' +
    '</form></body></html>';
}

function bsaIdGridHtml(rows){
  var trs = rows.map(function(r){
    return '<tr>' +
      '<input type=hidden id="CHILDCB2ROW' + r.id + '" name="CHILDCB2ROW' + r.id + '" value="' + r.id + '">' +
      '<td>' + r.name + '</td>' +
      '<td><input type="text" value="' + r.bsa + '"></td>' +
      '</tr>';
  }).join('');
  return '<html><body>' +
    '<table><thead><tr><th>Name</th><th>BSA ID</th></tr></thead>' +
    '<tbody>' + trs + '</tbody></table>' +
    '</body></html>';
}

function htmlResponse(body){ return { status: 200, contentType: 'text/html', body: body }; }

// Minimal multipart/form-data parser -- good enough for our all-text
// fixture fields (name/value pairs only, no file parts). Same approach as
// the Swim Classification tool's harness in this repo.
function parseMultipart(body, contentType){
  var out = {};
  if(!body || !contentType) return out;
  var m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  var boundary = m ? (m[1] || m[2]) : null;
  if(!boundary) return out;
  body.split('--' + boundary).forEach(function(part){
    var nm = part.match(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n?$/);
    if(nm) out[nm[1]] = nm[2];
  });
  return out;
}

const TOOL_HTML_PATH = path.join(__dirname, 'medical-date-bulk-uploader.html');
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'https://sample-troop.troopwebhost.org';

fs.mkdirSync(OUT_DIR, { recursive: true });

function wrapPage(toolHtml){
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troop 1776 - Custom Page</title></head>' +
    '<body>' + toolHtml + '</body></html>';
}

async function installRoutes(page, medicalRows, restricted){
  if(restricted){
    // This sandbox's pinned Chromium build doesn't deliver a page.route
    // interception event for the follow-up request after a fulfilled 3xx
    // response (confirmed via an isolated repro against Playwright's own
    // route API, independent of this tool's code) -- so a real redirect
    // can't be faked here the normal way. Since this tool's own
    // mfuFetchRaw() only ever inspects res.ok / res.redirected / res.url
    // / res.text() on whatever fetch() resolves with, a minimal
    // spec-shaped stand-in object is sufficient to exercise the exact
    // same downstream code path (the "REDIRECTED:" branch) and render
    // the real, unmodified restricted-state markup -- this shims fetch()
    // itself rather than skip the scenario or hand-fake the DOM state.
    await page.addInitScript(function(){
      var real = window.fetch.bind(window);
      window.fetch = function(url, opts){
        if(String(url).indexOf('Menu_Item_ID=56934') !== -1){
          return Promise.resolve({
            ok: true, redirected: true, status: 200,
            url: 'https://sample-troop.troopwebhost.org/Welcome.aspx',
            text: function(){ return Promise.resolve('<html><body>Welcome</body></html>'); }
          });
        }
        return real(url, opts);
      };
    });
  }
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const params = url.searchParams;

    if(pathname.endsWith('/CustomPage.aspx')){
      const toolHtml = fs.readFileSync(TOOL_HTML_PATH, 'utf8');
      return route.fulfill(htmlResponse(wrapPage(toolHtml)));
    }
    if(pathname.endsWith('/Welcome.aspx')){
      return route.fulfill(htmlResponse('<html><body>Welcome to TroopWebHost</body></html>'));
    }
    if(pathname.endsWith('/FormList.aspx')){
      const menuId = params.get('Menu_Item_ID');
      const formId = params.get('Form_ID');
      const method = route.request().method();

      if(method === 'GET'){
        if(menuId === '56934' && formId === '9224') return route.fulfill(htmlResponse(medicalGridHtml(medicalRows)));
        if(menuId === '56934' && formId === '3547') return route.fulfill(htmlResponse(bsaIdGridHtml(BSAID_SCOUT_ROWS)));
        if(menuId === '56934' && formId === '3548') return route.fulfill(htmlResponse(bsaIdGridHtml(BSAID_ADULT_ROWS)));
        return route.fulfill(htmlResponse('<html><body>OK</body></html>'));
      }

      // POST (save) -- actually mutate the in-memory fixture array so the
      // tool's own post-save verification refetch (a real GET of this same
      // URL) sees the change and reports "Saved" rather than "did not
      // verify".
      if(menuId === '56934' && formId === '9224'){
        var body = route.request().postData();
        var ct = route.request().headers()['content-type'];
        var fields = parseMultipart(body, ct);
        Object.keys(fields).forEach(function(k){
          var m = k.match(/^p_(\w+)_(A|B|C)$/);
          if(!m) return;
          var row = medicalRows.filter(function(r){ return r.id === m[1]; })[0];
          if(!row) return;
          if(m[2] === 'A') row.a = fields[k];
          if(m[2] === 'B') row.b = fields[k];
          if(m[2] === 'C') row.c = fields[k];
        });
      }
      return route.fulfill(htmlResponse('<html><body>OK</body></html>'));
    }
    return route.continue();
  });
}

async function shot(page, name){
  await page.locator('#mfu-root').screenshot({ path: path.join(OUT_DIR, name) });
  console.log('captured ' + name);
}

async function main(){
  const executablePath = process.env.PW_CHROME_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  // ---------------------------------------------------------------
  // Scenario A: normal walkthrough -- upload, compare, fix a name,
  // apply, save report.
  // ---------------------------------------------------------------
  {
    // Fresh copy of the fixture per scenario -- the save step mutates it.
    var rows = JSON.parse(JSON.stringify(MEDICAL_ROWS));
    const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
    page.on('console', msg => { if(msg.type()==='error') console.log('PAGE ERROR:', msg.text()); });
    page.on('pageerror', err => console.log('PAGE EXCEPTION:', err.message));
    page.on('dialog', dialog => dialog.accept());
    await installRoutes(page, rows, false);
    await page.goto(BASE + '/CustomPage.aspx');
    await page.waitForSelector('#mfu-root.mfu-ready', { timeout: 15000 });

    // ---- Upload the roster CSV ----
    const csvPath = path.join(os.tmpdir(), 'RosterReport_SampleTroop_Fake.csv');
    fs.writeFileSync(csvPath, ROSTER_CSV);
    await page.locator('#mfu-fileInput').setInputFiles(csvPath);
    await page.waitForSelector('#mfu-fileSummary:not([style*="display: none"])', { timeout: 15000 });
    await page.waitForTimeout(200);
    await shot(page, '01-upload-summary.png');

    // ---- Compare against TroopWebHost ----
    await page.locator('#mfu-compareBtn').click();
    await page.waitForSelector('#mfu-results.mfu-show', { timeout: 15000 });
    await page.waitForTimeout(300);
    await shot(page, '02-diff-review.png');

    // ---- Fix the one "not matched" name (Delgado) and recheck ----
    const aliasInput = page.locator('.mfu-alias-input').first();
    await aliasInput.fill('Delgado, Skylar');
    await page.locator('.mfu-alias-save').first().click();
    await page.waitForTimeout(300);
    await shot(page, '03-fix-name-recheck.png');

    // ---- Apply the selected changes ----
    await page.locator('#mfu-applyBtn').click();
    await page.waitForSelector('#mfu-saveReport:not([style*="display: none"])', { timeout: 20000 });
    await page.waitForTimeout(300);
    await shot(page, '04-apply-report.png');

    await page.close();
  }

  // ---------------------------------------------------------------
  // Scenario B: everything in the file already matches -- empty state.
  // ---------------------------------------------------------------
  {
    var rows = JSON.parse(JSON.stringify(MEDICAL_ROWS));
    const page = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    page.on('dialog', dialog => dialog.accept());
    await installRoutes(page, rows, false);
    await page.goto(BASE + '/CustomPage.aspx');
    await page.waitForSelector('#mfu-root.mfu-ready', { timeout: 15000 });

    const csvPath = path.join(os.tmpdir(), 'RosterReport_SampleTroop_AllCurrent_Fake.csv');
    fs.writeFileSync(csvPath, ROSTER_CSV_ALL_CURRENT);
    await page.locator('#mfu-fileInput').setInputFiles(csvPath);
    await page.waitForSelector('#mfu-fileSummary:not([style*="display: none"])', { timeout: 15000 });
    await page.locator('#mfu-compareBtn').click();
    await page.waitForSelector('#mfu-results.mfu-show', { timeout: 15000 });
    await page.waitForSelector('#mfu-noChanges:not([style*="display: none"])', { timeout: 15000 });
    await page.waitForTimeout(300);
    await shot(page, '05-no-changes.png');

    await page.close();
  }

  // ---------------------------------------------------------------
  // Scenario C: restricted access (non-leader login).
  // ---------------------------------------------------------------
  {
    var rows = JSON.parse(JSON.stringify(MEDICAL_ROWS));
    const page = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    page.on('dialog', dialog => dialog.accept());
    await installRoutes(page, rows, true);
    await page.goto(BASE + '/CustomPage.aspx');
    await page.waitForSelector('#mfu-root.mfu-ready', { timeout: 15000 });

    const csvPath = path.join(os.tmpdir(), 'RosterReport_SampleTroop_Fake2.csv');
    fs.writeFileSync(csvPath, ROSTER_CSV);
    await page.locator('#mfu-fileInput').setInputFiles(csvPath);
    await page.waitForSelector('#mfu-fileSummary:not([style*="display: none"])', { timeout: 15000 });
    await page.locator('#mfu-compareBtn').click();
    await page.waitForSelector('#mfu-restricted:not([style*="display: none"])', { timeout: 15000 });
    await page.waitForTimeout(200);
    await shot(page, '06-restricted.png');

    await page.close();
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
