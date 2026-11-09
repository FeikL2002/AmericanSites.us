import { randomUUID, createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
const check = (ok, code, message) => { if (!ok) fail(code, message); };
const str = (value, max, name, optional = false) => { if (optional && (value === undefined || value === null || value === '')) return null; check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'invalid_input', `Invalid ${name}`); return value.trim(); };
const identifier = value => { check(typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value), 'invalid_input', 'Invalid record id'); return value; };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const COMPANY_STATUSES = new Set(['new', 'verified', 'qualified', 'scoping', 'building', 'review', 'blocked', 'do_not_contact', 'contacted', 'conversation', 'proposal', 'won', 'lost']);
const PHASES = new Set(['idea', 'queued', 'scoping', 'building', 'review', 'testing', 'preview_ready', 'awaiting_approval', 'complete', 'blocked']);
const CONFIDENCES = new Set(['user_observed', 'verified', 'likely', 'needs_verification']);
const KINDS = new Set(['income', 'expense', 'refund', 'receivable', 'commission']);
const CENT_CURRENCIES = new Set(['USD', 'CAD', 'AUD', 'EUR', 'GBP']);

function url(value, optional = false) {
  if (optional && !value) return null;
  const input = str(value, 2048, 'source URL');
  let parsed; try { parsed = new URL(input); } catch { fail('invalid_input', 'Invalid source URL'); }
  check(['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password, 'invalid_input', 'Only ordinary HTTP(S) source URLs are accepted');
  parsed.hash = '';
  return parsed.toString();
}
function sourceList(value) {
  check(Array.isArray(value) && value.length <= 20, 'invalid_input', 'sourceUrls must contain at most 20 URLs');
  return [...new Set(value.map(item => url(item)))];
}
const safeAdd = (a,b) => { const result = a+b; check(Number.isSafeInteger(result), 'amount_overflow', 'Accounting total exceeds safe integer range'); return result; };

export function accountingOverview(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const totals = grouped.get(entry.currency) || { currency: entry.currency, incomeCents: 0, refundsCents: 0, collectedCents: 0, expensesCents: 0, netBeforeTaxCents: 0, outstandingReceivablesCents: 0, commissionsCents: 0 };
    const field = { income:'incomeCents', refund:'refundsCents', expense:'expensesCents', receivable:'outstandingReceivablesCents', commission:'commissionsCents' }[entry.kind];
    totals[field] = safeAdd(totals[field], entry.amountCents);
    if (entry.kind === 'income' && entry.settlesReceivableId) totals.outstandingReceivablesCents = safeAdd(totals.outstandingReceivablesCents, -entry.amountCents);
    grouped.set(entry.currency, totals);
  }
  for (const totals of grouped.values()) {
    totals.collectedCents = safeAdd(totals.incomeCents, -totals.refundsCents);
    totals.netBeforeTaxCents = safeAdd(totals.collectedCents, -totals.expensesCents);
  }
  return { status: entries.length ? 'recorded_entries_only' : 'no_entries_imported', label: entries.length ? 'Recorded entries only; not a reconciled bank balance' : 'No entries imported', entryCount: entries.length, currencies: [...grouped.values()].sort((a,b) => a.currency.localeCompare(b.currency)), feesStatus: 'unknown_unless_recorded_as_expenses', netBeforeTaxBasis: 'Recorded income minus recorded refunds and expenses; unrecorded fees and taxes are excluded', commissionsTreatment: 'Tracked obligations; deducted only when an actual expense is recorded', receivablesTreatment: 'Reduced only by explicitly linked income; refunds do not automatically reopen invoices' };
}

/** Private bookkeeping and opportunity records. Never exports a raw connector snapshot. */
export class OperationsLedger {
  constructor(store, { prototypeRoot = fileURLToPath(new URL('../public/prototypes/', import.meta.url)) } = {}) {
    this.store = store; this.db = store.db; this.prototypeRoot = resolve(prototypeRoot);
    this.db.exec(`CREATE TABLE IF NOT EXISTS ops_companies (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ops_projects (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ops_accounting (id TEXT PRIMARY KEY, reference_key TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ops_imports (id TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
  }
  now() { return new Date(this.store.now()).toISOString(); }
  rows(table) { check(['ops_companies','ops_projects','ops_accounting','ops_imports'].includes(table), 'invalid_input', 'Unknown operations table'); return this.db.prepare(`SELECT payload FROM ${table} ORDER BY rowid ASC`).all().map(row => JSON.parse(row.payload)); }
  get(table, id) { check(['ops_companies','ops_projects'].includes(table), 'invalid_input', 'Unknown operations table'); const row = this.db.prepare(`SELECT payload FROM ${table} WHERE id=?`).get(identifier(id)); check(row, 'not_found', 'Operations record not found'); return JSON.parse(row.payload); }
  previewPath(input) {
    if (input === undefined || input === null || input === '') return null;
    check(typeof input === 'string' && /^\/prototypes\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(input), 'invalid_preview_path', 'Preview must be an approved local HTML file under /prototypes/');
    const parts = input.slice('/prototypes/'.length).split('/');
    try {
      const root = realpathSync(this.prototypeRoot);
      let candidate = this.prototypeRoot;
      check(!lstatSync(candidate).isSymbolicLink(), 'invalid_preview_path', 'Prototype root cannot be a symlink');
      for (const part of parts) { candidate = resolve(candidate, part); check(!lstatSync(candidate).isSymbolicLink(), 'invalid_preview_path', 'Prototype paths cannot contain symlinks'); }
      const actual = realpathSync(candidate);
      check(actual.startsWith(root + sep) && lstatSync(actual).isFile(), 'invalid_preview_path', 'Preview must be a local HTML file inside the prototype directory');
    } catch (error) { if (error.code === 'invalid_preview_path') throw error; fail('invalid_preview_path', 'Preview file does not exist in the prototype directory'); }
    return input;
  }
  company(data, source, prior = null) {
    check(data && typeof data === 'object' && !Array.isArray(data), 'invalid_input', 'Company object required');
    const confidence = data.confidence ?? prior?.confidence ?? 'needs_verification';
    const status = data.status ?? prior?.status ?? 'new';
    check(CONFIDENCES.has(confidence) && COMPANY_STATUSES.has(status), 'invalid_input', 'Invalid company confidence or status');
    const sources = sourceList(data.sourceUrls ?? prior?.sourceUrls ?? []);
    check(confidence !== 'verified' || sources.length > 0, 'evidence_required', 'Verified companies need a source URL');
    check(prior?.status !== 'do_not_contact' || status === 'do_not_contact', 'opt_out_locked', 'An imported do-not-contact status cannot be cleared');
    const at = this.now();
    return { id: prior?.id || (data.id ? identifier(data.id) : randomUUID()), name: str(data.name ?? prior?.name, 240, 'company name'), website: url(data.website === undefined ? prior?.website : data.website, true), location: str(data.location ?? prior?.location, 240, 'location', true), sourceUrls: sources, observedFact: str(data.observedFact ?? prior?.observedFact, 4000, 'observedFact'), opportunityHypothesis: str(data.opportunityHypothesis ?? prior?.opportunityHypothesis, 4000, 'opportunityHypothesis'), nextStep: str(data.nextStep ?? prior?.nextStep, 2000, 'nextStep'), confidence, status, source: str(source || prior?.source || 'Trusted local operator', 240, 'source'), createdAt: prior?.createdAt || at, updatedAt: at, revision: (prior?.revision || 0) + 1 };
  }
  project(data, source, prior = null) {
    check(data && typeof data === 'object' && !Array.isArray(data), 'invalid_input', 'Project object required');
    const phase = data.phase ?? prior?.phase ?? 'idea';
    check(PHASES.has(phase), 'invalid_input', 'Invalid project phase');
    const companyId = data.companyId === undefined ? prior?.companyId ?? null : data.companyId;
    if (companyId) this.get('ops_companies', companyId);
    const previewPath = this.previewPath(data.previewPath === undefined ? prior?.previewPath : data.previewPath);
    check(phase !== 'preview_ready' || previewPath, 'evidence_required', 'A preview-ready project needs an existing local preview');
    const evidenceRefs = data.evidenceRefs ?? prior?.evidenceRefs ?? [];
    check(Array.isArray(evidenceRefs) && evidenceRefs.length <= 20, 'invalid_input', 'At most 20 evidence references allowed');
    const refs = evidenceRefs.map(ref => str(ref, 500, 'evidence reference'));
    const completionVerified = data.completionVerified ?? prior?.completionVerified ?? false;
    check(typeof completionVerified === 'boolean', 'invalid_input', 'completionVerified must be boolean');
    check(phase !== 'complete' || (completionVerified && refs.length > 0), 'evidence_required', 'Completed projects need explicit verification and evidence references');
    const at = this.now();
    return { id: prior?.id || (data.id ? identifier(data.id) : randomUUID()), companyId, title: str(data.title ?? prior?.title, 240, 'project title'), goal: str(data.goal ?? prior?.goal, 3000, 'project goal'), why: str(data.why ?? prior?.why, 3000, 'project why'), brief: str(data.brief ?? prior?.brief, 6000, 'project brief'), phase, nextStep: str(data.nextStep ?? prior?.nextStep, 2000, 'nextStep'), previewPath, evidenceRefs: refs, completionVerified, source: str(source || prior?.source || 'Trusted local operator', 240, 'source'), createdAt: prior?.createdAt || at, updatedAt: at, revision: (prior?.revision || 0) + 1 };
  }
  entry(data, source) {
    check(data && typeof data === 'object' && !Array.isArray(data), 'invalid_input', 'Accounting entry required');
    check(KINDS.has(data.kind), 'invalid_input', 'Invalid accounting kind');
    check(Number.isSafeInteger(data.amountCents) && data.amountCents >= 0, 'invalid_input', 'amountCents must be a nonnegative safe integer');
    const currency = data.currency ?? 'USD';
    check(CENT_CURRENCIES.has(currency), 'invalid_input', 'Supported cent currencies: USD, CAD, AUD, EUR, GBP; currencies are never converted or combined');
    const date = str(data.date, 10, 'accounting date');
    const parsedDate = new Date(`${date}T00:00:00Z`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0,10) === date, 'invalid_input', 'Accounting date must be a real YYYY-MM-DD date');
    const record = { id: data.id ? identifier(data.id) : randomUUID(), kind: data.kind, amountCents: data.amountCents, currency, date, reference: str(data.reference, 300, 'transaction reference'), source: str(data.source || source, 240, 'accounting source'), account: str(data.account ?? 'default', 160, 'account scope'), title: str(data.title, 240, 'accounting title', true), settlesReceivableId: data.settlesReceivableId ? identifier(data.settlesReceivableId) : null, refundOfIncomeId: data.refundOfIncomeId ? identifier(data.refundOfIncomeId) : null, recordedAt: this.now() };
    const entries = this.rows('ops_accounting');
    if (record.settlesReceivableId) {
      check(record.kind === 'income', 'invalid_input', 'Only collected income can settle a receivable');
      const invoice = entries.find(entry => entry.id === record.settlesReceivableId && entry.kind === 'receivable');
      check(invoice && invoice.currency === currency && invoice.account === record.account, 'invalid_input', 'Receivable must exist in the same currency and account');
      const applied = entries.filter(entry => entry.kind === 'income' && entry.settlesReceivableId === invoice.id).reduce((total, entry) => safeAdd(total, entry.amountCents), 0);
      check(record.amountCents <= invoice.amountCents - applied, 'overpayment', 'Linked income exceeds the outstanding receivable');
    }
    if (record.kind === 'refund') {
      check(record.refundOfIncomeId, 'evidence_required', 'Refunds must link to a recorded collected-income entry');
      const payment = entries.find(entry => entry.id === record.refundOfIncomeId && entry.kind === 'income');
      check(payment && payment.currency === currency && payment.account === record.account, 'invalid_input', 'Refund payment must exist in the same currency and account');
      const refunded = entries.filter(entry => entry.kind === 'refund' && entry.refundOfIncomeId === payment.id).reduce((total, entry) => safeAdd(total, entry.amountCents), 0);
      check(record.amountCents <= payment.amountCents - refunded, 'excess_refund', 'Cumulative refunds exceed the recorded collected payment');
    } else check(!record.refundOfIncomeId, 'invalid_input', 'Only refunds may reference an original payment');
    accountingOverview([...entries, record]);
    return record;
  }
  addCompany(data, source, skipExisting = false) {
    const record = this.company(data, source);
    const identity = digest([record.name.toLowerCase().replace(/\s+/g,' '), record.location?.toLowerCase() || '', record.website || '']);
    const existing = this.db.prepare('SELECT payload FROM ops_companies WHERE id=? OR identity=?').get(record.id, identity);
    if (existing) {
      check(skipExisting, 'duplicate_record', 'Company already recorded');
      const prior = JSON.parse(existing.payload);
      if (record.status === 'do_not_contact' && prior.status !== 'do_not_contact') {
        const protectedRecord = { ...prior, status:'do_not_contact', nextStep:record.nextStep, updatedAt:this.now(), revision:prior.revision+1 };
        this.db.prepare('UPDATE ops_companies SET payload=? WHERE id=?').run(JSON.stringify(protectedRecord), prior.id);
        return { record:protectedRecord, added:false, optOutUpdated:true };
      }
      return { record:prior, added:false };
    }
    check(this.rows('ops_companies').length < 1000, 'record_limit', 'Company limit reached');
    this.db.prepare('INSERT INTO ops_companies(id,identity,payload) VALUES (?,?,?)').run(record.id, identity, JSON.stringify(record));
    return { record, added: true };
  }
  addProject(data, source, skipExisting = false) {
    if (skipExisting && data.id && this.db.prepare('SELECT id FROM ops_projects WHERE id=?').get(data.id)) return { record: this.get('ops_projects', data.id), added: false };
    const record = this.project(data, source);
    check(!this.db.prepare('SELECT id FROM ops_projects WHERE id=?').get(record.id), 'duplicate_record', 'Project already recorded');
    check(this.rows('ops_projects').length < 1000, 'record_limit', 'Project limit reached');
    this.db.prepare('INSERT INTO ops_projects(id,payload) VALUES (?,?)').run(record.id, JSON.stringify(record));
    return { record, added: true };
  }
  addEntry(data, source, skipExisting = false) {
    check(data && typeof data === 'object' && !Array.isArray(data), 'invalid_input', 'Accounting entry required');
    data = { ...data, reference:str(data.reference,300,'transaction reference'), source:str(data.source || source,240,'accounting source'), account:str(data.account ?? 'default',160,'account scope'), date:str(data.date,10,'accounting date') };
    const referenceKey = digest([data.kind, data.source, data.account, data.reference]);
    const indexed = this.db.prepare('SELECT payload FROM ops_accounting WHERE reference_key=? OR id=?').get(referenceKey, data.id || '');
    // The fallback preserves identity for any receipts written before the key schema tightened.
    const existing = indexed ? JSON.parse(indexed.payload) : this.rows('ops_accounting').find(record => record.kind === data.kind && record.source === data.source && record.account === data.account && record.reference === data.reference);
    if (existing) {
      check(skipExisting, 'duplicate_record', 'Transaction reference already recorded');
      const record = existing;
      const proposed = { kind: data.kind, amountCents: data.amountCents, currency: data.currency ?? 'USD', date: data.date, reference: data.reference, source: data.source || source, account: data.account ?? 'default', settlesReceivableId: data.settlesReceivableId ?? null, refundOfIncomeId: data.refundOfIncomeId ?? null };
      check(Object.entries(proposed).every(([key, value]) => record[key] === value), 'duplicate_conflict', 'Imported transaction conflicts with an immutable recorded receipt');
      return { record, added: false };
    }
    const record = this.entry(data, source);
    check(this.rows('ops_accounting').length < 5000, 'record_limit', 'Accounting entry limit reached');
    this.db.prepare('INSERT INTO ops_accounting(id,reference_key,payload) VALUES (?,?,?)').run(record.id, referenceKey, JSON.stringify(record));
    return { record, added: true };
  }
  command(input) {
    const { action, actor } = input;
    if (action === 'operations.import') {
      check(['bob','owner'].includes(actor), 'forbidden', 'Only orchestrator or owner can import snapshots');
      const snapshot = input.snapshot;
      check(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'invalid_input', 'Sanitized operations snapshot required');
      const source = str(snapshot.source, 240, 'snapshot source');
      const groups = { companies: snapshot.companies ?? [], projects: snapshot.projects ?? [], accounting: snapshot.accounting ?? [] };
      for (const [name, values] of Object.entries(groups)) check(Array.isArray(values) && values.length <= 250, 'import_limit', `At most 250 ${name} per import`);
      const counts = { companiesAdded: 0, projectsAdded: 0, accountingAdded: 0, optOutsUpdated: 0, skipped: 0 };
      for (const company of groups.companies) { const result = this.addCompany(company, source, true); result.added ? counts.companiesAdded++ : result.optOutUpdated ? counts.optOutsUpdated++ : counts.skipped++; }
      for (const project of groups.projects) { const result = this.addProject(project, source, true); result.added ? counts.projectsAdded++ : counts.skipped++; }
      for (const entry of groups.accounting) { const result = this.addEntry(entry, source, true); result.added ? counts.accountingAdded++ : counts.skipped++; }
      const receipt = { id: randomUUID(), source, importedAt: this.now(), ...counts };
      this.db.prepare('INSERT INTO ops_imports(id,payload) VALUES (?,?)').run(receipt.id, JSON.stringify(receipt));
      return { import: receipt, event: this.store.event(null, actor, 'operations.imported', { message: 'Sanitized operations snapshot imported', counts }) };
    }
    if (action.startsWith('operations.company.')) {
      check(['bob','owner','scout'].includes(actor), 'forbidden', 'Only research or orchestrator role can update companies');
      if (action === 'operations.company.add') { const result = this.addCompany(input.company, input.source); return { company: result.record, event: this.store.event(null, actor, 'operations.company.added', { message: 'Company research recorded', companyId: result.record.id }) }; }
      if (action === 'operations.company.update') {
        const prior = this.get('ops_companies', input.companyId); check(input.revision === prior.revision, 'revision_conflict', 'Company changed; reread its revision');
        const record = this.company(input.patch, input.source, prior);
        const identity = digest([record.name.toLowerCase().replace(/\s+/g,' '), record.location?.toLowerCase() || '', record.website || '']);
        check(!this.db.prepare('SELECT id FROM ops_companies WHERE identity=? AND id!=?').get(identity, record.id), 'duplicate_record', 'Company identity already exists');
        this.db.prepare('UPDATE ops_companies SET identity=?,payload=? WHERE id=?').run(identity, JSON.stringify(record), record.id);
        return { company: record, event: this.store.event(null, actor, 'operations.company.updated', { message: 'Company research updated', companyId: record.id }) };
      }
    }
    if (action.startsWith('operations.project.')) {
      check(['bob','owner','codex','designer'].includes(actor), 'forbidden', 'Only build or orchestrator role can update projects');
      if (action === 'operations.project.add') { const result = this.addProject(input.project, input.source); return { project: result.record, event: this.store.event(null, actor, 'operations.project.added', { message: 'Project brief recorded', projectId: result.record.id }) }; }
      if (action === 'operations.project.update') {
        const prior = this.get('ops_projects', input.projectId); check(input.revision === prior.revision, 'revision_conflict', 'Project changed; reread its revision');
        const record = this.project(input.patch, input.source, prior);
        this.db.prepare('UPDATE ops_projects SET payload=? WHERE id=?').run(JSON.stringify(record), record.id);
        return { project: record, event: this.store.event(null, actor, 'operations.project.updated', { message: 'Project brief updated', projectId: record.id }) };
      }
    }
    if (action === 'operations.accounting.add') {
      check(['bob','owner','accountant'].includes(actor), 'forbidden', 'Only bookkeeping or orchestrator role can record transactions');
      const result = this.addEntry(input.entry, input.source);
      // Do not copy transaction amounts, references or counterparty details into the general task event feed.
      return { entry: result.record, event: this.store.event(null, actor, 'operations.accounting.added', { message: 'Private bookkeeping entry recorded', entryId: result.record.id }) };
    }
    fail('action_disabled', 'Unsupported operations action; this ledger never sends outreach, money or invoices');
  }
  state() {
    const entries = this.rows('ops_accounting');
    return { companies: this.rows('ops_companies'), projects: this.rows('ops_projects'), accounting: { entries, overview: accountingOverview(entries) }, imports: this.rows('ops_imports').slice(-20), privacy: 'Private local runtime database; connector snapshots are sanitized, never copied raw', execution: 'Records describe verified observations and local work; no outreach or payment adapter' };
  }
}
