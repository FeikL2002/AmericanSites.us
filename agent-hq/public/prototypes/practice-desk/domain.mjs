/** Pure sample-workflow rules. These records never represent actual charges. */
const fail = message => { throw new Error(message); };
const money = (value, field = 'Amount') => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) fail(`${field} must be whole cents between $0 and $1,000.`);
  return value;
};
const validDate = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
const validLabel = label => {
  if (typeof label !== 'string' || !label.trim() || label.length > 60) fail('Give the session a name of 1–60 characters.');
  return label.trim();
};
const validateParticipant = participant => {
  if (!participant || typeof participant !== 'object' || !/^DEMO-\d{3}$/.test(participant.sampleId || '') || participant.sampleId === 'DEMO-000') fail('Use an anonymous sample ID such as DEMO-001. Do not enter a name.');
  if (participant.id !== participant.sampleId) fail('Participant ID must match the anonymous sample ID.');
  if (typeof participant.registrationComplete !== 'boolean') fail('Registration status must be true or false.');
  if (!['waiting', 'in', 'out'].includes(participant.attendance)) fail('Choose a valid attendance status.');
  if (!['unpaid', 'cash', 'check'].includes(participant.paymentMethod)) fail('Choose unpaid, cash, or check for this sample.');
  money(participant.paidCents, 'Sample payment');
  if (participant.paymentMethod === 'unpaid' && participant.paidCents !== 0) fail('An unpaid sample cannot contain a payment amount.');
  if (participant.paymentMethod !== 'unpaid' && participant.paidCents <= 0) fail('A recorded cash/check sample needs a positive amount.');
  if (participant.attendance === 'in' && !participant.registrationComplete) fail('Review the sample registration form before check-in.');
  return {id: participant.sampleId, sampleId: participant.sampleId, registrationComplete: participant.registrationComplete, attendance: participant.attendance, paymentMethod: participant.paymentMethod, paidCents: participant.paidCents};
};
export function createSession({date, label, dropInCents = 1000}) {
  if (!validDate(date)) fail('Choose a valid practice date.');
  return {version: 1, id: `practice-${date}`, date, label: validLabel(label), dropInCents: money(dropInCents, 'Example fee'), participants: []};
}
export function parseStoredSession(value) {
  let raw = value;
  if (typeof value === 'string') { try { raw = JSON.parse(value); } catch { fail('The stored sample session is not readable.'); } }
  if (!raw || typeof raw !== 'object' || raw.version !== 1 || !Array.isArray(raw.participants) || raw.participants.length > 100) fail('The stored sample session has an unsupported format.');
  const session = createSession(raw);
  if (raw.id !== session.id) fail('Stored session ID does not match the practice date.');
  session.participants = raw.participants.map(validateParticipant);
  if (new Set(session.participants.map(p => p.id)).size !== session.participants.length) fail('The sample session contains duplicate participant IDs.');
  return session;
}
export function nextSampleId(session) {
  const current = parseStoredSession(session);
  const used = new Set(current.participants.map(p => p.sampleId));
  for (let i = 1; i <= 999; i++) { const id = `DEMO-${String(i).padStart(3, '0')}`; if (!used.has(id)) return id; }
  fail('No more sample IDs are available.');
}
export function addParticipant(session, {sampleId, registrationComplete = false}) {
  const next = parseStoredSession(session);
  if (next.participants.length >= 100) fail('This concept is limited to 100 anonymous sample participants.');
  if (next.participants.some(p => p.id === sampleId)) fail('That sample ID is already on the roster.');
  next.participants.push(validateParticipant({id: sampleId, sampleId, registrationComplete, attendance: 'waiting', paymentMethod: 'unpaid', paidCents: 0}));
  return next;
}
export function updateParticipant(session, id, patch) {
  const next = parseStoredSession(session);
  const index = next.participants.findIndex(p => p.id === id);
  if (index === -1) fail('That anonymous participant is not on this session’s roster.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('Provide a sample participant update.');
  const allowed = ['registrationComplete', 'attendance', 'paymentMethod', 'paidCents'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) fail('Only registration, attendance, and sample payment fields can be updated.');
  next.participants[index] = validateParticipant({...next.participants[index], ...patch});
  return next;
}
export function summarizeSession(session) {
  const current = parseStoredSession(session);
  const result = {participants: current.participants.length, registered: 0, inside: 0, checkedOut: 0, unpaidCount: 0, paidCents: 0, cashCents: 0, checkCents: 0, expectedCents: current.participants.length * current.dropInCents, outstandingCents: 0};
  for (const p of current.participants) {
    result.registered += Number(p.registrationComplete);
    result.inside += Number(p.attendance === 'in');
    result.checkedOut += Number(p.attendance === 'out');
    result.unpaidCount += Number(p.paymentMethod === 'unpaid');
    result.paidCents += p.paidCents;
    if (p.paymentMethod === 'cash') result.cashCents += p.paidCents;
    if (p.paymentMethod === 'check') result.checkCents += p.paidCents;
    result.outstandingCents += Math.max(0, current.dropInCents - p.paidCents);
  }
  return result;
}
function csvCell(value) {
  let text = String(value ?? '');
  // Neutralize spreadsheet formulas, including whitespace/control-prefixed input.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function sessionToCsv(session) {
  const current = parseStoredSession(session);
  const rows = [['DEMO ONLY — NOT REAL PAYMENTS'], ['Session date', 'Session name', 'Sample ID', 'Registration checked', 'Attendance', 'Sample payment method', 'Sample payment USD', 'Example fee USD']];
  for (const p of current.participants) rows.push([current.date, current.label, p.sampleId, p.registrationComplete ? 'yes' : 'no', p.attendance, p.paymentMethod, (p.paidCents / 100).toFixed(2), (current.dropInCents / 100).toFixed(2)]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
