// Screenshot generator for the Swim Classification tool -- drives the
// ACTUAL shipped swim-classification-form.html in headless Chromium against
// an in-memory fake TroopWebHost backend (synthetic data only, see the
// fixture data below -- no real names, dates, or troop numbers).
//
// Requires: playwright, and a real Chromium binary available to it
// (PLAYWRIGHT_BROWSERS_PATH env var, or a system-installed one Playwright
// can find). Run from this folder:
//   node gen_screenshots.js
// Output: ./screenshots/*.png (six PNGs matching the README) plus a
// ./screenshots/generated-sample.pdf -- rasterize separately for the PDF
// screenshot, e.g.:
//   pdftoppm -png -r 150 -f 1 -l 1 screenshots/generated-sample.pdf screenshots/06-generated-pdf-sample

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

// Synthetic fixture data for screenshot generation. No real names, no real
// troop numbers, no real locations -- entirely fictional, per repo convention.

// ---- Full troop swim-classification roster (Scouts) ----
// name is "Last, First" as TWH's admin grid renders it.
var SCOUT_SWIM = [
  { name: 'Alder, Jamie',   date: '6/2/2025',  level: 'Swimmer' },     // will read as expired vs a mid-2026 campout
  { name: 'Brannigan, Cole',date: '5/20/2026', level: 'Swimmer' },
  { name: 'Castellano, Ren',date: '4/11/2026', level: 'Beginner' },
  { name: 'Delgado, Skyler',date: '',          level: '' },            // never tested
  { name: 'Emerson, Piper',date: '3/30/2026', level: 'Non-Swimmer' },
  { name: 'Fennimore, Tate',date: '5/2/2026',  level: 'Swimmer' },
  { name: 'Gallo, Wren',    date: '5/28/2026', level: 'Beginner' },
  { name: 'Hollis, Marin',  date: '2/14/2025', level: 'Swimmer' }      // also expired
];

var ADULT_SWIM = [
  { name: 'Ibarra, Dana',   date: '5/15/2026', level: 'Swimmer' },
  { name: 'Jessup, Morgan', date: '6/1/2025',  level: 'Swimmer' },     // expired
  { name: 'Kowalski, Sam',  date: '5/22/2026', level: 'Beginner' }
];

// ---- Medical Part A/B roster (same troop, same people) ----
var SCOUT_MEDICAL = [
  { name: 'Alder, Jamie',    a: '4/10/2025', b: '4/10/2025' },  // expired by campout end
  { name: 'Brannigan, Cole', a: '7/1/2026',  b: '6/15/2026' },  // good (earlier=6/15/2026 -> exp 6/30/2027)
  { name: 'Castellano, Ren', a: '',          b: '' },            // missing
  { name: 'Delgado, Skyler', a: '3/1/2026',  b: '3/15/2026' },  // earlier 3/1/2026 -> exp 3/31/2027, good
  { name: 'Emerson, Piper',  a: '5/1/2025',  b: '5/20/2025' },  // expired
  { name: 'Fennimore, Tate', a: '6/2/2026',  b: '6/2/2026' },   // good
  { name: 'Gallo, Wren',     a: '',          b: '5/1/2026' },   // good (only B on file)
  { name: 'Hollis, Marin',   a: '1/1/2025',  b: '' }            // expired
];
var ADULT_MEDICAL = [
  { name: 'Ibarra, Dana',    a: '5/1/2026',  b: '5/1/2026' },
  { name: 'Jessup, Morgan',  a: '',          b: '' },           // missing
  { name: 'Kowalski, Sam',   a: '6/10/2026', b: '6/20/2026' }
];

