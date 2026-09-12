const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// ---- synthetic fake data (not a real troop's records) ----
// Four Patrols with deliberately varied gaps:
//  - Wolf: mixed gaps, one Scout (Martinez) fully caught up
//  - Hawk: Patel has Fitness outstanding at THREE ranks (Tenderfoot/Second
//    Class/First Class) -- demonstrates the By Category merge
//  - Bear: mixed gaps across Citizenship/Scout Spirit/Tools
//  - Fox: both Scouts fully caught up -- demonstrates the "all clear" state
// Plus one unassigned Scout, one adult (excluded), one departed Scout
// (excluded) to exercise the same filters the jsdom harness already covered.
const rosterCsv = [
  'Name,Patrol,Adult?,Left Unit',
  '"Sullivan, Jack",Wolf Patrol,,',
  '"Martinez, Diego",Wolf Patrol,,',
  '"Thompson, Ryan",Wolf Patrol,,',
  '"Nguyen, Kevin",Wolf Patrol,,',
  '"Patel, Arjun",Hawk Patrol,,',
  "\"O'Brien, Connor\",Hawk Patrol,,",
  '"Washington, Malik",Hawk Patrol,,',
  '"Kim, Daniel",Hawk Patrol,,',
  '"Foster, Ethan",Bear Patrol,,',
  '"Reyes, Marcus",Bear Patrol,,',
  '"Chang, Oliver",Bear Patrol,,',
  '"Diaz, Miguel",Fox Patrol,,',
  '"Turner, Caleb",Fox Patrol,,',
  '"Reilly, Sam",,,',
  '"Bennett, Patricia",,Yes,',
  '"Wright, Hunter",Wolf Patrol,,1/1/2023',
].join('\n');

const reqRow = (scout, award, code, text) =>
  `"${scout}",1/1/2024,250,${award} (Current requirements),${code},"${text}"`;

const reqsCsv = [
  'Scout,Rank Date,Weeks To 18,Award,Code,Uncompleted Requirement',
  reqRow('Sullivan, Jack', 'Tenderfoot', '1a', 'Camp in a Scout-selected activity or event, using a tent you have helped pitch'),
  reqRow('Sullivan, Jack', 'Tenderfoot', '6a', 'Explain the importance of setting a fitness goal'),
  reqRow('Sullivan, Jack', 'Tenderfoot', '6b', 'Prepare a written plan for improving in three of the fitness areas'),
  reqRow('Sullivan, Jack', 'Second Class', '7a', 'Record your results and show improvement in each fitness area'),
  reqRow('Thompson, Ryan', 'Tenderfoot', '2a', 'Discuss the guidelines for safely lighting a fire'),
  reqRow('Thompson, Ryan', 'Tenderfoot', '2b', 'Explain the rules of safe fire use'),
  reqRow('Thompson, Ryan', 'First Class', '8a', 'Assess your own level of physical fitness'),
  reqRow('Nguyen, Kevin', 'Second Class', '2a', 'Explain the rules of safe firearms handling'),
  reqRow('Nguyen, Kevin', 'Second Class', '9a', 'Describe common hazards a Scout should be aware of'),
  reqRow('Patel, Arjun', 'Tenderfoot', '6a', 'Explain the importance of setting a fitness goal'),
  reqRow('Patel, Arjun', 'Tenderfoot', '6b', 'Prepare a written plan for improving in three of the fitness areas'),
  reqRow('Patel, Arjun', 'Second Class', '7a', 'Record your results and show improvement in each fitness area'),
  reqRow('Patel, Arjun', 'First Class', '8a', 'Assess your own level of physical fitness'),
  reqRow("O'Brien, Connor", 'First Class', '1a', 'Camp a total of at least 10 separate days and nights'),
  reqRow("O'Brien, Connor", 'First Class', '1b', 'Spend at least one night on a backpacking, canoe, kayak, or other trek'),
  reqRow('Kim, Daniel', 'Second Class', '3a', 'Demonstrate how to use a map and compass'),
  reqRow('Kim, Daniel', 'Second Class', '3b', 'Demonstrate orienteering using a compass and topographic map'),
  reqRow('Foster, Ethan', 'Tenderfoot', '9', 'Repeat from memory the Scout Oath, Scout Law, Scout motto, and Scout slogan'),
  reqRow('Foster, Ethan', 'Tenderfoot', '10', 'Explain the meaning of each point of the Scout Law'),
  reqRow('Reyes, Marcus', 'Second Class', '8a', 'Discuss the differences between an elected government official and one who is appointed'),
  reqRow('Reyes, Marcus', 'Second Class', '8b', 'Explain the process by which a citizen votes in a national election'),
  reqRow('Chang, Oliver', 'Tenderfoot', '3a', 'Demonstrate the Universal Outdoor Code and Leave No Trace principles'),
  reqRow('Chang, Oliver', 'First Class', '11', 'Since joining, participate in service projects totaling at least 6 hours'),
  reqRow('Chang, Oliver', 'First Class', '12', 'Develop a plan for your continued personal growth'),
].join('\n');

