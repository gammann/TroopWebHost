const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const XLSX = require('xlsx');

// ---- synthetic fake data (not a real troop's records) ----
const rosterCsv = [
  'Name,Patrol,Adult?,Left Unit',
  '"Anderson, Miles",Wolf Patrol,,',
  '"Baker, Theo James",Wolf Patrol,,',
  '"Chen, Priya",Hawk Patrol,,',
  '"Diaz, Sam",Hawk Patrol,,',
  '"Evans, Ronald",,Yes,',                 // adult -- should be excluded
  '"Frost, Owen",Wolf Patrol,,6/1/2024',   // departed -- should be excluded
  '"Garcia, Luis",,,',                      // no patrol -- should land in Unassigned
].join('\n');

const reqsCsv = [
  'Scout,Rank Date,Weeks To 18,Award,Code,Uncompleted Requirement',
  '"Anderson, Miles",1/1/2024,300,Tenderfoot (Current requirements),6a,Complete the Tenderfoot fitness requirements',
  '"Anderson, Miles",1/1/2024,300,Tenderfoot (Current requirements),6b,Show improvement after 30 days',
  '"Anderson, Miles",1/1/2024,300,Second Class (Current requirements),7a,Second Class Fitness A',
  '"Chen, Priya",2/2/2024,290,First Class (Current requirements),99z,Some future renumbered requirement', // unmapped code -> Other/Uncategorized
  '"Anderson, Miles",1/1/2024,300,Star,1,Star requirement -- out of scope, should be filtered out',
].join('\n');
// Note: Baker and Diaz intentionally have NO rows -- they should render as
// "Nothing outstanding through First Class".

function csvToArrayBuffer(text){
  const buf = Buffer.from(text, 'utf8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const html = fs.readFileSync(path.join(__dirname, 'patrol-rank-gap.html'), 'utf8');

(async () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://example.troopwebhost.org/CustomPage.aspx'
  });
  const { window } = dom;

  // Real SheetJS (npm 'xlsx') standing in for the CDN build.
  window.XLSX = XLSX;
  // jsdom doesn't implement scrollIntoView -- stub it (this is a harness
  // limitation only; the shipped code's use of it matches the exact same
  // pattern already in production in campout-rank-gap.html).
  window.HTMLElement.prototype.scrollIntoView = () => {};

  window.fetch = async (url, opts) => {
    let body;
    if (url.indexOf('Menu_Item_ID=45897') !== -1) body = rosterCsv;
    else if (url.indexOf('Menu_Item_ID=46046') !== -1) body = reqsCsv;
    else throw new Error('unexpected fetch: ' + url);
    return {
      ok: true,
      redirected: false,
      headers: { get: () => 'text/csv' },
      arrayBuffer: async () => csvToArrayBuffer(body),
      text: async () => body
    };
  };

  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error || e.message));

  // Let the module IIFE run (it calls init() immediately) and the two
  // fetches + promise chain resolve.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const doc = window.document;
  const patrolRows = doc.querySelectorAll('#prg-patrolsTbl tr');
  console.log('--- Patrol table rows ---');
  patrolRows.forEach(r => console.log(r.textContent.replace(/\s+/g, ' ').trim()));

  const exportBtn = doc.getElementById('prg-exportXlsx');
  console.log('Export button disabled?', exportBtn.disabled);

  // Simulate clicking "Wolf Patrol" and inspect the rendered gap card.
  const wolfRow = Array.prototype.find.call(patrolRows, r => r.getAttribute('data-patrol') === 'Wolf Patrol');
  if (!wolfRow) throw new Error('Wolf Patrol row not found');
  wolfRow.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log('\n--- Gap card for Wolf Patrol ---');
  console.log('Title:', doc.getElementById('prg-gapTitle').textContent);
  console.log('Meta:', doc.getElementById('prg-gapMeta').textContent);
  const scoutCards = doc.querySelectorAll('#prg-gapBody details.prg-scout');
  scoutCards.forEach(c => console.log(' Scout card:', c.querySelector('summary').textContent.replace(/\s+/g,' ').trim()));

  // Category section should surface the unmapped code under "Other / Uncategorized"
  // -- but that came from Priya Chen (Hawk Patrol), not Wolf, so it should NOT
  // appear here. Check Hawk Patrol separately.
  const hawkRow = Array.prototype.find.call(patrolRows, r => r.getAttribute('data-patrol') === 'Hawk Patrol');
  hawkRow.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  console.log('\n--- Gap card for Hawk Patrol ---');
  console.log(doc.getElementById('prg-gapBody').textContent.indexOf('Other / Uncategorized') !== -1
    ? 'Other/Uncategorized bucket present (expected, from unmapped code 99z)'
    : 'MISSING expected Other/Uncategorized bucket');

  // Unassigned bucket should contain Garcia only.
  const unassignedRow = Array.prototype.find.call(patrolRows, r => r.getAttribute('data-patrol') === 'Unassigned');
  console.log('\nUnassigned row present?', !!unassignedRow, unassignedRow ? unassignedRow.textContent.replace(/\s+/g,' ').trim() : '');

  // Now the export workbook -- call the page's own buildExportWorkbook()
  // indirectly by clicking the button and checking XLSX.writeFile was invoked
  // with the right sheet names (stub writeFile to capture instead of downloading).
  const originalWriteFile = XLSX.writeFile;
  let captured = null;
  XLSX.writeFile = (wb, filename) => { captured = { wb, filename }; };
  exportBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
  XLSX.writeFile = originalWriteFile;

  console.log('\n--- Export workbook ---');
  console.log('Filename:', captured.filename);
  console.log('Sheet names:', captured.wb.SheetNames);

  console.log('\n--- Wolf Patrol sheet (requirement-by-scout matrix) ---');
  const wolfSheet = captured.wb.Sheets['Wolf Patrol'];
  const wolfAoa = XLSX.utils.sheet_to_json(wolfSheet, { header: 1 });
  wolfAoa.forEach(r => console.log(JSON.stringify(r)));

  console.log('\n--- Hawk Patrol sheet (should include unmapped code 99z row) ---');
  const hawkSheet = captured.wb.Sheets['Hawk Patrol'];
  const hawkAoa = XLSX.utils.sheet_to_json(hawkSheet, { header: 1 });
  hawkAoa.forEach(r => console.log(JSON.stringify(r)));

  if (errors.length) {
    console.log('\n--- window errors ---');
    errors.forEach(e => console.log(e && e.stack || e));
    process.exitCode = 1;
  } else {
    console.log('\nNo uncaught window errors.');
  }
})().catch(err => { console.error('HARNESS FAILURE:', err); process.exitCode = 1; });
