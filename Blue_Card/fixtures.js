// Synthetic data ONLY -- every name, address, email and number below is
// invented. Used by test_harness.js and gen_screenshots.js.
const range=(p,a,b)=>{const o=[];for(let c=a.charCodeAt(0);c<=b.charCodeAt(0);c++)o.push(p+'.'+String.fromCharCode(c));return o;};
const REQS={
  'First Aid':[...range('01','a','g'),'02.','03.',...range('03','a','e'),'04.a','04.b',...range('07','a','g'),'08.a','08.b','08.c','08.d','08.d.1','08.d.2','09.','10.','11.','12.'],
  'Camping':['01.a','01.b','01.c','02.','03.','04.a','04.b','05.a','05.b','05.c','06.a','07.a','07.b','08.b','09.a','09.b.3','10.'],
  'Cooking':[...range('1','a','e'),...range('2','a','e'),'3.a','3.b','3.c','3.d','4.f','7.','7.a','7.b'],
  'Emergency Preparedness':['1.a','1.b','2.b','2.b.01','2.b.02','2.b.03','3.','4.a','4.b','6.a','6.b','6.b.1','6.b.2','8.a','8.a.1','8.b'],
  'Shotgun Shooting':[...range('2A','a','d')],
  'Photography':[],
  'Personal Management':['1.a','1.b','2.a','2.b','2.c','3.','4.a','5.'],
  'Citizenship in the World':['1.','2.a','2.b','3.'],
  'Fish and Wildlife Management':['1.a','1.b','1.c','2.','3.a','3.b','4.','5.'],
  'Search and Rescue':['1.a','1.b','2.'],
};
const SCOUTS=[
  ['Avery Jordan Lindqvist','100 Sample Street','Springfield','VA','22150'],
  ['Bryn Ellis Marchetti','214 Example Lane','Springfield','VA','22152-1107'],
  ['Casey Rowan Okonkwo','9 Fictional Court','Burke','VA','22015'],
  ['Devon Alexander Prakash','58 Placeholder Road Apt 4B','Fairfax','VA','22030'],
  ['Emerson Quinn Halvorsen','77 Test Boulevard','Springfield','VA','22151'],
  ['Finley Sage Delacroix-Whitmore','1234 Extraordinarily Long Sample Boulevard','Springfield','VA','22150'],
  ['Gray Mateo Villanueva','31 Demo Way','Annandale','VA','22003'],
  ['Harper Lane Ostrowski','402 Mock Terrace','Springfield','VA','22153'],
];
const PLAN={0:['First Aid','Camping','Photography'],1:['Cooking','Emergency Preparedness'],2:['Personal Management','Shotgun Shooting'],3:['Camping'],4:['Citizenship in the World','Search and Rescue'],5:['Fish and Wildlife Management','First Aid'],6:['Cooking'],7:['Camping','Personal Management']};
const COUNSELORS={'First Aid':'Morgan Ellery','Cooking':'Riley Thornwood','Camping':'','Emergency Preparedness':'Jamie Unlisted'};
function csvRows(){
  const q=s=>/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  const lines=['ScoutName,MeritBadge,DateStarted,ScoutAddress,ScoutCity,ScoutState,ScoutZip,CounselorName,CompletedRequirements'];
  let d=0;
  SCOUTS.forEach((s,i)=>PLAN[i].forEach(b=>{
    const dt=`${(d%12)+1}/${(d*3%27)+1}/${2023+(d%3)} 12:00:00 AM`; d++;
    lines.push([s[0],b,dt,s[1],s[2],s[3],s[4],COUNSELORS[b]||'',REQS[b].join(';')].map(q).join(','));
  }));
  return lines.join('\r\n')+'\r\n';
}
const scoutDir=()=>['Name,Patrol,Rank,Leadership,Age,Grade,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Email,Email #2',
  '"Lindqvist, Avery Jordan",Eagles,Star,,14,9,100 Sample Street,,Springfield,VA,22150,,,avery.sample@example.com,',
  '"Marchetti, Bryn Ellis",Eagles,Life,Patrol Leader,15,10,214 Example Lane,,Springfield,VA,22152,,,bryn.sample@example.com,',
  '"Okonkwo, Casey Rowan",Hawks,First Class,,13,8,9 Fictional Court,,Burke,VA,22015,,,,casey.alt@example.com',
  '"Prakash, Devon Alexander",Hawks,Second Class,,12,7,58 Placeholder Road,Apt 4B,Fairfax,VA,22030,,,devon.sample@example.com,'].join('\r\n')+'\r\n';
const adultDir=()=>['Name,Patrol,Rank,Leadership,Age,Grade,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Business Phone,Email,Email #2',
  '"Fernsby, Corey",,,Scoutmaster,,,1 Leader Lane,,Springfield,VA,22150,,555-010-0001,,scoutmaster@example.com,',
  '"Rosales, Jordan",,,Assistant Scoutmaster,,,2 Leader Lane,,Springfield,VA,22150,,555-010-0002,,asm@example.com,',
  '"Ellery, Morgan",,,Merit Badge Counselor,,,400 Counselor Court,Suite 2,Fairfax,VA,22030,555-010-0100,555-010-0101,,morgan.counselor@example.com,',
  '"Thornwood, Riley",,,Committee Member,,,88 Elm Row,,Burke,VA,22015,555-010-0200,,,riley.counselor@example.com,'].join('\r\n')+'\r\n';
const exportHtml=()=>`<!DOCTYPE html><html><head><title>Troop 1776 Exampleville</title></head><body>
<form id="easyform" name="easyform" method="post" action="https://www.TroopWebHost.org/FormDetail.aspx" enctype="multipart/form-data">
<input type="hidden" name="menuopenflag" value="N"><input type="hidden" name="Selected_Action" value=""><input type="hidden" name="Hover_Action" value="">
<input type="hidden" name="Selected_Button_ID" value=""><input type="hidden" name="Menu_Item_ID" value="45954"><input type="hidden" name="Form_ID" value="1689">
<input type="hidden" name="Pass" value="1"><input type="hidden" name="Stack" value="2"><input type="hidden" name="ChildRowID" value="0">
<input type="hidden" name="Current_URL" value="https://www.troopwebhost.org/FormDetail.aspx?Menu_Item_ID=45954&Stack=2"><input type="hidden" name="FK" value="0"><input type="hidden" name="ID" value="1">
<h2>Blue Cards</h2>
<table><tbody><tr id="DIVENTRY9999001"><td><label class="control-label">Export Merit Badges Started Since</label></td><td>
<input type="hidden" name="RVALENTRY9999001" value="N"><input type="hidden" name="OLD9999001" value="09/20/2026">
<input type="text" class="form-control" id="ENTRY9999001" name="ENTRY9999001" value="09/20/2026" size="12"></td></tr></tbody></table>
<input class="btn" id="BUTTON7" type="button" name="save continue" title="Download Blue Cards File" value="Download Blue Cards File">
<input class="btn" id="BUTTON8" type="button" name="cancel" title="Exit" value="Exit">
<h2>Award Cards</h2><input class="btn" id="BUTTON12" type="button" name="save continue" title="Download Awards File" value="Download Awards File">
<input type="radio" name="Report_option" value="1"><input type="radio" name="Report_option" value="2" checked>
<input type="radio" name="Page_Layout" value="1" checked><input type="hidden" name="FirstControl" value="ENTRY9999001">
</form></body></html>`;
module.exports={csv:csvRows,scoutDir,adultDir,exportHtml,REQS,SCOUTS};
