/*
 * gen_screenshots.js -- Scouting History Report README screenshots
 * -----------------------------------------------------------------
 * Drives the ACTUAL shipped scouting-history-report.html in headless
 * Chromium against an in-memory fake TroopWebHost backend, then saves
 * PNGs to ./screenshots/.
 *
 * ALL DATA IS SYNTHETIC. The Scouts, patrols, BSA IDs, dates, unit number
 * and requirement wording below are invented for illustration only.
 * No real member, troop, or location information appears anywhere.
 *
 * Setup (one time, in this folder):
 *   npm init -y
 *   npm i puppeteer-core @sparticuz/chromium xlsx@0.18.5
 *
 * Run:
 *   node gen_screenshots.js [path/to/scouting-history-report.html]
 *
 * How the fake backend works (Puppeteer request interception):
 *   - The HTML is injected into a small stand-in "TroopWebHost" page whose
 *     CSS gives the page's theme probe something to adapt to.
 *   - FormReport.aspx  (Scout Directory)     -> CSV
 *   - FormList.aspx    (Scout BSA ID grid)   -> HTML table with CHILDCB ids
 *   - FormReportMultiSection.aspx (history)  -> a real binary .xls workbook
 *     (two sheets, same layout as TWH's export), built with SheetJS
 *   - cdn.sheetjs.com  -> served from the local xlsx npm package, since the
 *     sandbox/CI machine may not reach the CDN
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer-core');

const HTML_PATH = path.resolve(process.argv[2] || path.join(__dirname, 'scouting-history-report.html'));
const OUT_DIR = path.join(__dirname, 'screenshots');
const ORIGIN = 'https://troopwebhost.test';
const HISTORY_DELAY_MS = 800; // per-Scout latency so the "Stop" state can be captured

/* ============================ SYNTHETIC DATA ============================ */
function serial(iso){ if(!iso) return ''; const p = iso.split('-').map(Number); return Date.UTC(p[0], p[1]-1, p[2]) / 86400000 + 25569; }
function usDate(iso){ const p = iso.split('-').map(Number); return p[1] + '/' + p[2] + '/' + p[0]; }
function addDays(iso, n){ const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1]-1, p[2] + n)); return d.toISOString().slice(0,10); }
function spread(a, b, i, n){ const A = Date.UTC(...a.split('-').map((v,k)=>k===1?v-1:+v)); const B = Date.UTC(...b.split('-').map((v,k)=>k===1?v-1:+v)); const t = n <= 1 ? 1 : i/(n-1); return new Date(A + (B-A)*t).toISOString().slice(0,10); }

