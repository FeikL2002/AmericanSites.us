import {createSession, parseStoredSession, nextSampleId, addParticipant, updateParticipant, summarizeSession, sessionToCsv} from './domain.mjs';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'americansites-practice-desk-demo-v1';
let session = null;
let storageAvailable = true;
let filter = 'all';
let query = '';
const currency = cents => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
const date = new Date();
$('session-date').value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

function announce(message, error = false) {
  $('status').className = error ? 'status error' : 'status';
  $('status').textContent = message;
}
function storageNotice() {
  $('storage-status').textContent = storageAvailable
    ? 'Fictional sample records stay on this device only. No money is collected.'
    : 'This embedded preview keeps samples only until the page reloads. No money is collected.';
}
function save() {
  if (storageAvailable) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); }
    catch { storageAvailable = false; storageNotice(); }
  }
  $('saved-status').textContent = storageAvailable ? 'Sample saved on this device' : 'Sample held in this page only';
}
function apply(change, message) {
  try { session = change(session); save(); render(); announce(message); }
  catch (error) { announce(error.message, true); }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label, className, action) {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function participantCard(participant) {
  const p = participant;
  const card = el('article', 'participant-card');
  card.setAttribute('aria-label', `Sample participant ${p.sampleId}`);
  const identity = el('div');
  const heading = el('div', 'participant-heading');
  heading.append(el('span', 'participant-avatar', p.sampleId.slice(-2)));
  const title = el('div'); title.append(el('strong', '', p.sampleId), el('small', '', 'Anonymous fictional sample'));
  heading.append(title); identity.append(heading);
  const registration = button('', `registration-toggle ${p.registrationComplete ? 'checked' : ''}`, () => apply(current => updateParticipant(current, p.id, {registrationComplete: !p.registrationComplete}), `${p.sampleId}: sample registration updated.`));
  registration.setAttribute('aria-pressed', String(p.registrationComplete));
  registration.setAttribute('aria-label', `${p.sampleId} sample registration form reviewed`);
  registration.append(el('span', '', p.registrationComplete ? '✓' : ''), document.createTextNode(p.registrationComplete ? 'Registration checked' : 'Registration not checked'));
  if (p.attendance === 'in') { registration.disabled = true; registration.title = 'Check out before clearing registration.'; }
  identity.append(registration);
  const attendance = el('div', 'attendance-column');
  const labels = {waiting:'Not checked in',in:'On the mat',out:'Checked out'};
  attendance.append(el('div', `attendance-tag ${p.attendance}`, labels[p.attendance]));
  const actions = el('div', 'attendance-actions');
  const checkin = button(p.attendance === 'out' ? 'Check back in' : 'Check in', 'button light small', () => apply(current => updateParticipant(current, p.id, {attendance:'in'}), `${p.sampleId} checked into this sample session.`));
  checkin.disabled = !p.registrationComplete || p.attendance === 'in';
  checkin.setAttribute('aria-label', `Check in ${p.sampleId}`);
  if (!p.registrationComplete) checkin.title = 'Review the sample registration form first.';
  const checkout = button('Check out', 'button light small', () => apply(current => updateParticipant(current, p.id, {attendance:'out'}), `${p.sampleId} checked out of this sample session.`));
  checkout.disabled = p.attendance !== 'in'; checkout.setAttribute('aria-label', `Check out ${p.sampleId}`);
  actions.append(checkin, checkout); attendance.append(actions);
  const payment = el('div', 'payment-column');
  const form = el('form', 'payment-editor');
  const label = el('label', '', 'Sample payment method');
  const select = el('select'); select.setAttribute('aria-label', `${p.sampleId} sample payment method`);
  for (const [value, text] of [['unpaid','Unpaid'],['cash','Cash sample'],['check','Check example']]) {const option=el('option','',text); option.value=value; select.append(option);}
  select.value=p.paymentMethod; label.append(select);
  if (session.dropInCents === 0) { select.options[0].textContent='No payment due ($0 example)'; select.disabled=true; }
  const record=el('button','button light small','Record');record.type='submit';record.setAttribute('aria-label',`Record sample payment for ${p.sampleId}`);
  record.disabled=session.dropInCents===0;
  form.append(label,record);
  form.addEventListener('submit',event=>{event.preventDefault();const method=select.value;apply(current=>updateParticipant(current,p.id,{paymentMethod:method,paidCents:method==='unpaid'?0:current.dropInCents}),`${p.sampleId}: ${method==='unpaid'?'marked unpaid':currency(session.dropInCents)+' '+method+' sample recorded'}. No payment was processed.`);});
  payment.append(form,el('div',`payment-status ${p.paymentMethod!=='unpaid'?'recorded':''}`,p.paymentMethod==='unpaid'?(session.dropInCents===0?'No sample payment due':'Unpaid sample'):`${currency(p.paidCents)} · ${p.paymentMethod}`));
  card.append(identity,attendance,payment);
  return card;
}
function renderRoster() {
  const list=$('roster-list'); list.replaceChildren();
  const rows=session.participants.filter(p=>(filter==='all'||(filter==='in'&&p.attendance==='in')||(filter==='unpaid'&&p.paymentMethod==='unpaid'))&&p.sampleId.toLowerCase().includes(query.toLowerCase()));
  if(!session.participants.length){const empty=el('div','empty-roster');empty.append(el('strong','','Your sample roster is empty.'),el('p','','Add an anonymous participant above, review the form, then try check-in.'));list.append(empty);}
  else if(!rows.length)list.append(el('p','no-match','No sample participants match this view.'));
  else rows.forEach(p=>list.append(participantCard(p)));
}
function render() {
  $('workspace').hidden=!session;
  if(!session){$('session-state').textContent='No session yet';return;}
  const summary=summarizeSession(session);
  $('session-state').textContent=`${session.label} · ${session.date}`;
  $('session-date').value=session.date;
  $('session-label').value=session.label;
  $('session-fee').value=(session.dropInCents/100).toFixed(2);
  $('session-form').querySelector('button').textContent='Start a new sample session →';
  $('count-roster').textContent=summary.participants;
  $('count-inside').textContent=summary.inside;
  $('total-paid').textContent=currency(summary.paidCents);
  $('total-unpaid').textContent=currency(summary.outstandingCents);
  $('roster-count').textContent=`${summary.participants} sample participant${summary.participants===1?'':'s'}`;
  $('next-id').textContent=nextSampleId(session);
  $('participant-form').querySelector('button').disabled=summary.participants>=100;
  $('registration-summary').textContent=`${summary.registered} of ${summary.participants} sample forms checked · ${summary.checkedOut} checked out`;
  $('summary-cash').textContent=currency(summary.cashCents);
  $('summary-check').textContent=currency(summary.checkCents);
  $('summary-total').textContent=currency(summary.paidCents);
  $('export-csv').disabled=!summary.participants;
  renderRoster();
}
$('session-form').addEventListener('submit',event=>{
  event.preventDefault();
  if(session?.participants.length){announce('Clear this sample session below before starting another one. Export first if you want to keep its demo entries.',true);$('clear-confirm').hidden=false;return;}
  try{
    const raw=$('session-fee').value;
    if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error('Enter the example fee with no more than two decimal places.');
    session=createSession({date:$('session-date').value,label:$('session-label').value,dropInCents:Math.round(Number(raw)*100)});
    save();render();announce('Sample session started. Add an anonymous participant to try the workflow.');
  }catch(error){announce(error.message,true);}
});
$('participant-form').addEventListener('submit',event=>{event.preventDefault();if(!session)return;const id=nextSampleId(session);apply(current=>addParticipant(current,{sampleId:id,registrationComplete:$('registration-checked').checked}),`${id} added as a fictional sample. No personal information was collected.`);$('registration-checked').checked=false;});
$('roster-search').addEventListener('input',event=>{query=event.target.value;renderRoster();});
document.querySelectorAll('[data-filter]').forEach(node=>node.addEventListener('click',()=>{filter=node.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('selected',n===node));renderRoster();}));
$('export-csv').addEventListener('click',()=>{if(!session)return;try{const url=URL.createObjectURL(new Blob([sessionToCsv(session)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`practice-desk-DEMO-${session.date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Sample CSV prepared. If this embedded preview blocks downloads, open the concept directly to export.');}catch(error){announce('This embedded view cannot export. Open the concept directly and try again.',true);}});
$('clear-session').addEventListener('click',()=>{$('clear-confirm').hidden=false;$('confirm-clear').focus();});
$('cancel-clear').addEventListener('click',()=>{$('clear-confirm').hidden=true;$('clear-session').focus();});
$('confirm-clear').addEventListener('click',()=>{try{if(storageAvailable)localStorage.removeItem(STORAGE_KEY);}catch{storageAvailable=false;}session=null;query='';filter='all';$('roster-search').value='';document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('selected',n.dataset.filter==='all'));$('clear-confirm').hidden=true;render();storageNotice();announce('Fictional sample session cleared. No real records or payments were changed.');$('session-date').focus();});
try {const saved=localStorage.getItem(STORAGE_KEY);if(saved){session=parseStoredSession(saved);$('saved-status').textContent='Loaded sample from this device';}}catch(error){if(error?.name==='SecurityError'){storageAvailable=false;}else{announce('Stored sample data could not be loaded. Start a new sample session to continue.',true);}}
storageNotice();render();
