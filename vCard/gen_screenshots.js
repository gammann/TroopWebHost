const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// ---- synthetic fake data (not a real troop's records) ----
// Two patrols of Scouts, four adults (one leader-per-patrol pattern
// plus a Treasurer with no patrol at all, to show that's a normal
// state and not a join failure), and a full Parent/Guardian
// cross-reference so every Scout has at least one parent contact.
const scoutDirCsv = [
  'Name,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Email,Email #2,SMS,Age,Grade,Rank,Patrol,Leadership',
  '"Sullivan, Jack",118 Birchwood Ln,,Rivergrove,OH,44120,216-555-0142,,jack.sullivan.scout@example.com,,,12,7,Tenderfoot,Wolf Patrol,',
  '"Martinez, Diego",204 Sycamore Ct,,Rivergrove,OH,44120,216-555-0198,216-555-0199,diego.m.scout@example.com,,,14,9,Star,Wolf Patrol,Patrol Leader',
  '"Patel, Arjun",77 Cattail Way,,Rivergrove,OH,44121,216-555-0211,216-555-0212,arjun.patel.scout@example.com,,,13,8,First Class,Hawk Patrol,Senior Patrol Leader',
  "\"O'Brien, Connor\",340 Harbor Dr,,Rivergrove,OH,44121,216-555-0255,,connor.obrien.scout@example.com,,,15,10,Life,Hawk Patrol,",
  '"Kim, Daniel",12 Maplecrest Ave,,Rivergrove,OH,44120,216-555-0288,,daniel.kim.scout@example.com,,,11,6,Scout,Hawk Patrol,',
  '"Chang, Oliver",89 Fieldstone Rd,,Rivergrove,OH,44121,216-555-0301,,oliver.chang.scout@example.com,,,11,6,Scout,New Scout Patrol,'
].join('\r\n');

const adultDirCsv = [
  'Name,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Business Phone,Email,Email #2,SMS,Leadership',
  '"Sullivan, Mark",118 Birchwood Ln,,Rivergrove,OH,44120,216-555-0142,216-555-0143,216-555-9001,mark.sullivan@example.com,,,Scoutmaster',
  '"Martinez, Elena",204 Sycamore Ct,,Rivergrove,OH,44120,216-555-0198,216-555-0201,,elena.martinez@example.com,,,Assistant Scoutmaster',
  '"Patel, Priya",77 Cattail Way,,Rivergrove,OH,44121,216-555-0211,216-555-0213,216-555-9044,priya.patel@example.com,,,Committee Chair',
  '"Foster, Grace",501 Ridgeline Dr,,Rivergrove,OH,44120,216-555-0410,216-555-0411,,grace.foster@example.com,,,Treasurer'
].join('\r\n');

const patrolRosterCsv = [
  'Patrol,Name,Age,Leadership,Rank',
  'Old Goat,"Sullivan, Mark",,Scoutmaster,',
  'Old Goat,"Martinez, Elena",,Assistant Scoutmaster,',
  'Wolf Patrol,"Sullivan, Jack",12,,Tenderfoot',
  'Wolf Patrol,"Martinez, Diego",14,Patrol Leader,Star',
  'Hawk Patrol,"Patel, Arjun",13,Senior Patrol Leader,First Class',
  'Hawk Patrol,"O\'Brien, Connor",15,,Life',
  'Hawk Patrol,"Kim, Daniel",11,,Scout',
  'New Scout Patrol,"Chang, Oliver",11,,Scout'
].join('\r\n');

const parentXrefCsv = [
  'Scout,Parent/Guardian,Relationship,Parent\'s Phone,Parent\'s E-Mail',
  '"Sullivan, Jack","Sullivan, Mark",Parent,H: 216-555-0142; C: 216-555-0143,mark.sullivan@example.com',
  '"Sullivan, Jack","Sullivan, Rachel",Parent,C: 216-555-0177,rachel.sullivan@example.com',
  '"Martinez, Diego","Martinez, Elena",Parent,C: 216-555-0201,elena.martinez@example.com',
  '"Patel, Arjun","Patel, Priya",Parent,H: 216-555-0211,priya.patel@example.com',
  '"Patel, Arjun","Patel, Rajesh",Parent,C: 216-555-0288,rajesh.patel@example.com',
  '"O\'Brien, Connor","O\'Brien, Frank",Parent,C: 216-555-0299,frank.obrien@example.com',
  '"Kim, Daniel","Kim, Susan",Parent,C: 216-555-0333,susan.kim@example.com',
  '"Chang, Oliver","Chang, Wei",Parent,C: 216-555-0366,wei.chang@example.com'
].join('\r\n');