const RANK_ORDER = ['Scout','Tenderfoot','Second Class','First Class','Star','Life','Eagle'];
const CODES = {
  'Scout': ['1a','1b','1c','1d','1e','1f','2a','2b','2c','2d','3a','3b','4a','4b','5','6','7'],
  'Tenderfoot': ['1a','1b','1c','2a','2b','2c','3a','3b','3c','3d','4a','4b','4c','4d','5a','5b','5c','5d','6a','6b','6c','7a','7b','8','9','10','11'],
  'Second Class': ['1a','1b','1c','2a','2b','2c','2d','2e','2f','2g','3a','3b','3c','3d','4','5a','5b','5c','5d','6a','6b','6c','6d','6e','7a','7b','7c','8a','8b','8c','8d','8e','9a','9b','10','11','12'],
  'First Class': ['1a','1b','2a','2b','2c','2d','2e','3a','3b','3c','3d','4a','4b','5a','5b','5c','5d','6a','6b','6c','6d','6e','7a','7b','7c','7d','7e','7f','8a','8b','9a','9b','9c','9d','10','11','12','13'],
  'Star': ['1','2','3','4','5','6a','6b','7','8'],
  'Life': ['1','2','3','4','5','6','7','8'],
  'Eagle': ['1','2','3','4','5','6','7']
};
const FINALS = { 'Scout':['7'], 'Tenderfoot':['10','11'], 'Second Class':['11','12'], 'First Class':['12','13'], 'Star':['7','8'], 'Life':['7','8'], 'Eagle':['6','7'] };
// Short, invented paraphrases -- parallel to CODES above.
const LABELS = {
  'Scout': ['Scout Oath, Law, motto, slogan','Explain the Scout Oath','Explain the Scout Law','Describe the Scout badge','Pledge of Allegiance','Handshake, salute, sign','Tie a square knot','Tie two half hitches','Tie a bowline','Tie a taut-line hitch','Explain the patrol method','Discuss troop meetings','Review safety guidelines','Discuss outdoor safety','Fitness baseline','Youth protection guide','Scoutmaster conference'],
  'Tenderfoot': ['Prepare for an overnight','Pack personal gear','Pitch a tent','Plan a patrol menu','Cook a meal','Clean up after cooking','Use a pocketknife safely','Use a saw safely','Use an axe safely','Sharpen and store tools','Identify parts of a compass','Follow a compass course','Orient a map','Explain GPS basics','Identify local plants','Identify local animals','Explain Leave No Trace','Practice the Outdoor Code','Treat cuts and scrapes','Treat burns','Treat bites and stings','Record fitness baseline','Set a fitness goal','Demonstrate Scout spirit','Complete a service project','Scoutmaster conference','Board of review'],
  'Second Class': ['Plan a 5-mile hike','Lead a patrol hike','Record a hike log','Plan campout meals','Estimate food costs','Cook over a fire','Cook on a stove','Serve and clean up','Store food safely','Dispose of waste','Identify natural landmarks','Use map and compass','Set a course','Explain trail signs','Navigation challenge','Water safety rules','Swim test','Reach rescue','Throwing rescue','Recognize hazards','Treat heat reactions','Treat cold reactions','Treat for shock','Treat bleeding','Identify wildlife','Identify poisonous plants','Discuss ecology','Conservation work','Take part in a cleanup','Report on results','Discuss stewardship','Plan a conservation activity','Set a fitness goal','Track progress','Demonstrate Scout spirit','Scoutmaster conference','Board of review'],
  'First Class': ['Plan a campout menu','Lead camp setup','Fire safety','Build a fire','Light a stove','Cook a trail meal','Clean and store gear','Find direction by sun','Find direction by stars','Use a GPS unit','Follow a route on a map','Tie a lashing','Build a camp gadget','Plan a trek','Lead a trek','Record the route','Discuss trek hazards','Identify camp hazards','Campsite safety','Purify water','Demonstrate first aid','Treat for hypothermia','Discuss water safety','Swim 75 yards','Float and rest','Enter water safely','Reach rescue','Discuss equipment safety','Community hazards','First aid for choking','Plan a service project','Take part in a project','Reflect on service','Lead a group discussion','Demonstrate Scout spirit','Lead at a troop meeting','Scoutmaster conference','Board of review'],
  'Star': ['Active 4 months as First Class','Demonstrate Scout spirit','Merit Badges (six, four Eagle-required)','Participate in service projects','Serve in a position of responsibility','Teach or mentor a younger Scout','Or lead a service activity','Scoutmaster conference','Board of review'],
  'Life': ['Active 6 months as Star','Demonstrate Scout spirit','Merit Badges (five, three Eagle-required)','Serve in a position of responsibility','Complete service project hours','Explain leadership skills','Scoutmaster conference','Board of review'],
  'Eagle': ['Active 6 months as Life','Live the Oath and Law','Merit Badges (21, 13 Eagle-required)','Serve in a position of responsibility','Plan and lead a service project','Scoutmaster conference','Board of review']
};

/* Build Sheet 2 rows for one rank. `done` = array of codes completed.
   `over` optionally pins specific code -> ISO date. */
function rankReqRows(rank, done, start, end, over){
  over = over || {};
  const codes = CODES[rank], fin = FINALS[rank];
  const rows = [];
  const mid = codes.filter(c => done.includes(c) && !fin.includes(c) && !(c === '1' && ACTIVE_DAYS[rank]) && !over[c]);
  let midEnd = addDays(end, fin.length === 2 ? -14 : -5);
  let midStart = addDays(start, 10);
  if(midStart > midEnd) midStart = start;
  let mi = 0;
  codes.forEach((c, idx) => {
    if(!done.includes(c)) return;
    let date;
    if(over[c]) date = over[c];
    else if(c === '1' && ACTIVE_DAYS[rank]) date = addDays(start, ACTIVE_DAYS[rank]) > end ? end : addDays(start, ACTIVE_DAYS[rank]);
    else if(fin.includes(c)) date = (fin.length === 2 && c === fin[0]) ? addDays(end, -9) : end;
    else date = spread(midStart, midEnd, mi++, mid.length);
    rows.push([rank, c, LABELS[rank][idx], serial(date)]);
  });
  return rows;
}
// "Be active N months in the current position/rank" completes after that span.
const ACTIVE_DAYS = { 'Star': 125, 'Life': 185, 'Eagle': 185 };
/* Join date: a Scout earns the Scout rank a few weeks after joining. */
function joinedFor(s){ return s.ranks.length ? addDays(s.ranks[0][1], -35) : s.joined; }

