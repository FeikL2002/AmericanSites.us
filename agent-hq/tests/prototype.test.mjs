import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createSession, parseStoredSession, nextSampleId, addParticipant,
  updateParticipant, summarizeSession, sessionToCsv,
} from '../public/prototypes/practice-desk/domain.mjs';

const session = (extra = {}) => createSession({date:'2026-11-09',label:'Sample evening practice',...extra});
const add = (current, sampleId, registrationComplete = false) => addParticipant(current,{sampleId,registrationComplete});
const freeze = value => {
  if(value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('practice concept starts empty with an explicit sample fee and a valid calendar date', () => {
  const initial=session();
  assert.equal(initial.date,'2026-11-09');
  assert.equal(initial.dropInCents,1000);
  assert.deepEqual(initial.participants,[]);
  assert.equal(createSession({date:'2024-02-29',label:'Leap day',dropInCents:0}).dropInCents,0);
  for(const date of ['2026-02-29','2026-99-01','2026-11-31','not-a-date','2026-1-01']) {
    assert.throws(()=>session({date}),/valid practice date/i);
  }
});

test('practice concept rejects missing labels and non-integer or out-of-range money', () => {
  for(const label of ['', '   ', 'a'.repeat(61), null]) assert.throws(()=>session({label}));
  for(const dropInCents of [-1,0.5,100001,NaN,Infinity,'1000']) assert.throws(()=>session({dropInCents}));
  assert.equal(session({label:'  Evening practice  '}).label,'Evening practice');
});

test('roster additions and participant edits leave their input records unchanged', () => {
  const initial=freeze(session());
  const roster=add(initial,'DEMO-001');
  assert.equal(initial.participants.length,0);
  const before=JSON.stringify(roster); freeze(roster);
  const edited=updateParticipant(roster,'DEMO-001',{registrationComplete:true});
  assert.equal(JSON.stringify(roster),before);
  assert.equal(edited.participants[0].registrationComplete,true);
  assert.notEqual(edited,roster);
  assert.notEqual(edited.participants[0],roster.participants[0]);
});

test('roster accepts anonymous sample IDs only and rejects duplicates', () => {
  for(const id of ['Lewis Feik','DEMO-000','DEMO-1','demo-001','DEMO-1000','<script>']) assert.throws(()=>add(session(),id));
  const roster=add(session(),'DEMO-001');
  assert.equal(nextSampleId(roster),'DEMO-002');
  assert.throws(()=>add(roster,'DEMO-001'),/already/i);
  assert.throws(()=>addParticipant(session(),{sampleId:'DEMO-001',registrationComplete:'yes'}));
});

test('sample roster is capped at 100 and gaps produce unused IDs', () => {
  let roster=add(session(),'DEMO-002');
  assert.equal(nextSampleId(roster),'DEMO-001');
  roster=session();
  for(let i=1;i<=100;i++) roster=add(roster,`DEMO-${String(i).padStart(3,'0')}`);
  assert.equal(roster.participants.length,100);
  assert.throws(()=>add(roster,'DEMO-101'),/100/);
});

test('check-in requires reviewed registration and cannot silently clear registration while inside', () => {
  let roster=add(session(),'DEMO-001');
  assert.throws(()=>updateParticipant(roster,'DEMO-001',{attendance:'in'}),/registration/i);
  roster=updateParticipant(roster,'DEMO-001',{registrationComplete:true});
  roster=updateParticipant(roster,'DEMO-001',{attendance:'in'});
  assert.equal(summarizeSession(roster).inside,1);
  assert.throws(()=>updateParticipant(roster,'DEMO-001',{registrationComplete:false}),/registration/i);
  roster=updateParticipant(roster,'DEMO-001',{attendance:'out'});
  roster=updateParticipant(roster,'DEMO-001',{registrationComplete:false});
  assert.equal(summarizeSession(roster).inside,0);
  assert.equal(summarizeSession(roster).checkedOut,1);
});

test('payment edits preserve attendance and registration; clearing payment removes its amount', () => {
  let roster=add(session(),'DEMO-001',true);
  roster=updateParticipant(roster,'DEMO-001',{attendance:'in'});
  roster=updateParticipant(roster,'DEMO-001',{paymentMethod:'cash',paidCents:1000});
  assert.equal(roster.participants[0].attendance,'in');
  assert.equal(roster.participants[0].registrationComplete,true);
  roster=updateParticipant(roster,'DEMO-001',{paymentMethod:'unpaid',paidCents:0});
  assert.equal(summarizeSession(roster).paidCents,0);
  assert.equal(summarizeSession(roster).outstandingCents,1000);
});

test('invalid updates, amounts and payment methods cannot enter sample accounting', () => {
  const roster=add(session(),'DEMO-001');
  for(const patch of [
    {paymentMethod:'unpaid',paidCents:1000},{paymentMethod:'cash',paidCents:0},
    {paymentMethod:'check',paidCents:-1},{paymentMethod:'cash',paidCents:10.5},
    {paymentMethod:'card',paidCents:1000},{paymentMethod:'cash',paidCents:100001},
    {attendance:'unknown'},{registrationComplete:'yes'},{name:'Real Person'},null,[],
  ]) assert.throws(()=>updateParticipant(roster,'DEMO-001',patch));
  assert.throws(()=>updateParticipant(roster,'DEMO-999',{attendance:'in'}),/not on/i);
});

test('cash/check totals are exact cents and overpayment never hides another participant’s outstanding balance', () => {
  let roster=add(add(add(session(),'DEMO-001',true),'DEMO-002',true),'DEMO-003');
  roster=updateParticipant(roster,'DEMO-001',{attendance:'in',paymentMethod:'cash',paidCents:500});
  roster=updateParticipant(roster,'DEMO-002',{attendance:'out',paymentMethod:'check',paidCents:1500});
  assert.deepEqual(summarizeSession(roster),{
    participants:3,registered:2,inside:1,checkedOut:1,unpaidCount:1,
    paidCents:2000,cashCents:500,checkCents:1500,expectedCents:3000,outstandingCents:1500,
  });
});

test('a valid sample session survives serialization with defensive copies', () => {
  const roster=add(session(),'DEMO-001',true);
  const restored=parseStoredSession(JSON.stringify(roster));
  assert.deepEqual(restored,roster);
  restored.participants[0].registrationComplete=false;
  assert.equal(roster.participants[0].registrationComplete,true);
});

test('malformed storage, duplicate IDs, invalid registration and personal fields cannot pollute restored sample data', () => {
  const roster=add(session(),'DEMO-001');
  for(const raw of [null,'not JSON',{}, {...roster,version:2},{...roster,id:'different'},
    {...roster,participants:[roster.participants[0],roster.participants[0]]},
    {...roster,participants:[{...roster.participants[0],attendance:'in'}]},
    {...roster,participants:[{...roster.participants[0],sampleId:'Real Person'}]},
  ]) assert.throws(()=>parseStoredSession(raw));
  const restored=parseStoredSession({...roster,secret:'unrelated',participants:[{...roster.participants[0],name:'Unexpected imported field'}]});
  assert.equal(restored.secret,undefined);
  assert.equal(restored.participants[0].name,undefined);
});

test('CSV is labeled demo-only and exports recorded amounts as decimal dollars', () => {
  let roster=add(session(),'DEMO-001',true);
  roster=updateParticipant(roster,'DEMO-001',{paymentMethod:'cash',paidCents:123});
  const csv=sessionToCsv(roster);
  assert.ok(csv.startsWith('"DEMO ONLY — NOT REAL PAYMENTS"\r\n'));
  assert.ok(csv.includes('"Sample payment USD"'));
  assert.ok(csv.includes('"DEMO-001","yes","waiting","cash","1.23","10.00"'));
  assert.ok(csv.endsWith('\r\n'));
});

test('CSV quotes commas, quotes and newlines and neutralizes spreadsheet-formula labels', () => {
  const csv=sessionToCsv(add(session({label:'Evening, "open"\npractice'}),'DEMO-001'));
  assert.ok(csv.includes('"Evening, ""open""\npractice"'));
  for(const label of ['=1+1','+SUM(1,1)','-1+1','@SUM(A1)','  =HYPERLINK("x")','\t=1+1']) {
    const exported=sessionToCsv(add(session({label}),'DEMO-001'));
    assert.ok(exported.includes(`"'${label.trim().replaceAll('"','""')}"`),`Formula prefix escaped: ${label}`);
  }
});

test('prototype explains affiliation and sample-money limits and has no submission or payment transports', () => {
  const html=readFileSync(new URL('../public/prototypes/practice-desk/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/prototypes/practice-desk/app.mjs',import.meta.url),'utf8');
  assert.match(html,/Independent, unsent concept/);
  assert.match(html,/Not affiliated with Riggs Wrestling Academy/);
  assert.match(html,/not AmericanSites revenue/);
  assert.match(html,/Need, fit and buying interest are unverified/);
  assert.doesNotMatch(app,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(html,/<form\b[^>]*\baction\s*=/i);
  assert.doesNotMatch(html,/<script\b[^>]*src=["']https?:/i);
  assert.doesNotMatch(app,/innerHTML\s*=/);
});

test('existing sample records require explicit clearing before replacement and storage failure is disclosed', () => {
  const app=readFileSync(new URL('../public/prototypes/practice-desk/app.mjs',import.meta.url),'utf8');
  assert.match(app,/if\s*\(session\?\.participants\.length\)/);
  assert.match(app,/Clear this sample session below before starting another/);
  assert.match(app,/confirm-clear/);
  assert.match(app,/keeps samples only until the page reloads/);
});
