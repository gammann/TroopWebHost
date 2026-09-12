// Self-contained logic test for vcard-export.html's parsing, name-matching,
// and vCard-building functions.
//
// Every row below is invented for this test -- none of it is any real
// troop's data, and this file has no dependency on any external CSV or
// JSON export. Two edge cases are deliberately built into the fake data
// because real exports have been observed to contain them and the code
// has to handle both correctly:
//   1. A nickname mismatch between Scout Directory (which substitutes a
//      Scout's preferred name directly) and the Parent Cross Reference
//      (which gives the legal first name with the nickname in quotes).
//   2. A parent and child sharing an identical "Last, First MiddleInitial"
//      string, which can make a name-based join silently attach the
//      wrong person's patrol unless it's specifically guarded against.
//
// Run with: node test_harness.js
// (expects logic_only.js in the same directory -- extract it fresh from
// vcard-export.html with the snippet in the README's "Screenshot
// generation" section, or reuse an existing extraction.)

var fs = require('fs');
eval(fs.readFileSync('logic_only.js', 'utf8'));

function csvToRows(csv){
  var lines = csv.trim().split(/\r?\n/);
  var headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(function(line){
    var cells = parseCsvLine(line);
    var row = {};
    headers.forEach(function(h, i){ row[h] = cells[i] || ''; });
    return row;
  });
}
function parseCsvLine(line){
  var out = [], cur = '', inQuotes = false;
  for(var i=0;i<line.length;i++){
    var c = line[i];
    if(inQuotes){
      if(c === '"'){
        if(line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += c; }
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ out.push(cur); cur = ''; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}

// ---- fake Scout Directory ----
// "Reed, Sam J" (a Scout) and "Reed, Sam J" (an Adult, unrelated fake
// data) deliberately share an identical name -- the collision case.
// "Nguyen, Alex T" uses a substituted preferred name -- the nickname
// mismatch case, resolved against the Cross Reference row below.
var scoutDirCsv = [
  'Name,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Email,Email #2,SMS,Age,Grade,Rank,Patrol,Leadership',
  '"Ortiz, Maya",12 Willow St,,Fakeville,TX,75001,555-201-1001,,maya.ortiz.scout@example.com,,,13,8,Star,Falcon Patrol,Patrol Leader',
  '"Nguyen, Alex T",45 Poplar Ave,,Fakeville,TX,75001,555-201-1002,,alex.nguyen.scout@example.com,,,12,7,Tenderfoot,Falcon Patrol,',
  '"Reed, Sam J",78 Cedar Rd,,Fakeville,TX,75002,555-201-1003,,sam.reed.scout@example.com,,,11,6,Scout,New Scout Patrol,'
].join('\r\n');

// ---- fake Adult Directory ----
// "Reed, Sam J" here is a DIFFERENT, unrelated fake adult who just
// happens to share the Scout's exact name string.
var adultDirCsv = [
  'Name,Mailing Address Line 1,Mailing Address Line 2,City,State,Zip Code,Home Phone,Cell Phone,Business Phone,Email,Email #2,SMS,Leadership',
  '"Ortiz, Diane",12 Willow St,,Fakeville,TX,75001,555-201-1001,555-201-1099,,diane.ortiz@example.com,,,Scoutmaster',
  '"Reed, Sam J",900 Oak Ln,,Fakeville,TX,75003,555-201-1050,555-201-1051,,sam.reed.adult@example.com,,,Committee Member'
].join('\r\n');

// ---- fake Patrol Roster ----
// Two rows both named "Reed, Sam J" -- one for the Scout's own patrol
// (matches what Scout Directory already says), one for the unrelated
// adult's "Old Goat" patrol. A naive join would let whichever row comes
// last silently overwrite the adult's real patrol with the Scout's.
var patrolRosterCsv = [
  'Patrol,Name,Age,Leadership,Rank',
  'Old Goat,"Ortiz, Diane",,Scoutmaster,',
  'Falcon Patrol,"Ortiz, Maya",13,Patrol Leader,Star',
  'Falcon Patrol,"Nguyen, Alex T",12,,Tenderfoot',
  'New Scout Patrol,"Reed, Sam J",11,,Scout',
  'Old Goat,"Reed, Sam J",,Committee Member,'
].join('\r\n');

// ---- fake Scout Parent Cross Reference With Contact Info ----
// Note the Nguyen row: Cross Reference spells the Scout's name with the
// legal first name + quoted nickname, NOT the "Alex T" Scout Directory
// uses -- this is the nickname-mismatch case.
var xrefCsv = [
  'Scout,Parent/Guardian,Relationship,Parent\'s Phone,Parent\'s E-Mail',
  '"Ortiz, Maya","Ortiz, Diane",Parent,C: 555-201-1099,diane.ortiz@example.com',
  '"Nguyen, Alexander T ""Alex""","Nguyen, Linh",Parent,C: 555-201-1077,linh.nguyen@example.com',
  '"Reed, Sam J","Reed, Patricia",Parent,C: 555-201-1088,patricia.reed@example.com'
].join('\r\n');

var scouts = parseScouts(csvToRows(scoutDirCsv));
var adults = parseAdults(csvToRows(adultDirCsv));
console.log('Scouts parsed:', scouts.length, '(expect 3)');
console.log('Adults parsed:', adults.length, '(expect 2)');

joinAdultPatrols(adults, scouts, csvToRows(patrolRosterCsv));
var reedAdult = adults.filter(function(a){ return a.displayName === 'Reed, Sam J'; })[0];
var reedScout = scouts.filter(function(s){ return s.displayName === 'Reed, Sam J'; })[0];
console.log('\n--- Name-collision safeguard ---');
console.log('Scout "Reed, Sam J" patrol (direct from Scout Directory):', JSON.stringify(reedScout.patrol), '(expect "New Scout Patrol")');
console.log('Adult "Reed, Sam J" patrol (via join):', JSON.stringify(reedAdult.patrol), '(expect "" -- left blank on purpose rather than risk the wrong assignment; see README)');
var dianeAdult = adults.filter(function(a){ return a.displayName === 'Ortiz, Diane'; })[0];
console.log('Unrelated adult "Ortiz, Diane" patrol (via join, sanity check the join still works normally):', JSON.stringify(dianeAdult.patrol), '(expect "Old Goat")');

joinParents(scouts, csvToRows(xrefCsv));
var alex = scouts.filter(function(s){ return s.displayName === 'Nguyen, Alex T'; })[0];
console.log('\n--- Nickname-mismatch join ---');
console.log('Scout Directory name: "Nguyen, Alex T"  vs  Cross Reference name: "Nguyen, Alexander T \\"Alex\\""');
console.log('Parents joined despite the mismatch:', alex.parents.length, '(expect 1)');
console.log(JSON.stringify(alex.parents, null, 1));

var all = sortPeople(scouts.concat(adults));
var keyCount = {};
all.forEach(function(p){ keyCount[p.key] = (keyCount[p.key]||0)+1; });
var dupes = Object.keys(keyCount).filter(function(k){ return keyCount[k]>1; });
console.log('\n--- Key uniqueness ---');
console.log('Total combined people:', all.length, '(expect 5)');
console.log('Duplicate keys:', dupes.length, '(expect 0)');

console.log('\n--- Build every card, check for exceptions ---');
var allOpts = {org:true,title:true,categories:true,address:true,cell:true,home:true,work:true,email1:true,email2:true,age:true,grade:true,parent:true};
var errors = [];
all.forEach(function(p){
  try { buildVCard(p, allOpts, 'Troop 1234'); }
  catch(e){ errors.push(p.displayName+': '+e.message); }
});
console.log('Build errors:', errors.length, errors);

console.log('\n--- Sample rendered card (Maya Ortiz, Scout, all fields on) ---');
var maya = scouts.filter(function(s){ return s.displayName === 'Ortiz, Maya'; })[0];
console.log(buildVCard(maya, allOpts, 'Troop 1234'));
