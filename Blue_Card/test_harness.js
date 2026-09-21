/* Blue Card Printer -- test harness.
   Part 1: unit tests of the pure logic (extracted from blue-card.html
           between its BEGIN/END PURE LOGIC markers -- no DOM, no network).
   Part 2: end-to-end tests in headless Chromium against fake_twh.js (a real
           local HTTP server that issues genuine 302s) using ONLY the
           synthetic data in fixtures.js.
   Requires: npm i playwright pdf-lib ; qpdf, pdftotext, pdftoppm (poppler).
   Run from this folder:  node test_harness.js                            */
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const { execSync } = require('child_process');
const fx = require('./fixtures.js');
const HTML = path.join(__dirname, 'blue-card.html');
const TEMPLATE = path.join(__dirname, 'blue-card-template.pdf');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };

/* ---------------- Part 1: pure logic ---------------- */
console.log('== unit tests');
const html = fs.readFileSync(HTML, 'utf8');
const src = html.slice(html.indexOf('/* BEGIN PURE LOGIC */'), html.indexOf('/* END PURE LOGIC */'));
const api = new Function(src + '\nreturn {bcpParseCsv,bcpCsvObjects,bcpBuildCards,bcpBuildCells,bcpBuildPieces,bcpFmtDate,bcpCityStateZip,bcpDirKey,bcpFindByName,bcpHasLeadership,bcpDisplayName,BCP_GRID_SLOTS};')();
const P = (t, m) => api.bcpBuildPieces(t.split(';'), m || 'compact');
eq(P('01.a;01.b;01.c;01.d;01.e;01.f;01.g'), ['1a-g']);
eq(P('02.;02.a;02.b'), ['2'], 'parent listed -> children folded');
eq(P('03.;04.a;04.b;05.a;05.c'), ['3', '4a-b', '5a,c']);
eq(P('09.b.1;09.b.3;09.b.4'), ['9b(1,3-4)']);
eq(P('2.b;2.b.01;2.b.02'), ['2b']);
eq(P('2A.a;2A.b;2A.c'), ['2A.a-c']);
eq(P('5.B.a;5.B.b'), ['5B.a-b']);
eq(P('11.;12.;13.;14.'), ['11-14']);
eq(P('11.;12.'), ['11', '12']);
eq(P('10.;2.;1.'), ['1', '2', '10'], 'natural sort');
eq(P('01.a;01.b', 'full'), ['1a', '1b']);
eq(P('9.b.3', 'full'), ['9b(3)']);
eq(P('1.a;1.a;01.a'), ['1a'], 'dedupe');
eq(P(''), []);
eq(api.bcpParseCsv('a,b\r\n"x,1","he said ""hi"""\r\n\r\n'), [['a', 'b'], ['x,1', 'he said "hi"']]);
eq(api.bcpParseCsv('\uFEFFa,b\n1,2')[0], ['a', 'b'], 'BOM stripped');
eq(api.bcpFmtDate('1/28/2024 12:00:00 AM'), '1/28/2024');
eq(api.bcpFmtDate('5/19/2024 11:59:00 PM'), '5/19/2024', 'late-evening stamp keeps its date');
eq(api.bcpCityStateZip('Springfield', 'VA', ''), 'Springfield, VA');
eq(api.bcpCityStateZip('', '', '20147'), '20147');
const ents = ['Marlowe, Jesse Q', 'Van Der Berg, Jan "Johnny"', "O'Neill, Wren", 'Smith, Pat', 'Smith, Pat'].map(n => ({ key: api.bcpDirKey(n), row: { Name: n } }));
eq(api.bcpFindByName('Jesse Quinn Marlowe', ents).row.Name, 'Marlowe, Jesse Q');
eq(api.bcpFindByName('Johnny Van Der Berg', ents).row.Name, 'Van Der Berg, Jan "Johnny"', 'nickname + multi-word surname');
eq(api.bcpFindByName('Wren Avery ONeill', ents).row.Name, "O'Neill, Wren", 'apostrophe ignored');
eq(api.bcpFindByName('Pat Smith', ents), null, 'ambiguous match -> null (never guess)');
eq(api.bcpFindByName('Zed Nobody', ents), null);
eq(api.bcpHasLeadership('Assistant Scoutmaster', 'Scoutmaster'), false, 'exact-token leadership match');
eq(api.bcpHasLeadership('Scoutmaster, Committee Member', 'Scoutmaster'), true);
{ // fixtures through the real pipeline
  const { headers, objects } = api.bcpCsvObjects(fx.csv());
  const c = api.bcpBuildCards(headers, objects, 'compact');
  eq(c.length, 15, 'fixture rows -> 15 cards');
  eq(c.find(x => x.badge === 'First Aid').all.join('; '), '1a-g; 2; 3; 4a-b; 7a-g; 8a-d; 9-12');
  eq(c.find(x => x.badge === 'Camping').all.join('; '), '1a-c; 2; 3; 4a-b; 5a-c; 6a; 7a-b; 8b; 9a; 9b(3); 10');
  ok(c.every(x => x.overflow.length === 0), 'compact mode: no fixture card overflows the 22 columns');
  const f = api.bcpBuildCards(headers, objects, 'full');
  ok(f.some(x => x.overflow.length > 0), 'full mode: at least one card overflows into Remarks');
}
console.log('  ' + pass + ' unit assertions passed');

