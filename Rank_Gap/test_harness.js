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
  '"Patel, Arjun",Hawk Patrol,,',
  '"Evans, Ronald",,Yes,',                 // adult -- should be excluded
  '"Frost, Owen",Wolf Patrol,,6/1/2024',   // departed -- should be excluded
  '"Garcia, Luis",,,',                      // no patrol -- Unassigned
].join('\n');

const reqsCsv = [
  'Scout,Rank Date,Weeks To 18,Award,Code,Uncompleted Requirement',
  '"Anderson, Miles",1/1/2024,300,Tenderfoot (Current requirements),6a,Explain the importance of setting a fitness goal',
  '"Anderson, Miles",1/1/2024,300,Tenderfoot (Current requirements),6b,Show improvement after 30 days',
  '"Patel, Arjun",2/2/2024,290,First Class (Current requirements),1a,Camp a total of at least 10 separate days and nights',
  '"Anderson, Miles",1/1/2024,300,Star,1,Star requirement -- out of scope, should be filtered out',
].join('\n');
// Baker and Chen and Garcia intentionally have NO rows -- "Nothing outstanding".

const eventsListHtml = `<!DOCTYPE html><html><body>
<table>
<thead><tr><th>Event Type</th><th>Event</th><th>Start</th><th>End</th><th>Location</th></tr></thead>
<tbody>
<tr><td>Campout</td><td><a href="#" onclick="location.href='FormDetail.aspx?Menu_Item_ID=56931&amp;Form_ID=259&amp;ID=101&amp;Stack=3';return false;">Fall Campout</a></td><td>10/10/2026</td><td>10/12/2026</td><td>Camp Wilderness</td></tr>
<tr><td>Meeting</td><td><a href="#" onclick="location.href='FormDetail.aspx?ID=102';return false;">Troop Meeting</a></td><td>10/15/2026</td><td>10/15/2026</td><td>Church Hall</td></tr>
<tr><td>Campout</td><td><a href="#" onclick="location.href='FormDetail.aspx?Menu_Item_ID=56931&amp;Form_ID=259&amp;ID=103&amp;Stack=3';return false;">Winter Campout</a></td><td>12/5/2026</td><td>12/7/2026</td><td>Snow Mountain</td></tr>
</tbody>
</table>
</body></html>`;

const attendeesHtml101 = `<!DOCTYPE html><html><body>
<table>
<thead><tr><th>Participant</th><th>Leadership</th><th>Patrol</th><th>Medical Forms Needed</th><th>Current Balance</th><th>Comment</th><th>Signed Up</th></tr></thead>
<tbody>
<tr><td>Anderson, Miles</td><td></td><td>Wolf Patrol</td><td>No</td><td>$0</td><td></td><td>Yes</td></tr>
<tr><td>Patel, Arjun</td><td></td><td>Hawk Patrol</td><td>No</td><td>$0</td><td></td><td>Yes</td></tr>
</tbody>
</table>
</body></html>`;

const attendeesHtml103 = `<!DOCTYPE html><html><body>
<table>
<thead><tr><th>Participant</th><th>Leadership</th><th>Patrol</th><th>Medical Forms Needed</th><th>Current Balance</th><th>Comment</th><th>Signed Up</th></tr></thead>
<tbody>
<tr><td colspan="7">No data is currently available to display.</td></tr>
</tbody>
</table>
</body></html>`;

