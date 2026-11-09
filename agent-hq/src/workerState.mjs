/**
 * Deterministic, evidence-only projection for historical playback.
 *
 * `index` is inclusive. Playback time is the selected event's recorded timestamp,
 * never Date.now() or an animation timer. Base workers provide identity/appearance
 * only: all current task/lease fields are cleared before history is replayed.
 *
 * An active task status is not evidence that its worker is currently executing.
 * Start grants its actor a lease; a handoff clears it. Review and test workers
 * become active only after their own recorded heartbeat. The recorded task
 * status remains visible even while waiting for a lease.
 */
const ACTIVE = new Set(['running', 'review', 'testing']);
const TO_STATUS = Object.freeze({
  created: 'queued', assign: 'assigned', assigned: 'assigned', start: 'running',
  review: 'review', test: 'testing', request_approval: 'awaiting_approval',
  block: 'blocked', fail: 'failed', cancel: 'cancelled',
});
const POLICY = Object.freeze({ leaseMs: 120000, maxRuntimeMs: 3600000, maxSteps: 32 });
const time = value => typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
const numberOrDefault = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;

export function replayWorkers(events, index, baseWorkers, policy = {}) {
  const identities = Array.isArray(baseWorkers) ? baseWorkers : [];
  const roles = new Set(identities.map(w => w.id));
  const input = Array.isArray(events) ? events : [];
  const end = Number.isFinite(index) ? Math.min(Math.floor(index), input.length - 1) : -1;
  const initial = identities.map(worker => ({
    ...worker,
    state: 'idle', status: 'idle', active: false, isWorking: false,
    taskId: null, taskTitle: null, taskStatus: null,
    leaseExpiresAt: null, leaseState: 'none', budgetExhausted: false,
  }));
  if (end < 0) return initial;
  const playbackAt = time(input[end]?.at);
  const leaseMs = numberOrDefault(policy?.leaseMs, POLICY.leaseMs);
  const maxRuntimeMs = numberOrDefault(policy?.maxRuntimeMs, POLICY.maxRuntimeMs);
  const maxSteps = numberOrDefault(policy?.maxSteps, POLICY.maxSteps);
  const tasks = new Map();
  const seen = new Set();

  for (let i = 0; i <= end; i++) {
    const event = input[i];
    if (!event || typeof event.taskId !== 'string' || !event.taskId) continue;
    const identity = event.id || (Number.isFinite(event.seq) ? `seq:${event.seq}` : null);
    if (identity && seen.has(identity)) continue;
    if (identity) seen.add(identity);
    const eventTime = time(event.at);
    const action = typeof event.type === 'string' ? event.type.replace(/^task\./, '') : '';
    const heartbeat = ['heartbeat', 'worker.heartbeat'].includes(action);
    const task = tasks.get(event.taskId);
    if (heartbeat) {
      // An arbitrary observer or the worker from before a handoff cannot renew it.
      if (task && ACTIVE.has(task.status) && task.assignedTo === event.actor && Number.isFinite(eventTime)) {
        task.leaseIssuedAt = eventTime;
        task.leaseExpiresAt = eventTime + leaseMs;
        task.lastIndex = i;
      }
      continue;
    }
    if (event.type === 'evidence.added') {
      // Evidence alone neither creates a task nor advances it to a new status.
      if (task) { task.steps++; task.lastIndex = i; }
      continue;
    }
    if (typeof event.type !== 'string' || !event.type.startsWith('task.') || !Object.hasOwn(TO_STATUS, action)) continue;
    const expected = TO_STATUS[action];
    if (event.to !== expected) continue;
    const next = task || {
      id: event.taskId, title: null, assignedTo: null, startedAt: null,
      leaseIssuedAt: null, leaseExpiresAt: null, steps: 0,
    };
    next.status = expected;
    next.lastIndex = i;
    next.steps++;
    next.leaseIssuedAt = null;
    next.leaseExpiresAt = null;
    if (action === 'created') {
      next.title = typeof event.message === 'string' ? event.message : null;
      next.assignedTo = null;
    } else if (action === 'assign' || action === 'assigned') {
      // The orchestrator's action is not an assignment to the orchestrator.
      next.assignedTo = roles.has(event.assignedTo) ? event.assignedTo : null;
    } else if (action === 'start') {
      next.assignedTo = roles.has(event.actor) ? event.actor : null;
      if (Number.isFinite(eventTime)) {
        next.startedAt ??= eventTime;
        next.leaseIssuedAt = eventTime;
        next.leaseExpiresAt = eventTime + leaseMs;
      }
    } else if (action === 'review') next.assignedTo = 'security';
    else if (action === 'test') next.assignedTo = 'qa';
    else if (action === 'request_approval') next.assignedTo = 'bob';
    tasks.set(event.taskId, next);
  }

  const projected = Array.from(tasks.values()).map(task => {
    const budgetExhausted = task.steps >= maxSteps || (Number.isFinite(task.startedAt) && playbackAt - task.startedAt > maxRuntimeMs);
    const hasLease = Number.isFinite(task.leaseIssuedAt) && Number.isFinite(task.leaseExpiresAt);
    const validLease = hasLease && Number.isFinite(playbackAt) && playbackAt >= task.leaseIssuedAt && playbackAt < task.leaseExpiresAt;
    const active = ACTIVE.has(task.status) && validLease && !budgetExhausted;
    return { ...task, active, budgetExhausted, leaseState: !ACTIVE.has(task.status) ? 'none' : !hasLease ? 'waiting' : validLease ? 'valid' : 'expired' };
  });
  return initial.map(worker => {
    const eligible = projected.filter(t => t.assignedTo === worker.id).sort((a, b) => b.lastIndex - a.lastIndex);
    const task = eligible.find(t => t.active) || eligible.find(t => ACTIVE.has(t.status)) || eligible[0];
    if (!task) return worker;
    return {
      ...worker,
      state: task.status, status: task.status, taskStatus: task.status,
      active: task.active, isWorking: task.active,
      taskId: task.id, taskTitle: task.title,
      leaseState: task.leaseState,
      leaseExpiresAt: Number.isFinite(task.leaseExpiresAt) ? new Date(task.leaseExpiresAt).toISOString() : null,
      budgetExhausted: task.budgetExhausted,
    };
  });
}
