import test from 'node:test';
import assert from 'node:assert/strict';
import { replayWorkers } from '../src/workerState.mjs';

const base = ['bob', 'codex', 'designer', 'qa', 'security'].map(id => ({ id, name: id, state: 'running', active: true, taskId: 'future', taskTitle: 'Future task', leaseExpiresAt: '2099-01-01T00:00:00Z' }));
const t0 = Date.parse('2026-11-09T03:00:00Z');
const ev = (seq, actor, type, to, seconds = seq, extra = {}) => ({ seq, taskId: 'task-1', at: new Date(t0 + seconds * 1000).toISOString(), actor, type, to, ...extra });
const events = [
  ev(1, 'bob', 'task.created', 'queued', 0, { message: 'Improve keyboard navigation' }),
  ev(2, 'bob', 'task.assign', 'assigned', 1, { assignedTo: 'codex' }),
  ev(3, 'codex', 'task.start', 'running', 2),
  ev(4, 'codex', 'evidence.added', undefined, 10),
  ev(5, 'codex', 'task.review', 'review', 11),
  ev(6, 'security', 'task.heartbeat', undefined, 12),
  ev(7, 'security', 'evidence.added', undefined, 18),
  ev(8, 'security', 'task.test', 'testing', 19),
  ev(9, 'qa', 'task.heartbeat', undefined, 20),
  ev(10, 'qa', 'evidence.added', undefined, 25),
  ev(11, 'qa', 'task.request_approval', 'awaiting_approval', 26),
];
const get = (history, i, id, policy) => replayWorkers(history, i, base, policy).find(w => w.id === id);

test('empty history clears all live task metadata and never invents workers or tasks', () => {
  for (const worker of replayWorkers([], 0, base)) {
    assert.equal(worker.state, 'idle'); assert.equal(worker.active, false);
    assert.equal(worker.taskId, null); assert.equal(worker.taskTitle, null); assert.equal(worker.leaseExpiresAt, null);
  }
  assert.deepEqual(replayWorkers(events, 2, []), []);
  assert.equal(get(events, -1, 'codex').state, 'idle');
});

test('creation and assignment do not make the orchestrator or assignee work', () => {
  assert.equal(get(events, 0, 'bob').taskId, null);
  const assigned = get(events, 1, 'codex');
  assert.equal(assigned.state, 'assigned'); assert.equal(assigned.active, false);
  assert.equal(assigned.taskTitle, 'Improve keyboard navigation');
  const missingAssignee = events.slice(0, 2).map(e => ({ ...e, assignedTo: undefined }));
  assert.ok(replayWorkers(missingAssignee, 1, base).every(w => w.taskId === null));
});

test('start activates only the recorded developer with a fresh lease', () => {
  const workers = replayWorkers(events, 2, base);
  assert.deepEqual(workers.filter(w => w.active).map(w => w.id), ['codex']);
  assert.equal(get(events, 3, 'codex').state, 'running');
  assert.equal(get(events, 3, 'codex').active, true);
});

test('running → review → testing → approval follows ownership, not the event actor', () => {
  const review = replayWorkers(events, 4, base);
  assert.equal(review.find(w => w.id === 'codex').state, 'idle');
  assert.equal(review.find(w => w.id === 'security').state, 'review');
  assert.ok(review.every(w => !w.active));
  assert.equal(get(events, 5, 'security').active, true);
  const testing = replayWorkers(events, 7, base);
  assert.equal(testing.find(w => w.id === 'security').state, 'idle');
  assert.equal(testing.find(w => w.id === 'qa').state, 'testing');
  assert.ok(testing.every(w => !w.active));
  assert.equal(get(events, 8, 'qa').active, true);
  const approval = replayWorkers(events, 10, base);
  assert.ok(approval.every(w => !w.active));
  assert.equal(approval.find(w => w.id === 'qa').state, 'idle');
  assert.equal(approval.find(w => w.id === 'bob').state, 'awaiting_approval');
});

test('leases expire using the selected historical event time, without changing task outcome', () => {
  const history = [...events.slice(0, 3), ev(4, 'codex', 'evidence.added', undefined, 122)];
  const expired = get(history, 3, 'codex');
  assert.equal(expired.state, 'running'); assert.equal(expired.active, false); assert.equal(expired.leaseState, 'expired');
  const beforeExpiry = [...history.slice(0, 3), ev(4, 'codex', 'evidence.added', undefined, 121.999)];
  assert.equal(get(beforeExpiry, 3, 'codex').active, true);
  assert.equal(get(beforeExpiry, 3, 'codex', { leaseMs: 10000 }).active, false);
});

test('a former worker heartbeat cannot start the next worker or renew the old lease', () => {
  const history = [...events.slice(0, 5), ev(6, 'codex', 'task.heartbeat', undefined, 12)];
  assert.ok(replayWorkers(history, 5, base).every(w => !w.active));
  assert.equal(get(history, 5, 'security').leaseState, 'waiting');
});

test('evidence and unknown events alone never create a task or simulate completion', () => {
  const history = [ev(1, 'qa', 'evidence.added', 'completed'), ev(2, 'qa', 'timer.finished', 'completed')];
  assert.ok(replayWorkers(history, 1, base).every(w => w.taskId === null && !w.active));
});

test('malformed timestamps fail closed for work animation', () => {
  const history = events.slice(0, 3).map((e, i) => i === 2 ? { ...e, at: 'invalid' } : e);
  assert.equal(get(history, 2, 'codex').active, false);
});

test('runtime and step limits stop replay work animation', () => {
  assert.equal(get(events, 3, 'codex', { maxRuntimeMs: 1000 }).active, false);
  assert.equal(get(events, 2, 'codex', { maxSteps: 3 }).active, false);
  assert.equal(get(events, 2, 'codex', { maxSteps: 3 }).budgetExhausted, true);
});

test('input data is not mutated and duplicate event identities are ignored', () => {
  const original = JSON.stringify({ events, base });
  const duplicated = [...events.slice(0, 3), events[2]];
  assert.equal(get(duplicated, 3, 'codex', { maxSteps: 4 }).active, true);
  replayWorkers(events, 10, base);
  assert.equal(JSON.stringify({ events, base }), original);
});