const xlsxFull = fs.readFileSync(path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js'));
const toolHtml = fs.readFileSync(path.join(__dirname, 'vcard-export.html'), 'utf8');

function pageWrapper(title){
  return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>'+title+'</title></head>'+
    '<body style="background:#f2f2f2;">\n' + toolHtml + '\n</body></html>';
}

// mode: 'normal' | 'degraded' (optional reports redirected) | 'restricted' (required reports redirected)
async function routeForMode(page, mode, title){
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if(url === 'https://example.troopwebhost.org/CustomPage.aspx'){
      return route.fulfill({ status: 200, contentType: 'text/html', body: pageWrapper(title) });
    }
    if(url.indexOf('cdn.sheetjs.com') !== -1){
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: xlsxFull });
    }
    if(url.indexOf('AccessDenied.aspx') !== -1){
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Access Denied</body></html>' });
    }
    const isRequired = url.indexOf('Menu_Item_ID=46012') !== -1 || url.indexOf('Menu_Item_ID=46013') !== -1;
    const isOptional = url.indexOf('Menu_Item_ID=46017') !== -1 || url.indexOf('Menu_Item_ID=52053') !== -1;
    if(mode === 'restricted' && isRequired){
      return route.fulfill({ status: 302, headers: { location: 'https://example.troopwebhost.org/AccessDenied.aspx' } });
    }
    if(mode === 'degraded' && isOptional){
      return route.fulfill({ status: 302, headers: { location: 'https://example.troopwebhost.org/AccessDenied.aspx' } });
    }
    if(url.indexOf('Menu_Item_ID=46012') !== -1) return route.fulfill({ status: 200, contentType: 'text/csv', body: scoutDirCsv });
    if(url.indexOf('Menu_Item_ID=46013') !== -1) return route.fulfill({ status: 200, contentType: 'text/csv', body: adultDirCsv });
    if(url.indexOf('Menu_Item_ID=46017') !== -1) return route.fulfill({ status: 200, contentType: 'text/csv', body: patrolRosterCsv });
    if(url.indexOf('Menu_Item_ID=52053') !== -1) return route.fulfill({ status: 200, contentType: 'text/csv', body: parentXrefCsv });
    if(url.startsWith('data:') || url.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, contentType: 'text/html', body: '' });
  });
}

async function shootRoot(page, name){
  const el = await page.$('#vce-root');
  await el.screenshot({ path: path.join(OUT, name) });
  console.log('wrote', name);
}

(async () => {
  const browser = await chromium.launch();

  // ================= PASS A: normal, full data =================
  const pageA = await browser.newPage({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 2 });
  pageA.on('console', (msg) => console.log('[pageA]', msg.text()));
  pageA.on('pageerror', (err) => console.log('[pageA error]', err.message));
  await routeForMode(pageA, 'normal', 'Troop 1234 ExampleVille');
  await pageA.goto('https://example.troopwebhost.org/CustomPage.aspx', { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector('#vce-main:not([style*="display: none"])', { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  // 01 -- default landing state: both panels, Scouts/Adults groups open,
  // default field checkboxes, Organization auto-filled from page title.
  await shootRoot(pageA, '01-default-landing.png');

  // 02 -- search + patrol filter narrowing the Who list.
  await pageA.fill('#vce-search', 'a');
  await pageA.selectOption('#vce-patrolFilter', 'Hawk Patrol');
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot(pageA, '02-search-and-patrol-filter.png');
  await pageA.fill('#vce-search', '');
  await pageA.selectOption('#vce-patrolFilter', '');
  await new Promise((r) => setTimeout(r, 100));

  // 03 -- a real selection made (Select All Scouts), summary count and
  // download buttons live.
  await pageA.click('#vce-selAllScouts');
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot(pageA, '03-scouts-selected.png');

  // 04 -- click the combined download to show the confirmation status line
  // (downloads are harmless in a headless run -- no real file lands anywhere
  // meaningful outside this throwaway browser context).
  await pageA.click('#vce-dlCombined');
  await new Promise((r) => setTimeout(r, 200));
  await shootRoot(pageA, '04-download-confirmation.png');
  await pageA.close();

  // ================= PASS B: degraded (optional reports unavailable) =================
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 2 });
  pageB.on('console', (msg) => console.log('[pageB]', msg.text()));
  await routeForMode(pageB, 'degraded', 'Troop 1234 ExampleVille');
  await pageB.goto('https://example.troopwebhost.org/CustomPage.aspx', { waitUntil: 'domcontentloaded' });
  await pageB.waitForSelector('#vce-main:not([style*="display: none"])', { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  // 05 -- Patrol Roster + Parent Cross Reference both unavailable: partial
  // note under the masthead, Parent/Guardian checkbox disabled.
  await shootRoot(pageB, '05-degraded-mode.png');
  await pageB.close();

  // ================= PASS C: restricted (required reports unavailable) =================
  const pageC = await browser.newPage({ viewport: { width: 1000, height: 480 }, deviceScaleFactor: 2 });
  pageC.on('console', (msg) => console.log('[pageC]', msg.text()));
  await routeForMode(pageC, 'restricted', 'Troop 1234 ExampleVille');
  await pageC.goto('https://example.troopwebhost.org/CustomPage.aspx', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 800));
  await shootRoot(pageC, '06-restricted-state.png');
  await pageC.close();

  await browser.close();
  console.log('done');
})().catch((err) => { console.error('SCREENSHOT GEN FAILURE:', err); process.exitCode = 1; });
