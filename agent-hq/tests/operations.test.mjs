import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HQStore } from '../server/store.mjs';
import { createHQServer } from '../server/index.mjs';

function fixture(t, { file = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hq-ops-')), prototypeRoot = join(dir, 'prototypes'), dbPath = file ? join(dir, 'private.sqlite') : ':memory:';
  mkdirSync(join(prototypeRoot, 'practice-desk'), { recursive: true }); writeFileSync(join(prototypeRoot, 'practice-desk/index.html'), '<!doctype html><title>Local prototype</title>');
  const store = new HQStore(dbPath, { prototypeRoot }); let sequence = 0;
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  const command = input => store.command({ actor: 'bob', idempotencyKey: `ops-${++sequence}`, ...input });
  const company = (patch = {}) => ({ id:'company-fixture', name:'Example business', website:'https://example.com/', sourceUrls:['https://example.com/'], observedFact:'Official page lists a phone booking process.', opportunityHypothesis:'A request organizer might help; owner has not confirmed.', nextStep:'Review a local prototype; no outreach sent.', confidence:'verified', status:'qualified', ...patch });
  const project = (patch = {}) => ({ id:'project-fixture', companyId:null, title:'Practice desk', goal:'Organize booking requests', why:'Test a clearer workflow', brief:'Local prototype using demonstration data', phase:'building', nextStep:'Run usability and safety tests', ...patch });
  const entry = (patch = {}) => ({ kind:'income', amountCents:2000, currency:'USD', date:'2026-11-09', reference:`fixture-reference-${sequence+1}`, source:'Test provider', ...patch });
  const add = data => command({ action:'operations.accounting.add', actor:'accountant', entry:data }).entry;
  return { dir, prototypeRoot, dbPath, store, command, company, project, entry, add };
}

test('empty accounting is unknown imported activity, not fabricated zero sales', t => {
  const f = fixture(t), state = f.store.state();
  assert.equal(state.workers.length, 7);
  assert.ok(state.workers.some(worker => worker.id === 'scout'));
  assert.ok(state.workers.some(worker => worker.id === 'accountant'));
  assert.equal(state.operations.accounting.overview.status, 'no_entries_imported');
  assert.equal(state.operations.accounting.overview.label, 'No entries imported');
  assert.deepEqual(state.operations.accounting.overview.currencies, []);
  assert.equal(state.operations.accounting.entries.length, 0);
});

test('invoices are not income; linked receipts reduce outstanding and refunds reduce collected', t => {
  const f = fixture(t);
  const invoice = f.add(f.entry({ kind:'receivable', amountCents:10000, reference:'invoice-1' }));
  let total = f.store.operations.state().accounting.overview.currencies[0];
  assert.equal(total.incomeCents, 0); assert.equal(total.outstandingReceivablesCents, 10000);
  const payment = f.add(f.entry({ amountCents:6000, reference:'payment-1', settlesReceivableId:invoice.id }));
  f.add(f.entry({ kind:'refund', amountCents:1000, reference:'refund-1', refundOfIncomeId:payment.id }));
  f.add(f.entry({ kind:'expense', amountCents:1200, reference:'expense-1' }));
  f.add(f.entry({ kind:'commission', amountCents:500, reference:'commission-1' }));
  total = f.store.operations.state().accounting.overview.currencies[0];
  assert.deepEqual(total, { currency:'USD', incomeCents:6000, refundsCents:1000, collectedCents:5000, expensesCents:1200, netBeforeTaxCents:3800, outstandingReceivablesCents:4000, commissionsCents:500 });
  assert.equal(f.store.operations.state().accounting.overview.feesStatus, 'unknown_unless_recorded_as_expenses');
});

test('rejects negative/fractional/unsafe cents, invalid dates and non-cent currencies', t => {
  const f = fixture(t);
  for (const amountCents of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2000', NaN]) assert.throws(() => f.add(f.entry({ amountCents })), { code:'invalid_input' });
  for (const date of ['2026-02-30', '2026-13-09', 'Nov 9']) assert.throws(() => f.add(f.entry({ date })), { code:'invalid_input' });
  assert.throws(() => f.add(f.entry({ currency:'JPY' })), { code:'invalid_input' });
  assert.equal(f.store.operations.state().accounting.entries.length, 0);
});

test('safe individual amounts cannot overflow aggregate totals', t => {
  const f = fixture(t);
  f.add(f.entry({ amountCents:Number.MAX_SAFE_INTEGER, reference:'large-1' }));
  assert.throws(() => f.add(f.entry({ amountCents:1, reference:'large-2' })), { code:'amount_overflow' });
  assert.equal(f.store.operations.state().accounting.entries.length, 1);
});

test('currencies remain separate and duplicate receipts are scoped to provider/account', t => {
  const f = fixture(t);
  f.add(f.entry({ amountCents:1000, reference:'shared-reference' }));
  assert.throws(() => f.add(f.entry({ amountCents:1000, reference:'shared-reference' })), { code:'duplicate_record' });
  assert.throws(() => f.add(f.entry({ amountCents:1000, reference:' shared-reference ', source:' Test provider ', account:' default ' })), { code:'duplicate_record' });
  assert.throws(() => f.add(f.entry({ amountCents:2000, reference:'shared-reference', currency:'EUR' })), { code:'duplicate_record' });
  f.add(f.entry({ amountCents:2000, reference:'distinct-eur-reference', currency:'EUR' }));
  f.add(f.entry({ amountCents:3000, reference:'shared-reference', account:'other-account' }));
  const totals = f.store.operations.state().accounting.overview.currencies;
  assert.deepEqual(totals.map(item => [item.currency, item.incomeCents]), [['EUR',2000], ['USD',4000]]);
});

test('refund and invoice links cannot exceed recorded amounts or cross currencies/accounts', t => {
  const f = fixture(t), invoice = f.add(f.entry({ kind:'receivable', amountCents:1000, reference:'invoice' }));
  assert.throws(() => f.add(f.entry({ reference:'bad-payment', amountCents:1200, settlesReceivableId:invoice.id })), { code:'overpayment' });
  assert.throws(() => f.add(f.entry({ reference:'bad-currency', amountCents:100, currency:'EUR', settlesReceivableId:invoice.id })), { code:'invalid_input' });
  const income = f.add(f.entry({ reference:'payment', amountCents:1000, settlesReceivableId:invoice.id }));
  assert.throws(() => f.add(f.entry({ kind:'refund', amountCents:100, reference:'missing-link' })), { code:'evidence_required' });
  f.add(f.entry({ kind:'refund', amountCents:600, reference:'refund-a', refundOfIncomeId:income.id }));
  assert.throws(() => f.add(f.entry({ kind:'refund', amountCents:500, reference:'refund-b', refundOfIncomeId:income.id })), { code:'excess_refund' });
  assert.throws(() => f.add(f.entry({ kind:'refund', amountCents:100, reference:'refund-c', account:'other', refundOfIncomeId:income.id })), { code:'invalid_input' });
});

test('accounting commands are idempotent and cannot edit or delete posted receipts', t => {
  const f = fixture(t), input = { action:'operations.accounting.add', actor:'accountant', entry:f.entry({ reference:'stable' }), idempotencyKey:'stable-payment' };
  const first = f.command(input); assert.deepEqual(f.command(input), first);
  assert.equal(f.store.operations.state().accounting.entries.length, 1);
  assert.throws(() => f.command({ ...input, entry:{ ...input.entry, amountCents:3000 } }), { code:'idempotency_conflict' });
  assert.throws(() => f.command({ action:'operations.accounting.delete', entryId:first.entry.id }), { code:'action_disabled' });
  const serializedEvents = JSON.stringify(f.store.state().events);
  assert.ok(!serializedEvents.includes('stable') && !serializedEvents.includes('amountCents') && !serializedEvents.includes('Test provider'));
});

test('sanitized snapshot import retains only explicit fields and never creates revenue from leads', t => {
  const f = fixture(t), snapshot = { source:'Connected operations test fixture', companies:[f.company({ email:'private@example.com', phone:'555-0000' })], projects:[f.project({ companyId:'company-fixture' })], accounting:[], accessToken:'fake-secret-do-not-copy', rawAccount:{ password:'fake-secret-do-not-copy' } };
  const input = { action:'operations.import', actor:'bob', snapshot, idempotencyKey:'import-snapshot' };
  const result = f.command(input); assert.equal(result.import.companiesAdded, 1); assert.equal(result.import.projectsAdded, 1);
  assert.deepEqual(f.command(input), result);
  const state = f.store.operations.state();
  assert.equal(state.companies[0].confidence, 'verified');
  assert.equal(state.accounting.entries.length, 0);
  const dbPayloads = ['ops_companies','ops_projects','ops_imports','commands'].flatMap(table => f.store.db.prepare(`SELECT * FROM ${table}`).all());
  const serialized = JSON.stringify(dbPayloads);
  assert.ok(!serialized.includes('fake-secret-do-not-copy') && !serialized.includes('private@example.com') && !serialized.includes('555-0000'));
});

test('invalid snapshot atomically rolls back and conflicting immutable transactions fail clearly', t => {
  const f = fixture(t);
  assert.throws(() => f.command({ action:'operations.import', snapshot:{ source:'Test', companies:[f.company()], accounting:[f.entry({ amountCents:-3 })] } }), { code:'invalid_input' });
  assert.equal(f.store.operations.state().companies.length, 0);
  const entry = f.entry({ id:'import-receipt', reference:'same-receipt' });
  f.command({ action:'operations.import', snapshot:{ source:'Test', accounting:[entry] } });
  const duplicate = f.command({ action:'operations.import', snapshot:{ source:'Test', accounting:[entry] } });
  assert.equal(duplicate.import.skipped, 1);
  assert.throws(() => f.command({ action:'operations.import', snapshot:{ source:'Test', accounting:[{ ...entry, amountCents:entry.amountCents+1 }] } }), { code:'duplicate_conflict' });
  const changedCurrency = { ...entry, currency:'EUR' }; delete changedCurrency.id;
  assert.throws(() => f.command({ action:'operations.import', snapshot:{ source:'Test', accounting:[changedCurrency] } }), { code:'duplicate_conflict' });
});

test('company updates enforce roles/revisions and retain imported opt-outs', t => {
  const f = fixture(t), company = f.command({ action:'operations.company.add', actor:'scout', company:f.company({ status:'do_not_contact' }) }).company;
  assert.throws(() => f.command({ action:'operations.company.update', actor:'scout', companyId:company.id, revision:company.revision, patch:{ status:'qualified' } }), { code:'opt_out_locked' });
  assert.throws(() => f.command({ action:'operations.company.update', actor:'accountant', companyId:company.id, revision:company.revision, patch:{ nextStep:'Review records' } }), { code:'forbidden' });
  assert.throws(() => f.command({ action:'operations.company.update', actor:'scout', companyId:company.id, revision:0, patch:{ nextStep:'Review records' } }), { code:'revision_conflict' });
});

test('later imported opt-outs upgrade existing companies and cannot be cleared by reimport', t => {
  const f = fixture(t);
  f.command({ action:'operations.import', snapshot:{ source:'Connected ops', companies:[f.company()] } });
  const receipt = f.command({ action:'operations.import', snapshot:{ source:'Connected ops', companies:[f.company({ status:'do_not_contact', nextStep:'Honor the recorded opt-out.' })] } });
  assert.equal(receipt.import.optOutsUpdated,1);
  assert.equal(f.store.operations.state().companies[0].status,'do_not_contact');
  f.command({ action:'operations.import', snapshot:{ source:'Older snapshot', companies:[f.company({ status:'qualified' })] } });
  assert.equal(f.store.operations.state().companies[0].status,'do_not_contact');
});

test('project previews require an existing allowlisted local HTML file and evidence for completion', t => {
  const f = fixture(t), project = f.command({ action:'operations.project.add', project:f.project({ phase:'preview_ready', previewPath:'/prototypes/practice-desk/index.html' }) }).project;
  assert.equal(project.previewPath, '/prototypes/practice-desk/index.html');
  for (const previewPath of ['https://example.com/', '/prototypes/../../secret.html', '/prototypes/%2e%2e/secret.html', '/prototypes/missing.html']) assert.throws(() => f.command({ action:'operations.project.update', projectId:project.id, revision:project.revision, patch:{ previewPath } }), { code:'invalid_preview_path' });
  const outside = join(f.dir,'outside.html'); writeFileSync(outside,'private'); symlinkSync(outside, join(f.prototypeRoot,'symlink.html'));
  assert.throws(() => f.command({ action:'operations.project.update', projectId:project.id, revision:project.revision, patch:{ previewPath:'/prototypes/symlink.html' } }), { code:'invalid_preview_path' });
  assert.throws(() => f.command({ action:'operations.project.update', projectId:project.id, revision:project.revision, patch:{ phase:'complete' } }), { code:'evidence_required' });
});

test('plain-language progress records intent without advancing state or inventing activity', t => {
  const f = fixture(t), task = f.command({ action:'create', title:'Research a workflow', brief:'Read official sources' }).task;
  let result = f.command({ action:'assign', taskId:task.id, revision:task.revision, assignedTo:'scout' });
  const beforeStatus = result.task.status;
  result = f.command({ action:'progress', actor:'scout', taskId:task.id, revision:result.task.revision, stage:'Reviewing official service page', why:'Identify an observed workflow', nextStep:'Record source and hypothesis separately' });
  assert.equal(result.task.status, beforeStatus);
  assert.equal(result.task.leaseExpiresAt, null);
  assert.equal(result.event.type,'task.progress');
  const worker = f.store.state().workers.find(item => item.id === 'scout');
  assert.equal(worker.stage, result.task.stage); assert.equal(worker.isWorking, false);
});

test('operations and bookkeeping persist across process-store restarts in the private SQLite file', t => {
  const f = fixture(t, { file:true });
  f.command({ action:'operations.company.add', actor:'scout', company:f.company() });
  f.add(f.entry({ reference:'durable-private-receipt' }));
  const reopened = new HQStore(f.dbPath, { prototypeRoot:f.prototypeRoot });
  try { assert.equal(reopened.operations.state().companies.length,1); assert.equal(reopened.operations.state().accounting.entries[0].reference,'durable-private-receipt'); } finally { reopened.close(); }
});

test('read-only SSE sends real operations revisions and does not accept mutation', async t => {
  const f = fixture(t), server = createHQServer(f.store);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/operations`)).status,200);
  assert.equal((await fetch(`${base}/api/operations`,{ method:'POST' })).status,403);
  const controller = new AbortController();
  const response = await fetch(`${base}/api/stream`,{ signal:controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let stream = decoder.decode((await reader.read()).value);
  assert.match(stream,/event: state/);
  const revision = f.store.state().revision;
  f.command({ action:'operations.company.add', actor:'scout', company:f.company() });
  while (!stream.includes('Company research recorded')) stream += decoder.decode((await reader.read()).value);
  assert.ok(f.store.state().revision > revision);
  assert.match(stream,/company-fixture/);
  controller.abort(); await reader.cancel().catch(() => {});
});