const SCOUTS = [
  { name:'Ashworth, Devin', patrol:'Raven Patrol', bsa:'10000001', id:'5001', joined:'2021-09-14',
    rank:'Eagle', ranks:[['Scout','2021-09-14','2021-10-12'],['Tenderfoot','2021-11-09','2021-12-14'],['Second Class','2022-03-08','2022-04-12'],['First Class','2022-08-09','2022-09-13'],['Star','2023-06-13','2023-07-11'],['Life','2023-11-14','2023-12-12'],['Eagle','2025-06-10','2025-08-05']],
    badges:[['*First Aid','2022-01-18','Star'],['*Cooking','2022-05-10','Star'],['*Camping','2022-11-08','Star'],['*Swimming','2022-07-19','Star'],['Archery','2023-02-14','Star'],['Canoeing','2023-04-25','Star'],
            ['*Personal Fitness','2023-05-16','Life'],['*Citizenship in the Community','2023-08-08','Life'],['*Emergency Preparedness','2023-09-19','Life'],['Fishing','2023-07-11','Life'],['Woodwork','2023-10-03','Life'],
            ['*Citizenship in the Nation','2024-01-16','Eagle'],['*Citizenship in Society','2024-03-19','Eagle'],['*Communication','2024-05-14','Eagle'],['*Environmental Science','2024-06-18','Eagle'],['*Personal Management','2024-09-24','Eagle'],['*Family Life','2024-11-12','Eagle'],
            ['Pioneering','2024-02-13',''],['Rifle Shooting','2024-07-09',''],['Search and Rescue','2024-08-13',''],['Wilderness Survival','2024-10-08',''],['Photography','2025-01-21','']],
    inProgress:[['Programming',3,4],['Astronomy',1,5]],
    positions:[['Troop Guide','2022-09-01','2023-02-28'],['Patrol Leader','2023-03-01','2023-08-31'],['Assistant Senior Patrol Leader','2023-09-01','2024-02-29'],['Senior Patrol Leader','2024-03-01','2024-08-31'],['Junior Assistant Scoutmaster','2024-09-01','']],
    awards:[["Totin' Chip",'2021-10-12','2021-10-12'],["Firem'n Chit",'2021-10-12','2021-10-12'],['Mile Swim','2022-07-19','2022-08-09'],['50-Miler Award','2024-07-20','2024-09-10'],['Service Award (Silver)','2025-08-05','2025-09-09']],
    training:[['Youth Protection Training','2026-01-10','2028-01-10'],['Troop Leadership Training','2023-02-11',''],['National Youth Leadership Training','2023-07-15',''],['Leave No Trace Trainer','2024-05-18','']],
    totals1:[74,6,96,18,132,58], totals2:[40,22,0,10,0,0], oa:['Yes','2022-05-14','2022-10-08','2023-06-10','2025-09-13'] },

  { name:'Bellweather, Marcus', patrol:'Raven Patrol', bsa:'10000002', id:'5002', joined:'2022-02-08',
    rank:'Life', ranks:[['Scout','2022-02-08','2022-03-08'],['Tenderfoot','2022-04-12','2022-05-10'],['Second Class','2022-09-13','2022-10-11'],['First Class','2023-02-14','2023-03-14'],['Star','2024-01-16','2024-02-13'],['Life','2025-03-11','2025-04-08']],
    badges:[['*First Aid','2022-11-15','Star'],['*Cooking','2023-05-09','Star'],['*Camping','2023-08-15','Star'],['*Swimming','2023-07-11','Star'],['Archery','2023-10-03','Star'],['Canoeing','2023-11-14','Star'],
            ['*Personal Fitness','2024-05-14','Life'],['*Citizenship in the Community','2024-08-13','Life'],['*Emergency Preparedness','2024-10-08','Life'],['Pioneering','2024-11-12','Life'],['Woodwork','2025-01-21','Life'],
            ['*Citizenship in the Nation','2025-05-13','Eagle'],['*Personal Management','2025-10-14','Eagle'],['Wilderness Survival','2025-07-15',''],['Search and Rescue','2026-02-10','']],
    inProgress:[['Communication',3,4],['Environmental Science',2,5],['Family Life',5,4],['Citizenship in Society',1,5],['Fishing',4,4]],
    eagleDone:['1','2','4'], eagleAsOf:'2026-08-18', eagleDates:{'1':'2025-09-16','2':'2025-11-18','4':'2026-03-03'},
    positions:[['Patrol Leader','2024-03-01','2024-08-31'],['Quartermaster','2025-03-01','2025-08-31'],['Senior Patrol Leader','2025-09-01','2026-02-28'],['Assistant Senior Patrol Leader','2026-03-01','']],
    awards:[["Totin' Chip",'2022-03-08','2022-03-08'],["Firem'n Chit",'2022-03-08','2022-03-08'],['Mile Swim','2023-07-11','2023-08-08']],
    training:[['Youth Protection Training','2026-02-03','2028-02-03'],['National Youth Leadership Training','2025-07-19','']],
    totals1:[51,4,58,9,88,30], totals2:[24,12,0,6,0,0], oa:['Yes','2024-05-11','2024-10-12','',''] },

  { name:'Calloway, Ethan', patrol:'Raven Patrol', bsa:'10000003', id:'5003', joined:'2023-02-14',
    rank:'First Class', ranks:[['Scout','2023-02-14','2023-03-14'],['Tenderfoot','2023-05-09','2023-06-13'],['Second Class','2023-11-14','2023-12-12'],['First Class','2025-05-13','2025-06-10']],
    badges:[['*First Aid','2024-03-12','Star'],['*Cooking','2024-06-11','Star'],['*Camping','2024-11-12','Star'],['*Personal Fitness','2025-02-11','Star'],['Archery','2025-04-08','Star'],['Basketry','2025-09-16','Star']],
    inProgress:[['Swimming',2,5]],
    nextRank:'Star', nextDone:['1','2','3','4','5','6a','6b','7'], asOf:'2026-09-08',
    positions:[['Patrol Leader','2025-06-01','2025-11-30'],['Historian','2025-12-01','']],
    awards:[["Totin' Chip",'2023-03-14','2023-03-14'],["Firem'n Chit",'2023-03-14','2023-03-14']],
    training:[['Youth Protection Training','2026-01-25','2028-01-25']],
    totals1:[38,2,31,6,60,12], totals2:[10,4,0,2,0,0], oa:['Yes','','','',''] },

  { name:'Delacroix, Nolan', patrol:'Raven Patrol', bsa:'10000004', id:'5004', joined:'2024-09-10',
    rank:'Second Class', ranks:[['Scout','2024-09-10','2024-10-08'],['Tenderfoot','2024-12-10','2025-01-14'],['Second Class','2025-06-10','2025-07-08']],
    badges:[['*Swimming','2025-07-15',''],['*First Aid','2026-03-10','']],
    inProgress:[['Cooking',2,5]],
    nextRank:'First Class', nextDoneCount:15, asOf:'2026-09-01',
    positions:[['Scribe','2026-01-01','']], awards:[["Totin' Chip",'2024-10-08','2024-10-08']], training:[['Youth Protection Training','2026-01-25','2028-01-25']],
    totals1:[24,0,18,3,34,6], totals2:[6,2,0,0,0,0], oa:['Yes','','','',''] },

  { name:'Emberly, Caleb', patrol:'Stag Patrol', bsa:'10000005', id:'5005', joined:'2025-02-11',
    rank:'Tenderfoot', ranks:[['Scout','2025-02-11','2025-03-11'],['Tenderfoot','2025-05-13','2025-06-10']],
    badges:[['*Swimming','2025-11-11','']], inProgress:[['Camping',3,7]],
    nextRank:'Second Class', nextDoneCount:11, asOf:'2026-09-01',
    positions:[], awards:[["Totin' Chip",'2025-03-11','2025-03-11']], training:[['Youth Protection Training','2026-02-03','2028-02-03']],
    totals1:[16,0,12,0,20,0], totals2:[0,0,0,0,0,0], oa:null },

  { name:'Fenwick, Ian', patrol:'Stag Patrol', bsa:'10000006', id:'5006', joined:'2026-05-12',
    rank:'', ranks:[], badges:[], inProgress:[],
    nextRank:'Scout', nextDone:CODES['Scout'].filter(c => c !== '7'), asOf:'2026-09-15',
    positions:[], awards:[], training:[['Youth Protection Training','2026-05-12','2028-05-12']],
    totals1:[4,0,3,0,6,0], totals2:[0,0,0,0,0,0], oa:null },

  { name:'Garrity, Sam', patrol:'Stag Patrol', bsa:'10000007', id:'5007', joined:'2023-09-12',
    rank:'Star', ranks:[['Scout','2023-09-12','2023-10-10'],['Tenderfoot','2023-11-14','2023-12-12'],['Second Class','2024-04-09','2024-05-14'],['First Class','2024-10-08','2024-11-12'],['Star','2026-02-10','2026-03-10']],
    badges:[['*First Aid','2024-05-14','Star'],['*Cooking','2024-08-13','Star'],['*Camping','2025-03-11','Star'],['*Swimming','2025-06-10','Star'],['Archery','2025-09-09','Star'],['Woodwork','2025-11-11','Star']],
    inProgress:[['Personal Fitness',3,4]],
    nextRank:'Life', nextDone:['2'], asOf:'2026-09-01',
    positions:[['Patrol Leader','2025-03-01','2025-08-31'],['Chaplain Aide','2025-09-01','']],
    awards:[["Totin' Chip",'2023-10-10','2023-10-10'],["Firem'n Chit",'2023-10-10','2023-10-10']],
    training:[['Youth Protection Training','2026-01-25','2028-01-25']],
    totals1:[42,3,40,8,66,20], totals2:[14,6,0,4,0,0], oa:['Yes','2025-05-10','2025-10-11','',''] }
];

