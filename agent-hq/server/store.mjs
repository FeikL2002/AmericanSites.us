import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ROLES = Object.freeze([
  { id: 'bob', name: 'BoB', role: 'Orchestrator' },
  { id: 'codex', name: 'Codex', role: 'Developer' },
  { id: 'designer', name: 'Studio', role: 'UI / 3D designer' },
  { id: 'qa', name: 'QA', role: 'QA tester' },
  { id: 'security', name: 'Sentinel', role: 'Security reviewer' },
]);
export const POLICY = Object.freeze({ maxSteps: 32, maxAttempts: 2, maxRuntimeMs: 3600000, leaseMs: 120000, maxTasks: 100, paidExecutionEnabled: false, budgetUsd: 0, productionEnabled: false, outreachEnabled: false, destructiveActionsEnabled: false });
const ACTIVE = new Set(['running', 'review', 'testing']);
const ids = new Set(ROLES.map(r => r.id));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requireThat = (condition, code, message) => { if (!condition) { const e = new Error(message); e.code = code; throw e; } };
const text = (value, max, field) => { requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'invalid_input', `Invalid ${field}`); return value.trim(); };
const sha = value => { requireThat(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'invalid_input', 'A SHA-256 artifact digest is required'); return value; };

/** Trusted local worker channel. HTTP never exposes this command API. */
export class HQStore {
  constructor(path = resolve('data/hq.sqlite'), { now = () => Date.now() } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.now = now;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (key TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
  }
  close() { this.db.close(); }
  get(id) { const row = this.db.prepare('SELECT payload FROM tasks WHERE id=?').get(id); requireThat(row, 'not_found', 'Task not found'); return JSON.parse(row.payload); }
  artifacts(id) { return this.db.prepare('SELECT payload FROM artifacts WHERE task_id=? ORDER BY rowid ASC').all(id).map(r => JSON.parse(r.payload)); }
  event(task, actor, type, detail = {}) {
    const event = { id: randomUUID(), at: new Date(this.now()).toISOString(), taskId: task?.id ?? null, actor, type, ...detail };
    const result = this.db.prepare('INSERT INTO events (id,payload) VALUES (?,?)').run(event.id, JSON.stringify(event));
    return { ...event, seq: Number(result.lastInsertRowid) };
  }
  save(task) { this.db.prepare('INSERT INTO tasks(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(task.id, JSON.stringify(task)); }
  command(input) {
    requireThat(input && typeof input === 'object' && !Array.isArray(input), 'invalid_input', 'Command must be an object');
    const { action, actor, idempotencyKey } = input;
    text(idempotencyKey, 160, 'idempotencyKey');
    requireThat(ids.has(actor) || actor === 'owner', 'forbidden', 'Unknown local actor');
    const digest = hash(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.db.prepare('SELECT digest,result FROM commands WHERE key=?').get(idempotencyKey);
      if (prior) { requireThat(prior.digest === digest, 'idempotency_conflict', 'Key was already used for a different command'); this.db.exec('COMMIT'); return JSON.parse(prior.result); }
      let result;
      if (action === 'create') result = this.create(input);
      else if (action === 'usage') result = this.addUsage(input);
      else {
        requireThat(typeof input.taskId === 'string', 'invalid_input', 'taskId is required');
        const task = this.get(input.taskId);
        requireThat(Number.isInteger(input.revision) && input.revision === task.revision, 'revision_conflict', 'Task changed; reread current revision');
        if (action === 'heartbeat') result = this.heartbeat(task, input);
        else {
          if (!['block', 'fail', 'cancel'].includes(action)) requireThat(task.steps < POLICY.maxSteps, 'step_limit', 'Task step budget exhausted');
          if (!['block', 'fail', 'cancel'].includes(action) && task.startedAt) requireThat(this.now() - Date.parse(task.startedAt) <= POLICY.maxRuntimeMs, 'runtime_limit', 'Task runtime budget exhausted');
          if (action === 'evidence') result = this.evidence(task, input);
          else result = this.transition(task, input);
          task.steps++;
        }
        task.revision++;
        task.updatedAt = new Date(this.now()).toISOString();
        this.save(task);
        result = { ...result, task };
      }
      this.db.prepare('INSERT INTO commands(key,digest,result) VALUES (?,?,?)').run(idempotencyKey, digest, JSON.stringify(result));
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  create({ actor, title, brief }) {
    requireThat(actor === 'bob' || actor === 'owner', 'forbidden', 'Only BoB or owner can queue tasks');
    requireThat(this.db.prepare('SELECT count(*) AS count FROM tasks').get().count < POLICY.maxTasks, 'queue_limit', 'Queue capacity reached');
    const at = new Date(this.now()).toISOString();
    const task = { id: randomUUID(), title: text(title, 180, 'title'), brief: text(brief, 6000, 'brief'), status: 'queued', assignedTo: null, revision: 1, steps: 1, attempts: 0, createdAt: at, updatedAt: at, startedAt: null, leaseExpiresAt: null };
    this.save(task);
    return { task, event: this.event(task, actor, 'task.created', { message: task.title, to: 'queued', assignedTo: null, leaseExpiresAt: null }) };
  }
  heartbeat(task, { actor }) {
    requireThat(ACTIVE.has(task.status) && task.assignedTo === actor, 'forbidden', 'Only the active assigned worker may heartbeat');
    requireThat(task.steps < POLICY.maxSteps, 'step_limit', 'Task step budget exhausted');
    requireThat(this.now() - Date.parse(task.startedAt) <= POLICY.maxRuntimeMs, 'runtime_limit', 'Task runtime budget exhausted');
    requireThat(!this.db.prepare('SELECT payload FROM tasks WHERE id != ?').all(task.id).map(r => JSON.parse(r.payload)).some(t => t.assignedTo === actor && ACTIVE.has(t.status) && Date.parse(t.leaseExpiresAt) > this.now() && this.now() - Date.parse(t.startedAt) <= POLICY.maxRuntimeMs && t.steps < POLICY.maxSteps), 'worker_busy', 'Worker already holds another live lease');
    task.leaseExpiresAt = new Date(this.now() + POLICY.leaseMs).toISOString();
    return { heartbeat: true, event: this.event(task, actor, 'task.heartbeat', { message: 'Worker reported active work', assignedTo: task.assignedTo, leaseExpiresAt: task.leaseExpiresAt, status: task.status }) };
  }
  transition(task, { action, actor, assignedTo, reason }) {
    const previous = task.status;
    const artifacts = this.artifacts(task.id);
    const implementation = artifacts.filter(a => a.kind === 'artifact').at(-1);
    switch (action) {
      case 'assign':
        requireThat(actor === 'bob' || actor === 'owner', 'forbidden', 'Only BoB or owner can assign');
        requireThat(['queued', 'blocked'].includes(previous), 'invalid_transition', 'Task must be queued or blocked');
        requireThat(ids.has(assignedTo), 'invalid_input', 'Unknown assigned worker');
        requireThat(task.attempts < POLICY.maxAttempts, 'attempt_limit', 'Task attempt budget exhausted');
        task.status = 'assigned'; task.assignedTo = assignedTo; break;
      case 'start':
        requireThat(previous === 'assigned', 'invalid_transition', 'Only assigned tasks can start');
        requireThat(task.assignedTo === actor, 'forbidden', 'Only assigned worker can start');
        requireThat(task.attempts < POLICY.maxAttempts, 'attempt_limit', 'Task attempt budget exhausted');
        requireThat(!this.db.prepare('SELECT payload FROM tasks WHERE id != ?').all(task.id).map(r => JSON.parse(r.payload)).some(t => t.assignedTo === actor && ACTIVE.has(t.status)), 'worker_busy', 'Worker already owns another active task; stop or hand it off first');
        task.attempts++; task.status = 'running'; task.startedAt ||= new Date(this.now()).toISOString(); break;
      case 'review':
        requireThat(previous === 'running', 'invalid_transition', 'Only running tasks enter review');
        requireThat(task.assignedTo === actor, 'forbidden', 'Only assigned worker can hand off');
        requireThat(implementation, 'evidence_required', 'Implementation artifact required before review');
        task.status = 'review'; task.assignedTo = 'security'; break;
      case 'test':
        requireThat(previous === 'review', 'invalid_transition', 'Only reviewed tasks enter testing');
        requireThat(actor === 'security', 'forbidden', 'Security reviewer must authorize QA handoff');
        requireThat(implementation && artifacts.filter(a => ['code_review', 'security_review'].includes(a.kind) && a.actor === 'security' && a.artifactSha256 === implementation.sha256).at(-1)?.verdict === 'passed', 'evidence_required', 'Latest review for current artifact must pass');
        task.status = 'testing'; task.assignedTo = 'qa'; break;
      case 'request_approval':
        requireThat(previous === 'testing', 'invalid_transition', 'Only tested tasks can request approval');
        requireThat(actor === 'qa', 'forbidden', 'QA must request approval');
        requireThat(implementation && artifacts.filter(a => a.kind === 'test_result' && a.actor === 'qa' && a.artifactSha256 === implementation.sha256).at(-1)?.exitCode === 0, 'evidence_required', 'Latest QA result for current artifact must pass');
        task.status = 'awaiting_approval'; task.assignedTo = 'bob'; break;
      case 'block': case 'fail': case 'cancel':
        requireThat(!['awaiting_approval', 'cancelled', 'failed'].includes(previous), 'invalid_transition', 'Task cannot be changed from this state');
        requireThat(actor === 'bob' || actor === 'owner' || actor === task.assignedTo, 'forbidden', 'Only owner, BoB or assigned worker may stop');
        task.status = { block: 'blocked', fail: 'failed', cancel: 'cancelled' }[action];
        task.reason = text(reason, 2000, 'reason'); break;
      default: requireThat(false, 'action_disabled', 'Action unavailable. Production, outreach, spending and destructive operations are disabled.');
    }
    // Handoffs never invent a heartbeat for the next worker. A new worker must report a heartbeat.
    task.leaseExpiresAt = action === 'start' ? new Date(this.now() + POLICY.leaseMs).toISOString() : null;
    return { event: this.event(task, actor, `task.${action}`, { from: previous, to: task.status, assignedTo: task.assignedTo, leaseExpiresAt: task.leaseExpiresAt, message: reason || `${previous} → ${task.status}` }) };
  }
  evidence(task, { actor, evidence }) {
    requireThat(evidence && typeof evidence === 'object', 'invalid_input', 'Evidence required');
    const kind = evidence.kind;
    requireThat(['artifact', 'code_review', 'security_review', 'design_review', 'test_result', 'note'].includes(kind), 'invalid_input', 'Unknown evidence kind');
    requireThat(!['cancelled', 'failed', 'awaiting_approval'].includes(task.status), 'invalid_transition', 'Task evidence is sealed');
    if (kind === 'artifact') requireThat(['codex', 'designer', 'bob'].includes(actor) && task.status === 'running' && task.assignedTo === actor, 'forbidden', 'Only active implementer can attach implementation');
    if (['code_review', 'security_review'].includes(kind)) requireThat(actor === 'security' && task.status === 'review', 'forbidden', 'Only security reviewer can submit a review');
    if (kind === 'design_review') requireThat(actor === 'designer', 'forbidden', 'Only designer can submit design review');
    if (kind === 'test_result') requireThat(actor === 'qa' && task.status === 'testing', 'forbidden', 'Only assigned QA can attach test results');
    const record = { id: randomUUID(), taskId: task.id, actor, kind, title: text(evidence.title, 240, 'evidence.title'), summary: text(evidence.summary, 12000, 'evidence.summary'), at: new Date(this.now()).toISOString() };
    if (evidence.path !== undefined) { requireThat(typeof evidence.path === 'string' && !evidence.path.includes('..') && !evidence.path.startsWith('/') && !/^[a-z]+:/i.test(evidence.path), 'invalid_input', 'Evidence path must be a safe relative path'); record.path = evidence.path; }
    if (kind === 'artifact') record.sha256 = sha(evidence.sha256);
    if (['code_review', 'security_review', 'test_result'].includes(kind)) record.artifactSha256 = sha(evidence.artifactSha256);
    if (['code_review', 'security_review', 'design_review'].includes(kind)) { requireThat(['passed', 'changes_requested'].includes(evidence.verdict), 'invalid_input', 'Review verdict required'); record.verdict = evidence.verdict; }
    if (kind === 'test_result') {
      record.command = text(evidence.command, 1000, 'test command');
      requireThat(Number.isInteger(evidence.exitCode) && evidence.exitCode >= 0 && evidence.exitCode <= 255, 'invalid_input', 'Real process exitCode required');
      record.exitCode = evidence.exitCode;
      requireThat(Number.isFinite(evidence.durationMs) && evidence.durationMs >= 0, 'invalid_input', 'Real test duration required');
      record.durationMs = evidence.durationMs;
    }
    this.db.prepare('INSERT INTO artifacts(id,task_id,payload) VALUES (?,?,?)').run(record.id, task.id, JSON.stringify(record));
    return { artifact: record, event: this.event(task, actor, 'evidence.added', { message: record.title, evidenceIds: [record.id] }) };
  }
  addUsage({ actor, usage }) {
    requireThat(actor === 'bob' || actor === 'owner', 'forbidden', 'Only BoB or owner can record receipts');
    requireThat(usage && usage.source === 'provider_receipt', 'invalid_input', 'Provider receipt required; estimates must not be recorded as actual usage');
    for (const field of ['inputTokens', 'outputTokens', 'cachedTokens']) requireThat(Number.isInteger(usage[field]) && usage[field] >= 0, 'invalid_input', `Invalid ${field}`);
    requireThat(usage.cachedTokens <= usage.inputTokens && Number.isFinite(usage.costUsd) && usage.costUsd >= 0, 'invalid_input', 'Invalid usage cost');
    const record = { id: randomUUID(), at: new Date(this.now()).toISOString(), source: usage.source, provider: text(usage.provider, 100, 'provider'), model: text(usage.model, 100, 'model'), receiptId: text(usage.receiptId, 200, 'receiptId'), inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cachedTokens, costUsd: usage.costUsd, pricingSnapshot: text(usage.pricingSnapshot, 1500, 'pricingSnapshot') };
    requireThat(!this.db.prepare('SELECT payload FROM usage').all().some(r => JSON.parse(r.payload).receiptId === record.receiptId), 'duplicate_receipt', 'Provider receipt already recorded');
    this.db.prepare('INSERT INTO usage(id,payload) VALUES (?,?)').run(record.id, JSON.stringify(record));
    return { usage: record, event: this.event(null, actor, 'usage.recorded', { message: 'Provider usage receipt recorded' }) };
  }
  state() {
    const now = this.now();
    const tasks = this.db.prepare('SELECT payload FROM tasks').all().map(r => JSON.parse(r.payload)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    const events = this.db.prepare('SELECT seq,payload FROM events ORDER BY seq DESC LIMIT 300').all().map(r => ({ ...JSON.parse(r.payload), seq: r.seq }));
    const artifacts = this.db.prepare('SELECT payload FROM artifacts').all().map(r => JSON.parse(r.payload));
    const usage = this.db.prepare('SELECT payload FROM usage').all().map(r => JSON.parse(r.payload));
    const workers = ROLES.map(role => {
      const eligible = tasks.filter(t => t.assignedTo === role.id && !['cancelled', 'failed'].includes(t.status));
      const task = eligible.find(t => ACTIVE.has(t.status) && Date.parse(t.leaseExpiresAt) > now) || eligible.find(t => ACTIVE.has(t.status)) || eligible[0];
      const budgetExhausted = !!task && (task.steps >= POLICY.maxSteps || (task.startedAt && now - Date.parse(task.startedAt) > POLICY.maxRuntimeMs));
      const validLease = !!task?.leaseExpiresAt && Date.parse(task.leaseExpiresAt) > now && !budgetExhausted;
      return { ...role, taskId: task?.id ?? null, taskTitle: task?.title ?? null, status: task ? (ACTIVE.has(task.status) && !validLease ? (budgetExhausted ? 'blocked' : 'stale') : task.status) : 'idle', taskStatus: task?.status ?? null, leaseExpiresAt: task?.leaseExpiresAt ?? null, isWorking: !!task && ACTIVE.has(task.status) && validLease, budgetExhausted };
    });
    return { serverTime: new Date(now).toISOString(), revision: events[0]?.seq || 0, mode: 'local-read-only', workers, tasks, events, artifacts, policy: POLICY, costs: { apiCalls: usage.length, trackedApiCostUsd: usage.reduce((n,u) => n + u.costUsd, 0), inputTokens: usage.length ? usage.reduce((n,u) => n + u.inputTokens, 0) : null, outputTokens: usage.length ? usage.reduce((n,u) => n + u.outputTokens, 0) : null, sessionTokens: null, sessionCostUsd: null, sessionUsageStatus: 'unavailable', budgetUsd: POLICY.budgetUsd, paidExecutionEnabled: false, entries: usage } };
  }
}