function toArrayBuffer(text){
  const buf = Buffer.from(text, 'utf8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const html = fs.readFileSync(path.join(__dirname, 'rank-requirement-gap.html'), 'utf8');

(async () => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'https://example.troopwebhost.org/CustomPage.aspx'
  });
  const { window } = dom;
  window.XLSX = XLSX;
  window.HTMLElement.prototype.scrollIntoView = () => {};

  window.fetch = async (url) => {
    const ok = { ok: true, redirected: false };
    if (url.indexOf('Menu_Item_ID=45897') !== -1) {
      return { ...ok, headers: { get: () => 'text/csv' }, arrayBuffer: async () => toArrayBuffer(rosterCsv) };
    }
    if (url.indexOf('Menu_Item_ID=46046') !== -1) {
      return { ...ok, headers: { get: () => 'text/csv' }, arrayBuffer: async () => toArrayBuffer(reqsCsv) };
    }
    if (url.indexOf('Menu_Item_ID=56931') !== -1 && url.indexOf('Form_ID=163') !== -1) {
      return { ...ok, text: async () => eventsListHtml };
    }
    if (url.indexOf('ID=101') !== -1) return { ...ok, text: async () => attendeesHtml101 };
    if (url.indexOf('ID=103') !== -1) return { ...ok, text: async () => attendeesHtml103 };
    throw new Error('unexpected fetch: ' + url);
  };

  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error || e.message));

  await new Promise((r) => setTimeout(r, 300));
  const doc = window.document;

  console.log('=== INIT ===');
  console.log('Campout panel hidden?', doc.getElementById('rg-panel-campout').classList.contains('rg-mode-panel-hidden'));
  console.log('Patrol panel hidden?', doc.getElementById('rg-panel-patrol').classList.contains('rg-mode-panel-hidden'));
  console.log('All panel hidden?', doc.getElementById('rg-panel-all').classList.contains('rg-mode-panel-hidden'));

  const eventRows = doc.querySelectorAll('#rg-eventsTbl tr');
  console.log('\n=== Campout list (should exclude the Meeting) ===');
  eventRows.forEach(r => console.log(r.textContent.replace(/\s+/g, ' ').trim()));

  // Select Fall Campout (has attendees).
  const fallRow = Array.prototype.find.call(eventRows, r => r.getAttribute('data-event-id') === '101');
  fallRow.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  console.log('\n=== Fall Campout gap ===');
  console.log('Title:', doc.getElementById('rg-gapTitle').textContent);
  console.log('Meta:', doc.getElementById('rg-gapMeta').textContent);
  const fallCards = doc.querySelectorAll('#rg-gapBody details.rg-scout');
  fallCards.forEach(c => console.log(' Scout card:', c.querySelector('summary').textContent.replace(/\s+/g,' ').trim()));
  console.log('Export button disabled?', doc.getElementById('rg-exportGapXlsx').disabled);

  // Capture the export workbook for the campout selection.
  let capturedCampout = null;
  {
    const orig = XLSX.writeFile;
    XLSX.writeFile = (wb, filename) => { capturedCampout = { wb, filename }; };
    doc.getElementById('rg-exportGapXlsx').dispatchEvent(new window.Event('click', { bubbles: true }));
    XLSX.writeFile = orig;
  }
  console.log('\n=== Fall Campout export ===');
  console.log('Filename:', capturedCampout.filename);
  console.log('Sheet names:', capturedCampout.wb.SheetNames);

  // Select Winter Campout (no attendees -- empty-state branch).
  const winterRow = Array.prototype.find.call(eventRows, r => r.getAttribute('data-event-id') === '103');
  winterRow.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  console.log('\n=== Winter Campout gap (should be empty state) ===');
  console.log('Body text:', doc.getElementById('rg-gapBody').textContent.trim());
  console.log('Export button disabled (should still be enabled)?', doc.getElementById('rg-exportGapXlsx').disabled);

  // Switch to Patrol mode.
  doc.querySelector('.rg-mode-tab[data-mode="patrol"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  console.log('\n=== Switched to Patrol mode ===');
  console.log('Campout panel hidden?', doc.getElementById('rg-panel-campout').classList.contains('rg-mode-panel-hidden'));
  console.log('Patrol panel hidden?', doc.getElementById('rg-panel-patrol').classList.contains('rg-mode-panel-hidden'));

  const patrolRows = doc.querySelectorAll('#rg-patrolsTbl tr');
  patrolRows.forEach(r => console.log(r.textContent.replace(/\s+/g, ' ').trim()));
  const wolfRow = Array.prototype.find.call(patrolRows, r => r.getAttribute('data-patrol') === 'Wolf Patrol');
  wolfRow.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  console.log('\n=== Wolf Patrol gap (no patrol tag expected) ===');
  console.log('Has rg-scout-patrol span?', doc.getElementById('rg-gapBody').innerHTML.indexOf('rg-scout-patrol') !== -1);

  // Switch to All Scouts mode and view.
  doc.querySelector('.rg-mode-tab[data-mode="all"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  console.log('\n=== Switched to All Scouts mode ===');
  console.log('All panel hidden?', doc.getElementById('rg-panel-all').classList.contains('rg-mode-panel-hidden'));
  console.log('All sub text:', doc.getElementById('rg-allSub').textContent);
  doc.getElementById('rg-viewAllScouts').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  console.log('Title:', doc.getElementById('rg-gapTitle').textContent);
  console.log('Meta:', doc.getElementById('rg-gapMeta').textContent);
  console.log('Has rg-scout-patrol span (expected true)?', doc.getElementById('rg-gapBody').innerHTML.indexOf('rg-scout-patrol') !== -1);
  const allCards = doc.querySelectorAll('#rg-gapBody details.rg-scout');
  allCards.forEach(c => console.log(' Scout card:', c.querySelector('summary').textContent.replace(/\s+/g,' ').trim()));

  // Bulk "Export All Patrols to Excel" (matrix) -- unaffected by mode/selection.
  let capturedPatrolsMatrix = null;
  {
    const orig = XLSX.writeFile;
    XLSX.writeFile = (wb, filename) => { capturedPatrolsMatrix = { wb, filename }; };
    doc.getElementById('rg-exportPatrolsXlsx').dispatchEvent(new window.Event('click', { bubbles: true }));
    XLSX.writeFile = orig;
  }
  console.log('\n=== Bulk Patrols matrix export ===');
  console.log('Filename:', capturedPatrolsMatrix.filename);
  console.log('Sheet names:', capturedPatrolsMatrix.wb.SheetNames);

  if (errors.length) {
    console.log('\n--- window errors ---');
    errors.forEach(e => console.log(e && e.stack || e));
    process.exitCode = 1;
  } else {
    console.log('\nNo uncaught window errors.');
  }
})().catch(err => { console.error('HARNESS FAILURE:', err); process.exitCode = 1; });
