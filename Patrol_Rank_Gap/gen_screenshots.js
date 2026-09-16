const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// ---- synthetic fake data (not a real troop's records) ----
const rosterCsv = [
  'Name,Patrol,Adult?,Left Unit',
  '"Sullivan, Jack",Wolf Patrol,,',
  '"Martinez, Diego",Wolf Patrol,,',
  '"Thompson, Ryan",Wolf Patrol,,',
  '"Patel, Arjun",Hawk Patrol,,',
  "\"O'Brien, Connor\",Hawk Patrol,,",
  '"Washington, Malik",Hawk Patrol,,',
  '"Foster, Ethan",Bear Patrol,,',
  '"Reyes, Marcus",Bear Patrol,,',
  '"Chang, Oliver",Bear Patrol,,',
  '"Bennett, Patricia",,Yes,',
  '"Wright, Hunter",Wolf Patrol,,1/1/2023',
].join('\n');

const reqRow = (scout, award, code, text) =>
  `"${scout}",1/1/2024,250,${award} (Current requirements),${code},"${text}"`;

const reqsCsv = [
  'Scout,Rank Date,Weeks To 18,Award,Code,Uncompleted Requirement',
  reqRow('Sullivan, Jack', 'Tenderfoot', '6a', 'Explain the importance of setting a fitness goal'),
  reqRow('Sullivan, Jack', 'Tenderfoot', '6b', 'Prepare a written plan for improving in three of the fitness areas'),
  reqRow('Sullivan, Jack', 'Second Class', '7a', 'Record your results and show improvement in each fitness area'),
  reqRow('Patel, Arjun', 'Tenderfoot', '6a', 'Explain the importance of setting a fitness goal'),
  reqRow('Patel, Arjun', 'Second Class', '7a', 'Record your results and show improvement in each fitness area'),
  reqRow('Patel, Arjun', 'First Class', '8a', 'Assess your own level of physical fitness'),
  reqRow("O'Brien, Connor", 'First Class', '1a', 'Camp a total of at least 10 separate days and nights'),
  reqRow("O'Brien, Connor", 'First Class', '1b', 'Spend at least one night on a backpacking, canoe, kayak, or other trek'),
  reqRow('Reyes, Marcus', 'Second Class', '8a', 'Discuss the differences between an elected government official and one who is appointed'),
  reqRow('Chang, Oliver', 'First Class', '11', 'Since joining, participate in service projects totaling at least 6 hours'),
].join('\n');

const eventsListHtml = `<!DOCTYPE html><html><body>
<table>
<thead><tr><th>Event Type</th><th>Event</th><th>Start</th><th>End</th><th>Location</th></tr></thead>
<tbody>
<tr><td>Campout</td><td><a href="#" onclick="location.href='FormDetail.aspx?Menu_Item_ID=56931&amp;Form_ID=259&amp;ID=101&amp;Stack=3';return false;">Fall Family Campout</a></td><td>10/10/2026</td><td>10/12/2026</td><td>Camp Wilderness</td></tr>
<tr><td>Campout</td><td><a href="#" onclick="location.href='FormDetail.aspx?Menu_Item_ID=56931&amp;Form_ID=259&amp;ID=103&amp;Stack=3';return false;">Winter Klondike</a></td><td>1/16/2027</td><td>1/18/2027</td><td>Snow Mountain Scout Reservation</td></tr>
<tr><td>Campout</td><td><a href="#" onclick="location.href='FormDetail.aspx?Menu_Item_ID=56931&amp;Form_ID=259&amp;ID=104&amp;Stack=3';return false;">Spring Canoe Trip</a></td><td>4/9/2027</td><td>4/11/2027</td><td>Willow River</td></tr>
</tbody>
</table>
</body></html>`;

const attendeeRow = (name, patrol) => `<tr><td>${name}</td><td></td><td>${patrol}</td><td>No</td><td>$0</td><td></td><td>Yes</td></tr>`;
const attendeesHead = '<table><thead><tr><th>Participant</th><th>Leadership</th><th>Patrol</th><th>Medical Forms Needed</th><th>Current Balance</th><th>Comment</th><th>Signed Up</th></tr></thead><tbody>';
const attendeesHtml101 = `<!DOCTYPE html><html><body>${attendeesHead}
${attendeeRow('Sullivan, Jack', 'Wolf Patrol')}
${attendeeRow('Patel, Arjun', 'Hawk Patrol')}
${attendeeRow("O'Brien, Connor", 'Hawk Patrol')}
${attendeeRow('Reyes, Marcus', 'Bear Patrol')}
${attendeeRow('Washington, Malik', 'Hawk Patrol')}
</tbody></table></body></html>`;
const attendeesHtml103 = `<!DOCTYPE html><html><body>${attendeesHead}
<tr><td colspan="7">No data is currently available to display.</td></tr>
</tbody></table></body></html>`;
const attendeesHtml104 = attendeesHtml103;