// ---- Upcoming campouts ----
var CAMPOUTS = [
  { id: '4101', name: 'Fall River Canoe Trip', location: 'Cedar Hollow Scout Reservation', type: 'Campout', start: '9/26/2026', end: '9/27/2026' },
  { id: '4102', name: 'Committee Meeting',      location: 'Church Hall',                    type: 'Meeting', start: '9/22/2026', end: '9/22/2026' },
  { id: '4103', name: 'Lakeside Family Campout',location: 'Bright Water Lake',               type: 'Campout', start: '10/17/2026', end: '10/18/2026' },
  { id: '4104', name: 'Winter Cabin Weekend',    location: 'Timberline Cabins',               type: 'Campout', start: '12/5/2026', end: '12/7/2026' }
];

// Campout 4101 attendees: subset of the full roster, both Scouts and Adults.
var CAMPOUT_ATTENDEES = {
  '4101': {
    scouts: ['Alder, Jamie', 'Brannigan, Cole', 'Castellano, Ren', 'Emerson, Piper', 'Fennimore, Tate', 'Hollis, Marin'],
    adults: ['Ibarra, Dana', 'Jessup, Morgan']
  },
  '4103': { scouts: [], adults: [] } // empty-campout screenshot
};

function td(text){ return '<td>'+text+'</td>'; }

function eventsListHtml(){
  var rows = CAMPOUTS.map(function(ev){
    return '<tr>' +
      '<td>'+ev.type+'</td>' +
      '<td><a href="#" onclick="return FormDetail(\'Menu_Item_ID=56931&amp;Form_ID=259&amp;ID='+ev.id+'&amp;Stack=3\')">'+ev.name+'</a></td>' +
      '<td>'+ev.location+'</td>' +
      '<td>'+ev.start+'</td>' +
      '<td>'+ev.end+'</td>' +
      '</tr>';
  }).join('');
  return '<html><body><form id="easyform">' +
    '<table><thead><tr><th>Event Type</th><th>Event</th><th>Location</th><th>Start</th><th>End</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table>' +
    '</form></body></html>';
}

