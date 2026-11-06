const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {calculate,todayInKorea}=require('./dist/memorial-anniversaries.js');
const read=name=>readFileSync(name,'utf8');
const html=read('dist/memorial.html'),css=read('dist/memorial.css');
const kiosk=read('dist/memorial-communal.html'),kioskJs=read('dist/memorial-communal.js');
const archive=read('dist/memorial-archive.html'),archiveJs=read('dist/memorial-archive.js');
const story=read('dist/memorial.js'),sql=read('018_haemungi_communal_guest_message_policy.sql');

// Two visible registration entrances, and eight locations in a fixed 2x4 map.
assert.match(html,/class="options-grid"/);
assert.equal((html.match(/class="choice"/g)||[]).length,8);
assert.match(html,/class="options-register" type="button" data-go="apply"/);
assert.match(css,/#entranceOptions\{[^}]*overflow:hidden/s);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(kiosk,/data-kiosk-tab="register"/);
assert.match(kiosk,/data-kiosk-panel="register"/);
assert.match(kioskJs,/\['message','search','reservation','register'\]/);
assert.match(kiosk,/href="\/memorial\.html#apply"/);
assert.match(archive,/memorial-anniversaries\.js/);
assert.match(html,/memorial-anniversaries\.js/);
assert.match(kiosk,/memorial-anniversaries\.js/);
assert.match(archiveJs,/HAEMUNGI_MEMORIAL_DATES/);
assert.match(story,/anniversary-panel/);
assert.match(kioskJs,/kiosk-memory-date/);
assert.match(html,/태어난 날 · 생일/);

// Anonymous approved-message reads cannot reference hm_admins.
assert.match(sql,/for select to anon using \(status='approved'\)/);
assert.match(sql,/for select to authenticated using/);
assert.doesNotMatch(sql,/drop table|delete from|truncate table/i);

// Korean local calendar dates; passing day is day 1 of the 49-day remembrance.
const leo={born_on:'2025-11-10',passed_on:'2026-07-01'};
const nov=calculate(leo,'2026-11-07');
assert.equal(nov.since,129);
assert.equal(nov.events.find(e=>e.kind==='day49').date,'2026.08.18');
assert.equal(nov.events.find(e=>e.kind==='birthday').daysUntil,3);
assert.equal(nov.events.find(e=>e.kind==='memorial').date,'2027.07.01');
assert.equal(nov.events.find(e=>e.kind==='memorial').label,'첫 기일 · 1주기');
assert.equal(calculate(leo,'2026-07-01').since,0);
assert.equal(calculate(leo,'2026-08-18').events.find(e=>e.kind==='day49').note,'오늘');
assert.equal(calculate(leo,'2027-07-01').events.find(e=>e.kind==='memorial').note,'오늘');
assert.equal(calculate(leo,'2026-11-10').events.find(e=>e.kind==='birthday').note,'오늘');
assert.equal(calculate(leo,'2026-11-11').events.find(e=>e.kind==='birthday').date,'2027.11.10');
assert.equal(calculate({passed_on:'2026-11-05'},'2026-11-07').since,2);
assert.equal(calculate({passed_on:'2026-11-05'},'2026-11-07').hasBirthday,false);
assert.equal(calculate({born_on:'2024-02-29'},'2025-02-10').events[0].date,'2025.02.28');
assert.equal(calculate({born_on:'2026-02-29'},'2026-11-07').events.length,0);
assert.deepEqual(calculate({},'2026-11-07').events,[]);
assert.equal(calculate({passed_on:'2027-01-01'},'2026-11-07').since,null);
assert.equal(todayInKorea(new Date('2026-11-06T16:30:00Z')),'2026-11-07');
console.log('PASS entry & dates: 8 fixed tiles + registration, kiosk registration, accessible story/archive cards, 49th day, birthday, anniversary, KST, leap day and missing dates, public RLS split.');