function buildHistoryWorkbook(s){
  const rows = [[s.name], [],
    ['BSA ID','Rank','Patrol','Date Joined Unit'], [s.bsa, s.rank, s.patrol, serial(joinedFor(s))], []];
  if(s.ranks.length){
    rows.push(['Rank','','Date Earned','Date Awarded']);
    s.ranks.forEach(r => rows.push([r[0], '', serial(r[1]), serial(r[2])]));
    rows.push([]);
  }
  if(s.badges.length){
    rows.push(['Merit Badge','Earned','Awarded','Applied To Rank']);
    s.badges.forEach(b => rows.push([b[0], serial(b[1]), serial(addDays(b[1], 21)), b[2]]));
    rows.push([]);
  }
  if(s.inProgress.length){
    rows.push(['Merit Badge','Started','Completed Requirements','Uncompleted Requirements']);
    s.inProgress.forEach(b => rows.push([b[0], serial('2026-03-03'), b[1], b[2]]));
    rows.push([]);
  }
  if(s.positions.length){
    rows.push(['Position','Start','End']);
    s.positions.forEach(p => rows.push([p[0], serial(p[1]), serial(p[2])]));
    rows.push([]);
  }
  if(s.awards.length){
    rows.push(['Award','Earned','Awarded']);
    s.awards.forEach(a => rows.push([a[0], serial(a[1]), serial(a[2])]));
    rows.push([]);
  }
  if(s.training.length){
    rows.push(['Training','Completed','Expires']);
    s.training.forEach(t => rows.push([t[0], serial(t[1]), t[2] ? usDate(t[2]) : '']));
    rows.push([]);
  }
  rows.push(['Camping Nights','Total Cabin Camping','Total Service Hours','Total Conservation Hours','Total Hiking Miles','Total Backpacking Miles'], s.totals1, []);
  rows.push(['Total Cycling Miles','Total Paddling Miles','Total Motorboating Miles','Total Water Hours','Total Horseback Miles','Total Skating Miles'], s.totals2, []);
  if(s.oa) rows.push(['OA Eligibility','OA Call Out','OA Ordeal','OA Brotherhood','OA Vigil'], [s.oa[0], serial(s.oa[1]), serial(s.oa[2]), serial(s.oa[3]), serial(s.oa[4])]);

  // Sheet 2: Rank Requirement Completion Dates
  const req = [['Rank Requirement Completion Dates'], ['Award','Code','Requirement','Earned']];
  RANK_ORDER.forEach((rn, i) => {
    const earned = s.ranks.find(r => r[0] === rn);
    const prev = i > 0 ? s.ranks.find(r => r[0] === RANK_ORDER[i-1]) : null;
    const start = prev ? prev[1] : joinedFor(s);
    if(earned){
      rankReqRows(rn, CODES[rn], start, earned[1]).forEach(r => req.push(r));
    } else if(s.nextRank === rn){
      let done = s.nextDone;
      if(!done && s.nextDoneCount) done = CODES[rn].slice(0, s.nextDoneCount);
      rankReqRows(rn, done, start, s.asOf).forEach(r => req.push(r));
    } else if(rn === 'Eagle' && s.eagleDone){
      rankReqRows(rn, s.eagleDone, start, s.eagleAsOf, s.eagleDates).forEach(r => req.push(r));
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Scouting History');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(req), 'Rank Requirements');
  return XLSX.write(wb, { bookType:'biff8', type:'buffer' });
}

/* ============================ FAKE TWH SITE ============================ */
function shellHtml(injected, dark){
  const bg = dark ? '#161a20' : '#ffffff', fg = dark ? '#e6e9ee' : '#222';
  return '<!doctype html><html><head><meta charset="utf-8"><title>Troop 999 - Scouting History Report</title><style>' +
    'body{margin:0;background:'+bg+';color:'+fg+';font-family:Arial,Helvetica,sans-serif;}' +
    '.navtable{background:#1f3a5f;} .banner-div{background:#14284a;} ' +
    '.nav-tabs li a{background:#c9a227;color:#fff;} .RequiredIndicator{color:#b22222;} ' +
    '.navlink a{color:#f2d060;} a{color:#2b6cb0;} ' +
    '#fake-header{background:#14284a;color:#fff;padding:10px 18px;font-size:14px;}' +
    '</style></head><body><div id="fake-header"><b>Troop 999</b> &nbsp;|&nbsp; Home &nbsp; Calendar &nbsp; Reports &nbsp; Members</div>' +
    injected + '</body></html>';
}
const DIRECTORY_CSV = 'Name,Patrol,BSA Number\r\n' + SCOUTS.map(s => '"' + s.name + '","' + s.patrol + '",' + s.bsa).join('\r\n') + '\r\n';
const BSA_GRID_HTML = '<!doctype html><html><body><table><thead><tr><th>Name</th><th>BSA ID</th></tr></thead><tbody>' +
  SCOUTS.map((s, i) => '<tr><input type="hidden" id="CHILDCB9000ROW' + (i+1) + '" value="' + s.id + '"><td>' + s.name + '</td><td><input type="text" value="' + s.bsa + '"></td></tr>').join('') +
  '</tbody></table></body></html>';
const SHEETJS_LOCAL = path.join(path.dirname(require.resolve('xlsx')), 'dist', 'xlsx.full.min.js');

async function newFakePage(browser, dark){
  const page = await browser.newPage();
  await page.setViewport({ width: 860, height: 1200, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  page.on('request', req => {
    const url = req.url();
    const respond = (status, type, body, delay) => setTimeout(() => req.respond({ status, contentType: type, body }), delay || 0);
    if(url.startsWith('https://cdn.sheetjs.com/')) return respond(200, 'application/javascript', fs.readFileSync(SHEETJS_LOCAL));
    if(!url.startsWith(ORIGIN)) return req.abort();
    if(url.indexOf('/Custom.aspx') !== -1) return respond(200, 'text/html', shellHtml(html, dark));
    if(url.indexOf('FormReport.aspx?Menu_Item_ID=46012') !== -1) return respond(200, 'text/csv', DIRECTORY_CSV, 150);
    if(url.indexOf('FormList.aspx?Menu_Item_ID=56934') !== -1) return respond(200, 'text/html', BSA_GRID_HTML, 150);
    if(url.indexOf('FormReportMultiSection.aspx') !== -1){
      const m = url.match(/[?&]FK=([^&]+)/);
      const s = SCOUTS.find(x => x.id === (m && decodeURIComponent(m[1])));
      if(!s) return respond(404, 'text/plain', 'not found');
      return respond(200, 'application/vnd.ms-excel', buildHistoryWorkbook(s), page.__delay || 0);
    }
    return respond(404, 'text/plain', 'not found');
  });
  page.__delay = 0;
  await page.goto(ORIGIN + '/Custom.aspx', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.shr-scout-cb').length === 7, { timeout: 15000 });
  return page;
}
async function shotRegion(page, file, fromSel, toSel, pad){
  const clip = await page.evaluate((fromSel, toSel, pad) => {
    const a = document.querySelector(fromSel).getBoundingClientRect();
    const b = document.querySelector(toSel).getBoundingClientRect();
    const sx = window.scrollX, sy = window.scrollY;
    return { x: Math.max(0, a.left + sx - pad), y: Math.max(0, a.top + sy - pad), width: Math.min(document.documentElement.clientWidth, Math.max(a.width, b.width) + pad*2), height: (b.bottom - a.top) + pad*2 };
  }, fromSel, toSel, pad || 0);
  await page.screenshot({ path: path.join(OUT_DIR, file), clip });
  console.log('wrote', file);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const chromium = (await import('@sparticuz/chromium')).default;
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
  try {
    /* ---- 1 & 2: picker, then readiness filter ---- */
    let page = await newFakePage(browser, false);
    await page.evaluate(() => { // tick one patrol header and one Scout from the other patrol
      document.querySelector('.shr-patrol-cb[data-patrol-idx="0"]').click();
      document.querySelectorAll('.shr-scout-cb')[5].click();
    });
    await shotRegion(page, '01-scout-picker.png', '#shr-root header', '#shr-step1', 8);

    await page.evaluate(() => { document.querySelectorAll('.shr-patrol-cb, .shr-scout-cb').forEach(cb => { cb.checked = false; }); });
    await page.click('#shr-ready-filter');
    await page.waitForFunction(() => /Readiness check complete/.test(document.getElementById('shr-ready-status').textContent), { timeout: 20000 });
    await sleep(300);
    const tags = await page.$$eval('.shr-ready-tag', els => els.map(e => e.textContent));
    console.log('readiness tags:', tags);
    await shotRegion(page, '02-readiness-filter.png', '#shr-step1', '#shr-step1', 8);

    /* ---- 3: build in progress (Stop button visible) ---- */
    await page.click('#shr-ready-filter');               // back to the full list
    await sleep(200);
    await page.evaluate(() => { document.getElementById('shr-select-all').click(); });
    page.__delay = HISTORY_DELAY_MS;
    await page.click('#shr-generate');
    await sleep(HISTORY_DELAY_MS * 3 + 400);
    await shotRegion(page, '03-build-in-progress.png', '#shr-step2', '#shr-step2', 8);

    /* ---- 4 & 5: detailed and one-page views ---- */
    await page.waitForFunction(() => /^Done\.|Done\./.test(document.getElementById('shr-gen-status').textContent) && !document.getElementById('shr-generate').disabled, { timeout: 30000 });
    await sleep(300);
    const pageIndex = name => page.evaluate(n => Array.prototype.findIndex.call(document.querySelectorAll('.shr-scout-page .shr-name'), e => e.textContent.indexOf(n) === 0), name);
    const bIdx = await pageIndex('Bellweather');
    const box = async (sel, i) => { const els = await page.$$(sel); return els[i]; };
    await page.evaluate(i => document.querySelectorAll('.shr-scout-page')[i].id = 'shot-target', bIdx);
    await page.evaluate(() => { const s = document.getElementById('shr-step2'); s.id = 'shr-step2'; });
    await shotRegion(page, '04-detailed-view.png', '#shot-target', '#shot-target', 8);

    await page.click('#shr-view-summary');
    await sleep(500);
    const aIdx = await page.evaluate(() => Array.prototype.findIndex.call(document.querySelectorAll('.shr-consolidated-page .shr-name'), e => e.textContent.indexOf('Ashworth') === 0));
    await page.evaluate(i => document.querySelectorAll('.shr-consolidated-page')[i].id = 'shot-target2', aIdx);
    await shotRegion(page, '05-one-page-summary.png', '#shot-target2', '#shot-target2', 8);
    await page.close();

    /* ---- 6: dark site theme ---- */
    page = await newFakePage(browser, true);
    await page.evaluate(() => { document.querySelector('.shr-patrol-cb[data-patrol-idx="1"]').click(); });
    await shotRegion(page, '06-dark-theme.png', '#shr-root header', '#shr-step1', 8);
    await page.close();
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