function attendeeTableHtml(names, extraHeader, extraCellFn){
  var rows = names.map(function(n){
    return '<tr><td>'+n+'</td>'+(extraCellFn ? extraCellFn(n) : '')+'</tr>';
  }).join('');
  if(!rows) rows = '<tr><td colspan="99" class="norows">No data is currently available to display.</td></tr>';
  return '<table><thead><tr><th>Participant</th><th>'+extraHeader+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function campoutDetailHtml(id){
  var att = CAMPOUT_ATTENDEES[id] || { scouts:[], adults:[] };
  var scoutTable = attendeeTableHtml(att.scouts, 'Patrol', function(){ return '<td>Hawk Patrol</td>'; });
  var adultTable = attendeeTableHtml(att.adults, 'SYT Status', function(){ return '<td>Current</td>'; });
  return '<html><body>' + scoutTable + adultTable + '</body></html>';
}

function swimGridHtml(list){
  var rows = list.map(function(p, i){
    return '<tr>' +
      '<td>'+p.name+'</td>' +
      '<td><input type="text" name="swimdate_'+i+'" value="'+p.date+'"></td>' +
      '<td><select name="swimlevel_'+i+'">' +
        ['', 'Non-Swimmer', 'Beginner', 'Swimmer'].map(function(lv){
          return '<option value="'+lv+'"'+(lv===p.level?' selected':'')+'>'+(lv||'(none)')+'</option>';
        }).join('') +
      '</select></td>' +
      '</tr>';
  }).join('');
  return '<html><body><form id="easyform">' +
    '<input type="hidden" name="Selected_Action" value="">' +
    '<input type="hidden" name="Hover_Action" value="">' +
    '<input type="hidden" name="Selected_Button_ID" value="">' +
    '<table><thead><tr><th>Name</th><th>Swim Date</th><th>Swim Level</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table>' +
    '</form></body></html>';
}

function medicalGridHtml(list){
  var rows = list.map(function(p){
    return '<tr>' +
      '<td>'+p.name+'</td>' +
      '<td><input type="text" value="'+p.a+'"></td>' +
      '<td><input type="text" value="'+p.b+'"></td>' +
      '<td><input type="text" value=""></td>' +
      '<td><input type="text" value=""></td>' +
      '<td><input type="text" value=""></td>' +
      '</tr>';
  }).join('');
  return '<html><body>' +
    '<table><thead><tr><th>Name</th><th>Medical Part A</th><th>Medical Part B</th><th>Medical Part C</th><th>Tetanus</th><th>Other Med Date</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table>' +
    '</body></html>';
}



const TOOL_HTML_PATH = path.join(__dirname, 'swim-classification-form.html');
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'https://sample-troop.troopwebhost.org';

fs.mkdirSync(OUT_DIR, { recursive: true });

function wrapPage(toolHtml){
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Troop 1776 - Custom Page</title></head>' +
    '<body>' + toolHtml + '</body></html>';
}

function htmlResponse(body){
  return { status: 200, contentType: 'text/html', body: body };
}

// Minimal multipart/form-data parser -- good enough for our all-text fixture
// fields (name/value pairs only, no file parts).
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

async function main(){
  const toolHtml = fs.readFileSync(TOOL_HTML_PATH, 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  // ---- Route interception: fake TWH backend ----
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const params = url.searchParams;

    if(pathname.endsWith('/CustomPage.aspx')){
      return route.fulfill(htmlResponse(wrapPage(toolHtml)));
    }
    if(pathname.endsWith('/FormList.aspx')){
      const menuId = params.get('Menu_Item_ID');
      const formId = params.get('Form_ID');
      const method = route.request().method();
      if(method === 'GET'){
        if(menuId === '56931' && formId === '163'){
          return route.fulfill(htmlResponse(eventsListHtml()));
        }
        if(menuId === '56934'){
          if(formId === '2052') return route.fulfill(htmlResponse(swimGridHtml(SCOUT_SWIM)));
          if(formId === '7322') return route.fulfill(htmlResponse(swimGridHtml(ADULT_SWIM)));
          if(formId === '2065') return route.fulfill(htmlResponse(medicalGridHtml(SCOUT_MEDICAL)));
          if(formId === '3545') return route.fulfill(htmlResponse(medicalGridHtml(ADULT_MEDICAL)));
        }
        return route.fulfill(htmlResponse('<html><body>OK</body></html>'));
      }
      // POST (save) -- actually mutate the in-memory fixture arrays so the
      // tool's own post-save verification refetch (a real GET of this same
      // URL) sees the change and reports "Saved" rather than "did not
      // verify".
      if(menuId === '56934' && (formId === '2052' || formId === '7322')){
        var arr = formId === '2052' ? SCOUT_SWIM : ADULT_SWIM;
        var body = route.request().postData();
        var ct = route.request().headers()['content-type'];
        var fields = parseMultipart(body, ct);
        Object.keys(fields).forEach(function(k){
          var md = k.match(/^swimdate_(\d+)$/);
          if(md && arr[+md[1]]) arr[+md[1]].date = fields[k];
          var ml = k.match(/^swimlevel_(\d+)$/);
          if(ml && arr[+ml[1]]) arr[+ml[1]].level = fields[k];
        });
      }
      return route.fulfill(htmlResponse('<html><body>OK</body></html>'));
    }
    if(pathname.endsWith('/FormDetail.aspx')){
      const id = params.get('ID');
      return route.fulfill(htmlResponse(campoutDetailHtml(id)));
    }
    if(url.hostname === 'www.scouting.org' || url.hostname === 'scouting.org'){
      // Real live site now confirmed to allow this fetch directly -- serve
      // the same real template bytes here for the harness, since this
      // sandbox's own egress proxy blocks scouting.org.
      const bytes = fs.readFileSync(path.join(__dirname, 'Swim-Classificaiton-record-430-122.pdf'));
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: bytes });
    }
    if(url.hostname === 'cdn.jsdelivr.net' && url.pathname.indexOf('pdf-lib') !== -1){
      // jsdelivr isn't reachable from this sandbox's egress proxy -- serve
      // the identical package from the local npm install instead.
      // jsdelivr may not be reachable from a locked-down sandbox network --
      // fall back to a local npm-installed copy of the identical package
      // (npm install pdf-lib@1.17.1 in this folder) if the CDN fetch fails.
      // Comment this whole block out if your environment can reach
      // cdn.jsdelivr.net directly.
      try{
        const bytes = fs.readFileSync(path.join(__dirname, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js'));
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: bytes });
      }catch(e){
        return route.continue();
      }
    }
    return route.continue();
  });

  page.on('console', msg => { if(msg.type()==='error') console.log('PAGE ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE EXCEPTION:', err.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto(BASE + '/CustomPage.aspx');
  await page.waitForSelector('#scr-listSheet:not([style*="display: none"])', { timeout: 15000 });
  await page.waitForTimeout(300);

  // ---- Screenshot 1: campout list ----
  await page.locator('#scr-root').screenshot({ path: path.join(OUT_DIR, '01-campout-list.png') });
  console.log('captured 01-campout-list.png');

  // ---- Select "Fall River Canoe Trip" (id 4101) -> roster loaded ----
  await page.locator('.scr-event-row', { hasText: 'Fall River Canoe Trip' }).click();
  await page.waitForSelector('#scr-rosterTable:not([style*="display: none"])', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('#scr-root').screenshot({ path: path.join(OUT_DIR, '02-roster-loaded.png') });
  console.log('captured 02-roster-loaded.png');

  // ---- Add Scout picker ----
  await page.locator('#scr-addScoutBtn').click();
  await page.waitForSelector('#scr-addPickerConfirm:not([disabled])', { timeout: 15000 });
  await page.waitForTimeout(200);
  await page.locator('#scr-root').screenshot({ path: path.join(OUT_DIR, '03-add-scout-picker.png') });
  console.log('captured 03-add-scout-picker.png');
  await page.locator('#scr-addPickerCancel').click();

  // ---- Save to TroopWebHost: tweak one date first so there's a real diff to report ----
  const firstDateInput = page.locator('.scr-dateInput').first();
  await firstDateInput.fill('9/1/2026');
  await page.locator('#scr-saveBtn').click();
  await page.waitForSelector('#scr-saveReport.scr-show', { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.locator('#scr-root').screenshot({ path: path.join(OUT_DIR, '04-save-report.png') });
  console.log('captured 04-save-report.png');

  // ---- Empty campout state ----
  await page.locator('.scr-event-row', { hasText: 'Lakeside Family Campout' }).click();
  await page.waitForSelector('#scr-rosterStatus:not([style*="display: none"])', { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.locator('#scr-root').screenshot({ path: path.join(OUT_DIR, '05-empty-campout.png') });
  console.log('captured 05-empty-campout.png');

  // ---- Generated PDF sample: go back to the loaded roster and generate ----
  await page.locator('.scr-event-row', { hasText: 'Fall River Canoe Trip' }).click();
  await page.waitForSelector('#scr-rosterTable:not([style*="display: none"])', { timeout: 15000 });
  await page.waitForTimeout(400);

  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('#scr-generateBtn').click()
  ]);
  const pdfPath = path.join(OUT_DIR, 'generated-sample.pdf');
  await download.saveAs(pdfPath);
  console.log('captured generated PDF ->', pdfPath);

  await browser.close();

  // Rasterize page 1 of the generated PDF for the README screenshot, if
  // poppler's pdftoppm is on PATH -- otherwise leave the PDF for manual
  // conversion.
  try{
    const { execFileSync } = require('child_process');
    execFileSync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', pdfPath, path.join(OUT_DIR, '06-pdf-raw')]);
    console.log('rasterized PDF page 1 -> 06-pdf-raw-1.png (crop/rename to 06-generated-pdf-sample.png)');
  }catch(e){
    console.log('pdftoppm not available -- rasterize', pdfPath, 'manually for 06-generated-pdf-sample.png');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