/* ---------------- Part 2: end to end ---------------- */
const { chromium } = require('playwright');
const create = require('./fake_twh');
const pdflib = fs.readFileSync(require.resolve('pdf-lib/dist/pdf-lib.min.js'));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'bcp-test-'));
console.log('== end-to-end');
async function boot(o={}){
  const srv=await create(Object.assign({toolPath:HTML,exportHtml:fx.exportHtml(),csv:fx.csv(),scoutDir:fx.scoutDir(),adultDir:fx.adultDir(),templatePath:TEMPLATE},o.srv||{}));
  const browser=await chromium.launch(); const ctx=await browser.newContext({acceptDownloads:true}); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({body:pdflib,contentType:'application/javascript'}));
  if(o.pdfBad) await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
  else await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({body:fs.readFileSync(TEMPLATE),contentType:'text/plain',headers:{'access-control-allow-origin':'*'}}));
  await page.goto('http://127.0.0.1:'+srv.port+'/Custom.aspx');
  return {srv,browser,page,errs};
}
const txt=async(p,id)=>(await p.textContent(id)).replace(/\s+/g,' ').trim();
async function download(page,btn){ const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.click(btn)]); const f=path.join(OUT,d.suggestedFilename()); await d.saveAs(f); return {file:f,name:d.suggestedFilename()}; }
const pages=f=>+execSync('qpdf --show-npages "'+f+'"').toString().trim();
const pdftext=(f,p)=>execSync('pdftotext -f '+p+' -l '+p+' -layout "'+f+'" -').toString();
(async()=>{
  console.log('== 1. happy path, enrichment, selection, generation');
  let {srv,browser,page,errs}=await boot();
  ok(await page.inputValue('#bcp-unit')==='1776','unit number auto-detected from page title');
  ok(await page.inputValue('#bcp-since')===(new Date().getFullYear()-6)+'-01-01','started-since defaults to Jan 1 six years back');
  await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  const st=await txt(page,'#bcp-load-status'); console.log('     ',st);
  ok(/Loaded 15 unfinished merit badges for 8 Scouts/.test(st),'15 badges / 8 scouts loaded');
  ok(/Scout emails found for 4 of 8/.test(st),'4 of 8 scout emails matched (incl. Email #2 fallback)');
  ok(/2 assigned counselor\(s\) matched/.test(st),'2 counselors matched (unlisted one skipped)');
  ok(await page.inputValue('#bcp-leader-email')==='scoutmaster@example.com','leader email = Scoutmaster (not Assistant Scoutmaster)');
  const post=srv.state.posts[0]; const g=n=>(post.find(p=>p.name===n)||{}).value;
  ok(g('ENTRY9999001')===(new Date().getFullYear()-6)+'/01/01'.replace(/^/,'')||/^01\/01\/\d{4}$/.test(g('ENTRY9999001')),'POST carried the chosen date (MM/DD/YYYY): '+g('ENTRY9999001'));
  ok(g('Selected_Button_ID')==='BUTTON7'&&g('Selected_Action')==='save continue','POST used BUTTON7 / "save continue"');
  ok(g('Report_option')==='2'&&g('Page_Layout')==='1','radio defaults preserved in POST');
  ok(!post.some(p=>p.name==='BUTTON12'),'awards-file button not submitted');
  // filter + selection
  await page.fill('#bcp-filter','cook'); ok(await page.locator('tr.bcp-row:not(.bcp-hidden)').count()===2,'filter "cook" shows 2 rows');
  await page.click('#bcp-select-none'); ok(/13 of 15 selected/.test(await txt(page,'#bcp-count')),'select-none acts on visible rows only');
  await page.fill('#bcp-filter',''); 
  await page.locator('.bcp-grp-cb').first().uncheck(); ok(/10 of 15|11 of 15/.test(await txt(page,'#bcp-count')),'scout group checkbox toggles all of a scout\'s rows');
  await page.click('#bcp-select-all');
  ok(/15 of 15 selected \u00b7 8 sheets/.test(await txt(page,'#bcp-count')),'15 cards -> 8 sheets at 2-up');
  // generate 2-up
  let d=await download(page,'#bcp-gen-btn'); console.log('     downloaded',d.name,fs.statSync(d.file).size,'bytes');
  ok(d.name==='Blue_Cards.pdf','multi-card filename is Blue_Cards.pdf');
  ok(pages(d.file)===16,'2-up: 8 sheets x (front+back) = 16 pages');
  const t1=pdftext(d.file,1);
  const all=execSync('pdftotext -layout "'+d.file+'" -').toString(); ok(/Avery Jordan Lindqvist/.test(all)&&/Emerson Quinn Halvorsen/.test(all),'scout names printed'); ok(/First Aid/.test(pdftext(d.file,2))||/First Aid/.test(all),'badge printed');
  ok(/1776/.test(t1)&&/scoutmaster@example\.com/.test(t1),'unit number and leader email printed');
  ok(/avery\.sample@example\.com/.test(all)&&/casey\.alt@example\.com/.test(all),'scout emails printed (incl. Email #2 fallback)');
  ok(/Morgan Ellery/.test(pdftext(d.file,2)+pdftext(d.file,4)+pdftext(d.file,6)),'counselor name printed');
  ok(/400 Counselor Court, Suite 2/.test(execSync('pdftotext -layout "'+d.file+'" -').toString()),'counselor address (line1 + line2) printed');
  ok(execSync('pdftoppm -r 20 -png "'+d.file+'" '+OUT+'/chk 2>&1 || true').toString().trim()==='','poppler renders with zero warnings');
  ok(execSync('qpdf --check "'+d.file+'" 2>&1').toString().includes('No syntax or stream encoding errors'),'qpdf --check clean');
  
  // 1-up single card
  await page.selectOption('#bcp-layout','1'); await page.click('#bcp-select-none');
  await page.locator('tr.bcp-row',{hasText:'Photography'}).locator('.bcp-row-cb').check();
  d=await download(page,'#bcp-gen-btn'); console.log('     downloaded',d.name);
  ok(/^Avery Jordan Lindqvist Photography 1776\.pdf$/.test(d.name),'single-card filename: "<Scout> <Badge> <Unit>.pdf"');
  ok(pages(d.file)===2,'1-up single card = 2 pages'); 
  // overflow: full mode + First Aid
  await page.selectOption('#bcp-reqmode','full'); await page.click('#bcp-select-none');
  await page.locator('tr.bcp-row',{hasText:'First Aid'}).first().locator('.bcp-row-cb').check();
  ok(await page.locator('.bcp-chip').count()>=1,'overflow chip shown in the table in "as recorded" mode');
  d=await download(page,'#bcp-gen-btn'); 
  ok(/Also completed/.test(pdftext(d.file,2)),'overflow requirements written into the Remarks box');
  ok(errs.length===0,'no page errors ('+errs.join('|')+')');
  await browser.close(); srv.close();

  console.log('== 2. access denied on the initial GET');
  ({srv,browser,page,errs}=await boot({srv:{denyExport:true}})); await page.click('#bcp-load-btn'); await page.waitForSelector('.bcp-restricted');
  ok(/Restricted/.test(await txt(page,'#bcp-load-status')),'GET redirect -> friendly "Restricted" message'); ok(srv.state.posts.length===0,'no POST attempted'); await browser.close(); srv.close();

  console.log('== 3. POST redirects somewhere other than FormCSV.aspx');
  ({srv,browser,page}=await boot({srv:{postRedirectsElsewhere:true}})); await page.click('#bcp-load-btn'); await page.waitForSelector('.bcp-restricted');
  ok(true,'POST redirect elsewhere -> "Restricted" (not treated as success)'); await browser.close(); srv.close();

  console.log('== 4. directories denied: cards still load, notes shown');
  ({srv,browser,page}=await boot({srv:{denyDirs:true}})); await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  const s4=await txt(page,'#bcp-load-status'); console.log('     ',s4);
  ok(/Loaded 15/.test(s4)&&/Scout Directory not available/.test(s4)&&/Adult Directory not available/.test(s4),'graceful degradation with clear notes'); await browser.close(); srv.close();

  console.log('== 5. CSV upload path + empty result + wrong file');
  ({srv,browser,page}=await boot()); fs.writeFileSync(OUT+'/up.csv',fx.csv());
  await page.setInputFiles('#bcp-csv-file',OUT+'/up.csv'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  ok(/Loaded 15/.test(await txt(page,'#bcp-load-status')),'uploaded CSV loads');
  fs.writeFileSync(OUT+'/hdr.csv','ScoutName,MeritBadge,DateStarted,ScoutAddress,ScoutCity,ScoutState,ScoutZip,CounselorName,CompletedRequirements\r\n');
  await page.setInputFiles('#bcp-csv-file',OUT+'/hdr.csv'); await page.waitForTimeout(400);
  ok(/no unfinished merit badges/.test(await txt(page,'#bcp-load-status')),'header-only CSV -> "no unfinished merit badges" message');
  fs.writeFileSync(OUT+'/bad.csv','Foo,Bar\r\n1,2\r\n'); await page.setInputFiles('#bcp-csv-file',OUT+'/bad.csv'); await page.waitForTimeout(400);
  ok(/does not look like the Troop Awards/.test(await txt(page,'#bcp-load-status')),'wrong CSV -> clear message'); await browser.close(); srv.close();

  console.log('== 6. template unreachable -> file-picker fallback');
  ({srv,browser,page}=await boot({pdfBad:true})); await page.click('#bcp-load-btn'); await page.waitForSelector('#bcp-results-card:not(.bcp-hidden)');
  await page.click('#bcp-gen-btn'); await page.waitForFunction(()=>/Could not generate/.test(document.getElementById('bcp-gen-status').textContent));
  ok(/Choose your own copy/.test(await txt(page,'#bcp-gen-status')),'unreachable template -> instructs to use file picker');
  await page.setInputFiles('#bcp-pdf-file',TEMPLATE);
  d=await download(page,'#bcp-gen-btn'); ok(pages(d.file)>=2,'local template file works after fallback'); await browser.close(); srv.close();
  console.log('\n'+pass+' passed, '+fail+' failed'); fs.rmSync(OUT,{recursive:true,force:true}); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(1)});
