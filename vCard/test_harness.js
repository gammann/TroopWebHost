var fs = require('fs');
eval(fs.readFileSync('logic_only_v2.js', 'utf8'));

var scoutRows = JSON.parse(fs.readFileSync('scout_rows.json', 'utf8'));
var adultRows = JSON.parse(fs.readFileSync('adult_rows.json', 'utf8'));
var patrolRows = JSON.parse(fs.readFileSync('patrol_rows.json', 'utf8'));
var xrefRows = JSON.parse(fs.readFileSync('xref_rows.json', 'utf8'));

var scouts = parseScouts(scoutRows);
var adults = parseAdults(adultRows);
console.log('Scouts parsed:', scouts.length, '(expect 48)');
console.log('Adults parsed:', adults.length, '(expect 78)');

joinAdultPatrols(adults, scouts, patrolRows);
var adultsWithPatrol = adults.filter(function(a){ return a.patrol; });
console.log('Adults with a patrol assigned via join:', adultsWithPatrol.length, '(expect 15 -- the Cohen collision is now correctly left blank instead of wrong)');
console.log('Sample:', adultsWithPatrol.slice(0,3).map(function(a){ return a.displayName+' -> '+a.patrol; }));

joinParents(scouts, xrefRows);
var scoutsWithParents = scouts.filter(function(s){ return s.parents.length; });
var totalParentRows = scouts.reduce(function(sum,s){ return sum+s.parents.length; }, 0);
console.log('Scouts with >=1 parent joined:', scoutsWithParents.length, '/', scouts.length);
console.log('Total parent rows joined:', totalParentRows, '(expect 83, all joined, zero ambiguous/unmatched)');
var scoutsWithoutParents = scouts.filter(function(s){ return !s.parents.length; });
console.log('Scouts with NO parent row (worth eyeballing, not necessarily a bug):', scoutsWithoutParents.map(function(s){return s.displayName;}));

// Freddie/Frederick nickname-mismatch case specifically
var freddie = scouts.filter(function(s){ return s.displayName.indexOf('Britton')===0; })[0];
console.log('\\nBritton (nickname-mismatch case) parents joined:', freddie.parents.length, JSON.stringify(freddie.parents, null, 1));

// Key uniqueness across combined roster
var all = sortPeople(scouts.concat(adults));
var keyCount = {};
all.forEach(function(p){ keyCount[p.key] = (keyCount[p.key]||0)+1; });
var dupes = Object.keys(keyCount).filter(function(k){ return keyCount[k]>1; });
console.log('\\nTotal combined people:', all.length, '(expect 126)');
console.log('Duplicate keys:', dupes.length);

// Build vcards for everyone with all opts on, check for exceptions
var allOpts = {org:true,title:true,categories:true,address:true,cell:true,home:true,work:true,email1:true,email2:true,age:true,grade:true,parent:true};
var errors = [];
all.forEach(function(p){
  try { buildVCard(p, allOpts, 'Troop 1234'); }
  catch(e){ errors.push(p.displayName+': '+e.message); }
});
console.log('\\nBuild errors across all 126 people:', errors.length, errors);

// Show a full scout card (with parents) and a full adult card (with joined patrol)
console.log('\\n--- Sample Scout card (Derek Ammann) ---');
var derek = scouts.filter(function(s){ return s.displayName.indexOf('Ammann, Derek')===0; })[0];
console.log(buildVCard(derek, allOpts, 'Troop 1234'));

console.log('--- Sample Adult card with joined patrol (Jerry Ammann) ---');
var jerry = adults.filter(function(a){ return a.displayName.indexOf('Ammann, Jerry')===0; })[0];
console.log('Joined patrol for Jerry:', JSON.stringify(jerry.patrol));
console.log(buildVCard(jerry, allOpts, 'Troop 1234'));

// Cohen David A collision sanity check: adult Cohen should NOT get a
// patrol assigned from the scout's Phoenix (M) row, only from his own
// Old Goat row -- and definitely shouldn't crash or cross-contaminate.
console.log('--- Cohen collision check ---');
var cohenScout = scouts.filter(function(s){ return s.displayName === 'Cohen, David A'; })[0];
var cohenAdult = adults.filter(function(a){ return a.displayName === 'Cohen, David A'; })[0];
console.log('Scout Cohen patrol (from Scout Directory directly):', cohenScout.patrol);
console.log('Adult Cohen patrol (via join):', cohenAdult.patrol);
