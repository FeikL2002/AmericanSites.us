import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get } from 'node:http';
import { HQStore, POLICY } from '../server/store.mjs';
import { createHQServer } from '../server/index.mjs';

const DIGEST = 'a'.repeat(64);
function fixture(t, path = ':memory:') {
  let now = 1794200000000, key = 0;
  const store = new HQStore(path, { now: () => now });
  t.after(() => store.close());
  const command = (input) => store.command({ idempotencyKey: `command-${++key}`, ...input });
  const create = () => command({ action: 'create', actor: 'bob', title: 'Improve keyboard navigation', brief: 'Add a skip link and verify keyboard focus.' }).task;
  const act = (task, action, actor, data = {}) => command({ action, actor, taskId: task.id, revision: store.get(task.id).revision, ...data });
  const start = () => { const task = create(); act(task, 'assign', 'bob', { assignedTo: 'codex' }); act(task, 'start', 'codex'); return task; };
  const artifact = task => act(task, 'evidence', 'codex', { evidence: { kind: 'artifact', title: 'HTML patch', summary: 'Implementation was inspected.', sha256: DIGEST, path: 'evidence/change.diff' } });
  const review = task => act(task, 'evidence', 'security', { evidence: { kind: 'code_review', title: 'Security review', summary: 'Scoped review passed.', artifactSha256: DIGEST, verdict: 'passed' } });
  const testing = () => { const task = start(); artifact(task); act(task, 'review', 'codex'); review(task); act(task, 'test', 'security'); return task; };
  const result = (task, exitCode = 0, artifactSha256 = DIGEST) => act(task, 'evidence', 'qa', { evidence: { kind: 'test_result', title: 'QA tests', summary: 'Actual command result.', artifactSha256, command: 'node --test tests/navigation.test.mjs', exitCode, durationMs: 135 } });
  return { store, command, create, act, start, artifact, review, testing, result, advance: ms => now += ms };
}

test('empty store has five idle workers, unknown session costs, and disabled sensitive adapters', t => {
  const { store } = fixture(t);
  const state = store.state();
  assert.equal(state.workers.length, 5);
  assert.equal(state.tasks.length, 0);
  assert.ok(state.workers.every(w => w.status === 'idle' && !w.isWorking));
  assert.equal(state.costs.sessionTokens, null);
  assert.equal(state.costs.sessionCostUsd, null);
  assert.equal(state.costs.inputTokens, null);
  assert.equal(state.policy.paidExecutionEnabled, false);
  assert.equal(state.policy.budgetUsd, 0);
});

test('full evidence-backed handoff stops at owner approval with append-only events', t => {
  const f = fixture(t), task = f.testing();
  f.act(task, 'heartbeat', 'qa');
  assert.equal(f.store.state().workers.find(w => w.id === 'qa').isWorking, true);
  f.result(task);
  f.act(task, 'request_approval', 'qa');
  const state = f.store.state();
  assert.equal(state.tasks[0].status, 'awaiting_approval');
  assert.ok(state.events.every(e => e.id && e.seq && e.at && e.actor));
  assert.equal(new Set(state.events.map(e => e.seq)).size, state.events.length);
  assert.equal(state.artifacts.length, 3);
  assert.ok(state.workers.every(w => !w.isWorking));
  assert.throws(() => f.act(task, 'deploy', 'owner'), { code: 'action_disabled' });
});

test('rejects unauthorized actors and impossible transitions', t => {
  const f = fixture(t), task = f.create();
  assert.throws(() => f.act(task, 'assign', 'qa', { assignedTo: 'codex' }), { code: 'forbidden' });
  assert.throws(() => f.act(task, 'start', 'codex'), { code: 'invalid_transition' });
  f.act(task, 'assign', 'bob', { assignedTo: 'codex' });
  assert.throws(() => f.act(task, 'start', 'qa'), { code: 'forbidden' });
  assert.throws(() => f.command({ action: 'create', actor: 'attacker', title: 'X', brief: 'Y' }), { code: 'forbidden' });
});

test('revision CAS rejects stale writers without extra events', t => {
  const f = fixture(t), task = f.create();
  f.act(task, 'assign', 'bob', { assignedTo: 'codex' });
  const count = f.store.state().events.length;
  assert.throws(() => f.command({ action: 'start', actor: 'codex', taskId: task.id, revision: task.revision }), { code: 'revision_conflict' });
  assert.equal(f.store.state().events.length, count);
});

test('idempotency returns original result and rejects key reuse with altered input', t => {
  const f = fixture(t);
  const input = { action: 'create', actor: 'bob', title: 'A real task', brief: 'Evidence first', idempotencyKey: 'stable' };
  const a = f.command(input), b = f.command(input);
  assert.deepEqual(b, a);
  assert.equal(f.store.state().tasks.length, 1);
  assert.throws(() => f.command({ ...input, title: 'Different task' }), { code: 'idempotency_conflict' });
});