function csvResponse(text){ return { status: 200, contentType: 'text/csv', body: text }; }
function htmlResponse(text){ return { status: 200, contentType: 'text/html', body: text }; }

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'rank-requirement-gap.html'), 'utf8');
  const wrapper = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Rank Gap - screenshot harness</title></head><body style="background:#f2f2f2;">\n' + html + '\n</body></html>';

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url === 'https://example.troopwebhost.org/CustomPage.aspx') {
      req.respond(htmlResponse(wrapper));
    } else if (url.indexOf('cdn.sheetjs.com') !== -1) {
      req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js')) });
    } else if (url.indexOf('Menu_Item_ID=45897') !== -1) {
      req.respond(csvResponse(rosterCsv));
    } else if (url.indexOf('Menu_Item_ID=46046') !== -1) {
      req.respond(csvResponse(reqsCsv));
    } else if (url.indexOf('Menu_Item_ID=56931') !== -1 && url.indexOf('Form_ID=163') !== -1) {
      req.respond(htmlResponse(eventsListHtml));
    } else if (url.indexOf('ID=101') !== -1) {
      req.respond(htmlResponse(attendeesHtml101));
    } else if (url.indexOf('ID=103') !== -1) {
      req.respond(htmlResponse(attendeesHtml103));
    } else if (url.indexOf('ID=104') !== -1) {
      req.respond(htmlResponse(attendeesHtml104));
    } else if (url.startsWith('data:') || url.startsWith('about:')) {
      req.continue();
    } else {
      req.respond({ status: 200, contentType: 'text/html', body: '' });
    }
  });
  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto('https://example.troopwebhost.org/CustomPage.aspx', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));

  async function shootRoot(name){
    const el = await page.$('#rg-root');
    await el.screenshot({ path: path.join(OUT, name) });
    console.log('wrote', name);
  }

  // 01 -- Campouts tab, default landing state.
  await shootRoot('01-campouts-list.png');

  // Select Fall Family Campout.
  await page.evaluate(() => {
    const row = Array.prototype.find.call(document.querySelectorAll('#rg-eventsTbl tr'), (r) => r.getAttribute('data-event-id') === '101');
    row.click();
  });
  await new Promise((r) => setTimeout(r, 250));
  await shootRoot('02-campout-gap.png');

  // Close, switch to Patrols tab.
  await page.evaluate(() => { document.getElementById('rg-closeGap').click(); });
  await page.evaluate(() => { document.querySelector('.rg-mode-tab[data-mode="patrol"]').click(); });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('03-patrols-list.png');

  // Select Hawk Patrol, expand "Requirements Needed By Category".
  await page.evaluate(() => {
    const row = Array.prototype.find.call(document.querySelectorAll('#rg-patrolsTbl tr'), (r) => r.getAttribute('data-patrol') === 'Hawk Patrol');
    row.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const details = document.querySelectorAll('#rg-gapBody details.rg-section');
    details[1].open = true; // By Category
  });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('04-patrol-gap-by-category.png');

  // Close, switch to All Scouts tab, view gap.
  await page.evaluate(() => { document.getElementById('rg-closeGap').click(); });
  await page.evaluate(() => { document.querySelector('.rg-mode-tab[data-mode="all"]').click(); });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('05-all-scouts-tab.png');
  await page.evaluate(() => { document.getElementById('rg-viewAllScouts').click(); });
  await new Promise((r) => setTimeout(r, 200));
  await shootRoot('06-all-scouts-gap.png');

  // Export preview: the shared per-selection "Export to Excel" workbook
  // for the currently displayed All Scouts view -- render the "By
  // Category" sheet (richest one) as a styled HTML table.
  const capturedGap = await page.evaluate(() => {
    return new Promise((resolve) => {
      const original = window.XLSX.writeFile;
      window.XLSX.writeFile = (wb) => {
        window.XLSX.writeFile = original;
        const sheet = wb.Sheets['By Category'];
        resolve({ aoa: window.XLSX.utils.sheet_to_json(sheet, { header: 1 }), sheetNames: wb.SheetNames });
      };
      document.getElementById('rg-exportGapXlsx').click();
    });
  });

  const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function renderExcelPreview(aoa, sheetNames, activeSheet, filename){
    const rows = aoa.map((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      const cells = row.map((c) => `<${tag}>${escHtml(c)}</${tag}>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    const tabs = sheetNames.map((n) => `<div class="tab${n===activeSheet?' active':''}">${escHtml(n)}</div>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{ margin:0; padding:24px; font-family:Calibri,Arial,sans-serif; background:#fff; }
      .tabbar{ display:flex; gap:2px; margin-top:10px; font-size:12px; }
      .tab{ padding:6px 14px; background:#e8e8e8; border:1px solid #c8c8c8; border-bottom:none; color:#444; }
      .tab.active{ background:#fff; color:#1a1a1a; font-weight:600; border-top:2px solid #217346; }
      table{ border-collapse:collapse; font-size:12.5px; width:100%; table-layout:auto; }
      th, td{ border:1px solid #d0d0d0; padding:6px 10px; text-align:left; }
      th{ background:#217346; color:#fff; font-weight:600; white-space:nowrap; }
      tr:nth-child(even){ background:#f7f9f7; }
      .filename{ font-size:13px; color:#444; margin-bottom:4px; }
    </style></head><body>
    <div class="filename">${escHtml(filename)}</div>
    <table>${rows}</table>
    <div class="tabbar">${tabs}</div>
    </body></html>`;
  }
  const excelHtml = renderExcelPreview(capturedGap.aoa, capturedGap.sheetNames, 'By Category', 'Rank Gap - All Scouts.xlsx');
  const excelPage = await browser.newPage();
  await excelPage.setViewport({ width: 1200, height: 480, deviceScaleFactor: 2 });
  await excelPage.setContent(excelHtml, { waitUntil: 'domcontentloaded' });
  const bodyBox1 = await excelPage.evaluate(() => { const r = document.body.getBoundingClientRect(); return { width: Math.ceil(r.width), height: Math.ceil(r.height) }; });
  await excelPage.setViewport({ width: bodyBox1.width, height: bodyBox1.height, deviceScaleFactor: 2 });
  await excelPage.screenshot({ path: path.join(OUT, '07-excel-export-gap.png') });
  console.log('wrote 07-excel-export-gap.png');

  // Bulk "Export All Patrols to Excel" matrix preview -- Hawk Patrol tab.
  await page.evaluate(() => { document.getElementById('rg-closeGap').click(); });
  await page.evaluate(() => { document.querySelector('.rg-mode-tab[data-mode="patrol"]').click(); });
  const capturedMatrix = await page.evaluate(() => {
    return new Promise((resolve) => {
      const original = window.XLSX.writeFile;
      window.XLSX.writeFile = (wb) => {
        window.XLSX.writeFile = original;
        const sheet = wb.Sheets['Hawk Patrol'];
        resolve({ aoa: window.XLSX.utils.sheet_to_json(sheet, { header: 1 }), sheetNames: wb.SheetNames });
      };
      document.getElementById('rg-exportPatrolsXlsx').click();
    });
  });
  const matrixHtml = renderExcelPreview(capturedMatrix.aoa, capturedMatrix.sheetNames, 'Hawk Patrol', 'Rank Gap - All Patrols.xlsx');
  const matrixPage = await browser.newPage();
  await matrixPage.setViewport({ width: 1200, height: 480, deviceScaleFactor: 2 });
  await matrixPage.setContent(matrixHtml, { waitUntil: 'domcontentloaded' });
  const bodyBox2 = await matrixPage.evaluate(() => { const r = document.body.getBoundingClientRect(); return { width: Math.ceil(r.width), height: Math.ceil(r.height) }; });
  await matrixPage.setViewport({ width: bodyBox2.width, height: bodyBox2.height, deviceScaleFactor: 2 });
  await matrixPage.screenshot({ path: path.join(OUT, '08-excel-export-patrols-matrix.png') });
  console.log('wrote 08-excel-export-patrols-matrix.png');

  await browser.close();
  console.log('done');
})().catch((err) => { console.error('SCREENSHOT GEN FAILURE:', err); process.exitCode = 1; });