function csvResponse(text){
  return { status: 200, contentType: 'text/csv', body: text };
}

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'patrol-rank-gap.html'), 'utf8');
  const wrapper = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Patrol Rank Gap - screenshot harness</title></head><body style="background:#f2f2f2;">\n' + html + '\n</body></html>';

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
      req.respond({ status: 200, contentType: 'text/html', body: wrapper });
    } else if (url.indexOf('cdn.sheetjs.com') !== -1) {
      req.respond({
        status: 200,
        contentType: 'application/javascript',
        body: fs.readFileSync(path.join(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js')),
      });
    } else if (url.indexOf('Menu_Item_ID=45897') !== -1) {
      req.respond(csvResponse(rosterCsv));
    } else if (url.indexOf('Menu_Item_ID=46046') !== -1) {
      req.respond(csvResponse(reqsCsv));
    } else if (url.startsWith('data:') || url.startsWith('about:')) {
      req.continue();
    } else {
      req.respond({ status: 200, contentType: 'text/html', body: '' });
    }
  });

  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto('https://example.troopwebhost.org/CustomPage.aspx', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#prg-listSheet[style=""], #prg-listSheet:not([style*="display: none"])', { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  async function shootRoot(name){
    const el = await page.$('#prg-root');
    await el.screenshot({ path: path.join(OUT, name) });
    console.log('wrote', name);
  }

  // 01 -- Patrol list, default landing state.
  await shootRoot('01-patrol-list.png');

  const patrolAttrs = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('#prg-patrolsTbl tr'), (r) => r.getAttribute('data-patrol'))
  );
  console.log('patrol rows found:', JSON.stringify(patrolAttrs));

  // Click Hawk Patrol (the one with the cross-rank Fitness gap for Patel).
  await page.evaluate(() => {
    const row = Array.prototype.find.call(
      document.querySelectorAll('#prg-patrolsTbl tr'),
      (r) => r.getAttribute('data-patrol') === 'Hawk Patrol'
    );
    row.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  // 02 -- Gap overview, group sections + Scout cards all collapsed.
  await shootRoot('02-gap-overview-collapsed.png');

  // Expand "Requirements Needed By This Patrol".
  await page.evaluate(() => {
    const details = document.querySelectorAll('#prg-gapBody details.prg-section');
    details[0].open = true;
  });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('03-by-requirement-expanded.png');

  // Collapse that one, expand "Requirements Needed By Category" instead --
  // note Fitness merging Tenderfoot/Second Class/First Class from Patel.
  await page.evaluate(() => {
    const details = document.querySelectorAll('#prg-gapBody details.prg-section');
    details[0].open = false;
    details[1].open = true;
  });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('04-by-category-expanded.png');

  // Collapse the category section, expand a couple individual Scout cards.
  await page.evaluate(() => {
    document.querySelectorAll('#prg-gapBody details.prg-section').forEach((d) => (d.open = false));
    const cards = document.querySelectorAll('#prg-gapBody details.prg-scout');
    cards[0].open = true; // Patel
    cards[2].open = true; // Washington -- "nothing outstanding" state, no expand content but fine to leave closed too
  });
  await new Promise((r) => setTimeout(r, 150));
  await shootRoot('05-individual-checklist-expanded.png');

  // Close results, select Fox Patrol -- an all-clear Patrol.
  await page.evaluate(() => { document.getElementById('prg-closeGap').click(); });
  await new Promise((r) => setTimeout(r, 100));
  await page.evaluate(() => {
    const row = Array.prototype.find.call(
      document.querySelectorAll('#prg-patrolsTbl tr'),
      (r) => r.getAttribute('data-patrol') === 'Fox Patrol'
    );
    row.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await shootRoot('06-patrol-all-clear.png');

  // 07 -- What the Excel export itself looks like: capture the workbook
  // XLSX.writeFile() would have produced (stub it to capture instead of
  // downloading), then render the Hawk Patrol sheet -- the one with the
  // richest matrix -- as a styled HTML table and screenshot that.
  const captured = await page.evaluate(() => {
    return new Promise((resolve) => {
      const original = window.XLSX.writeFile;
      window.XLSX.writeFile = (wb) => {
        window.XLSX.writeFile = original;
        const sheet = wb.Sheets['Hawk Patrol'];
        const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(aoa);
      };
      document.getElementById('prg-exportXlsx').click();
    });
  });

  const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const tableRows = captured.map((row, i) => {
    const tag = i === 0 ? 'th' : 'td';
    const cells = row.map((c, ci) => {
      const isMark = i > 0 && ci >= 3;
      const style = isMark
        ? 'text-align:center;font-weight:700;color:#1a7a3a;'
        : (ci < 3 ? 'white-space:nowrap;' : '');
      return `<${tag} style="${style}">${escHtml(c)}</${tag}>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n');
  const excelHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{ margin:0; padding:24px; font-family:Calibri,Arial,sans-serif; background:#fff; }
    .tabbar{ display:flex; gap:2px; margin-top:10px; font-size:12px; }
    .tab{ padding:6px 14px; background:#e8e8e8; border:1px solid #c8c8c8; border-bottom:none; color:#444; }
    .tab.active{ background:#fff; color:#1a1a1a; font-weight:600; border-top:2px solid #217346; }
    table{ border-collapse:collapse; font-size:12.5px; width:100%; table-layout:auto; }
    th, td{ border:1px solid #d0d0d0; padding:6px 10px; text-align:left; }
    th{ background:#217346; color:#fff; font-weight:600; white-space:nowrap; }
    tr:nth-child(even){ background:#f7f9f7; }
    .filename{ font-size:13px; color:#444; margin-bottom:4px; font-family:Calibri,Arial,sans-serif; }
  </style></head><body>
  <div class="filename">Patrol Rank Gap - All Patrols.xlsx</div>
  <table>${tableRows}</table>
  <div class="tabbar">
    <div class="tab">Summary</div>
    <div class="tab active">Hawk Patrol</div>
    <div class="tab">Bear Patrol</div>
    <div class="tab">Wolf Patrol</div>
    <div class="tab">Fox Patrol</div>
    <div class="tab">Unassigned</div>
  </div>
  </body></html>`;
  const excelPage = await browser.newPage();
  await excelPage.setViewport({ width: 1100, height: 480, deviceScaleFactor: 2 });
  await excelPage.setContent(excelHtml, { waitUntil: 'domcontentloaded' });
  const bodyBox = await excelPage.evaluate(() => {
    const r = document.body.getBoundingClientRect();
    return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
  });
  await excelPage.setViewport({ width: bodyBox.width, height: bodyBox.height, deviceScaleFactor: 2 });
  await excelPage.screenshot({ path: path.join(OUT, '07-excel-export-preview.png') });
  console.log('wrote 07-excel-export-preview.png');

  await browser.close();
  console.log('done');
})().catch((err) => { console.error('SCREENSHOT GEN FAILURE:', err); process.exitCode = 1; });