test('implementation, review, matching artifact digest and test result are mandatory', t => {
  const f = fixture(t), task = f.start();
  assert.throws(() => f.act(task, 'review', 'codex'), { code: 'evidence_required' });
  f.artifact(task); f.act(task, 'review', 'codex');
  assert.throws(() => f.act(task, 'test', 'security'), { code: 'evidence_required' });
  f.review(task); f.act(task, 'test', 'security');
  assert.throws(() => f.act(task, 'request_approval', 'qa'), { code: 'evidence_required' });
  f.result(task, 0, 'b'.repeat(64));
  assert.throws(() => f.act(task, 'request_approval', 'qa'), { code: 'evidence_required' });
  f.result(task, 1);
  assert.throws(() => f.act(task, 'request_approval', 'qa'), { code: 'evidence_required' });
});

test('a later failing result supersedes an earlier passing result', t => {
  const f = fixture(t), task = f.testing();
  f.result(task); f.result(task, 1);
  assert.throws(() => f.act(task, 'request_approval', 'qa'), { code: 'evidence_required' });
});

test('worker leases expire without inventing task completion and handoffs require a heartbeat', t => {
  const f = fixture(t), task = f.start();
  assert.equal(f.store.state().workers.find(w => w.id === 'codex').isWorking, true);
  f.advance(POLICY.leaseMs + 1);
  const worker = f.store.state().workers.find(w => w.id === 'codex');
  assert.equal(worker.status, 'stale'); assert.equal(worker.isWorking, false);
  assert.equal(f.store.get(task.id).status, 'running');
  f.act(task, 'heartbeat', 'codex');
  assert.equal(f.store.state().workers.find(w => w.id === 'codex').isWorking, true);
  f.artifact(task); f.act(task, 'review', 'codex');
  assert.equal(f.store.state().workers.find(w => w.id === 'security').isWorking, false);
  f.act(task, 'heartbeat', 'security');
  assert.equal(f.store.state().workers.find(w => w.id === 'security').isWorking, true);
});

test('attempt limits block endless retries', t => {
  const f = fixture(t), task = f.start();
  f.act(task, 'block', 'codex', { reason: 'Dependency unavailable' });
  f.act(task, 'assign', 'bob', { assignedTo: 'codex' }); f.act(task, 'start', 'codex');
  f.act(task, 'block', 'codex', { reason: 'Still unavailable' });
  assert.throws(() => f.act(task, 'assign', 'bob', { assignedTo: 'codex' }), { code: 'attempt_limit' });
});

test('step limit and runtime limit fail closed while retaining the stop path', t => {
  const f = fixture(t), task = f.start();
  while (f.store.get(task.id).steps < POLICY.maxSteps) f.act(task, 'evidence', 'bob', { evidence: { kind: 'note', title: 'Operator note', summary: 'Observed status' } });
  assert.throws(() => f.artifact(task), { code: 'step_limit' });
  f.act(task, 'block', 'bob', { reason: 'Step budget reached' });
  const other = f.start(); f.advance(POLICY.maxRuntimeMs + 1);
  assert.throws(() => f.act(other, 'heartbeat', 'codex'), { code: 'runtime_limit' });
  assert.throws(() => f.artifact(other), { code: 'runtime_limit' });
  f.act(other, 'fail', 'bob', { reason: 'Time budget reached' });
});

test('rejects unsafe artifact paths, malformed digest, missing real test fields and negative usage', t => {
  const f = fixture(t), task = f.start();
  assert.throws(() => f.act(task, 'evidence', 'codex', { evidence: { kind: 'artifact', title: 'Bad path', summary: 'No', sha256: DIGEST, path: '../private' } }), { code: 'invalid_input' });
  assert.throws(() => f.act(task, 'evidence', 'codex', { evidence: { kind: 'artifact', title: 'Bad digest', summary: 'No', sha256: 'abc' } }), { code: 'invalid_input' });
  f.act(task, 'block', 'codex', { reason: 'Input validation check complete' });
  const testing = f.testing();
  assert.throws(() => f.act(testing, 'evidence', 'qa', { evidence: { kind: 'test_result', title: 'No command', summary: 'Not actual', artifactSha256: DIGEST, exitCode: 0 } }), { code: 'invalid_input' });
  assert.throws(() => f.command({ action: 'usage', actor: 'bob', usage: { source: 'provider_receipt', inputTokens: -1, outputTokens: 1, cachedTokens: 0, costUsd: 0 } }), { code: 'invalid_input' });
});

test('provider receipts are distinct from unavailable session usage and deduplicated', t => {
  const f = fixture(t), usage = { source: 'provider_receipt', provider: 'Example provider', model: 'test-model', receiptId: 'receipt-test-only', inputTokens: 100, outputTokens: 20, cachedTokens: 10, costUsd: 0.001, pricingSnapshot: 'Test fixture pricing, not a live API call' };
  f.command({ action: 'usage', actor: 'bob', usage });
  const costs = f.store.state().costs;
  assert.equal(costs.inputTokens, 100); assert.equal(costs.trackedApiCostUsd, 0.001); assert.equal(costs.sessionCostUsd, null);
  assert.throws(() => f.command({ action: 'usage', actor: 'bob', usage }), { code: 'duplicate_receipt' });
});

test('SQLite task, events and idempotency survive a closed and reopened database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hq-persistence-')), path = join(dir, 'tasks.sqlite');
  try {
    const input = { action: 'create', actor: 'bob', title: 'Durable task', brief: 'Survive server restarts', idempotencyKey: 'durable-create' };
    const first = new HQStore(path), original = first.command(input); first.close();
    const second = new HQStore(path);
    assert.deepEqual(second.get(original.task.id), original.task);
    assert.equal(second.state().events.length, 1);
    assert.deepEqual(second.command(input), original);
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP serves no-store state only; mutation attempts cannot alter the database', async t => {
  const f = fixture(t), server = createHQServer(f.store);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const state = await fetch(`${base}/api/state`);
  assert.equal(state.status, 200); assert.equal(state.headers.get('cache-control'), 'no-store');
  assert.equal((await state.json()).workers.length, 5);
  const mutation = await fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Untrusted mutation' }) });
  assert.equal(mutation.status, 403); assert.equal((await mutation.json()).error, 'owner_channel_required');
  assert.equal(f.store.state().tasks.length, 0);
  assert.equal((await fetch(`${base}/../../etc/passwd`)).status, 404);
  const rebindStatus = await new Promise((resolve, reject) => get(`${base}/api/state`, { headers: { Host: 'rebind.attacker.example' } }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject));
  assert.equal(rebindStatus, 403);
  assert.equal((await fetch(`${base}/api/state`, { headers: { origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await fetch(`${base}/api/state`, { headers: { origin: 'malformed' } })).status, 400);
});

test('a worker cannot start two concurrent jobs and live work takes display priority', t => {
  const f = fixture(t), active = f.start(), other = f.create();
  f.advance(1);
  f.act(other, 'assign', 'bob', { assignedTo: 'codex' });
  assert.throws(() => f.act(other, 'start', 'codex'), { code: 'worker_busy' });
  assert.equal(f.store.state().workers.find(w => w.id === 'codex').taskId, active.id);
});

test('a later changes-requested review supersedes a passing review', t => {
  const f = fixture(t), task = f.start(); f.artifact(task); f.act(task, 'review', 'codex'); f.review(task);
  f.act(task, 'evidence', 'security', { evidence: { kind: 'code_review', title: 'Follow-up review', summary: 'Regression found', artifactSha256: DIGEST, verdict: 'changes_requested' } });
  assert.throws(() => f.act(task, 'test', 'security'), { code: 'evidence_required' });
});

test('new events record assigned roles and real heartbeat leases for conservative replay', t => {
  const f = fixture(t), task = f.start();
  const original = f.store.state().events.map(event => ({ ...event }));
  assert.equal(original.find(e => e.type === 'task.created').assignedTo, null);
  assert.equal(original.find(e => e.type === 'task.assign').assignedTo, 'codex');
  assert.ok(original.find(e => e.type === 'task.start').leaseExpiresAt);
  f.advance(1000);
  const heartbeat = f.act(task, 'heartbeat', 'codex');
  assert.equal(heartbeat.event.type, 'task.heartbeat');
  assert.equal(heartbeat.event.actor, 'codex');
  assert.equal(heartbeat.event.assignedTo, 'codex');
  assert.equal(heartbeat.event.leaseExpiresAt, heartbeat.task.leaseExpiresAt);
  for (const event of original) assert.deepEqual(f.store.state().events.find(e => e.id === event.id), event);
});

test('pending review handoffs cannot obtain two simultaneous leases for one reviewer', t => {
  const f = fixture(t), first = f.start();
  f.artifact(first); f.act(first, 'review', 'codex');
  const second = f.start(); f.artifact(second); f.act(second, 'review', 'codex');
  f.act(first, 'heartbeat', 'security');
  assert.throws(() => f.act(second, 'heartbeat', 'security'), { code: 'worker_busy' });
  f.advance(POLICY.leaseMs + 1);
  f.act(second, 'heartbeat', 'security');
  assert.equal(f.store.state().workers.find(w => w.id === 'security').taskId, second.id);
});
