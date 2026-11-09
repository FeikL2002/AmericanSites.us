# Local execution boundary

`HQStore` stores tasks, append-only events, evidence and reported provider usage in SQLite. The default path is `data/hq.sqlite` relative to the application directory; set `HQ_DB_PATH` to a durable, private filesystem location for use on a server. A SQLite file survives process restarts. This workspace's disk is not a production backup or managed database service.

The HTTP service is deliberately **read-only**. It binds to `127.0.0.1:4318` by default and serves only `/api/state` and `/api/health`. Host and Origin checks protect the loopback API against DNS rebinding. A local frontend proxy must use `changeOrigin: true`. Do not expose the development frontend or this API publicly without an authenticated access boundary.

Only the trusted local CLI mutates state. Its `actor` is an operator assertion used for state-machine policy, not remote authentication. Never expose the command API as a public route. The process owner can access the database and therefore remains trusted.

```sh
node scripts/hq.mjs state
node scripts/hq.mjs command path/to/command.json
```

Each command supplies `action`, `actor`, and a unique `idempotencyKey`. Task mutations additionally require the current `taskId` and `revision`. Retrying an identical command returns its original result; changing the payload with the same key is rejected. Request JSON may also be passed on standard input using `command -`.

The supported task flow is `create → assign → start → evidence → review → evidence → test → evidence → request_approval`. A running implementer supplies an `artifact` containing a SHA-256 digest. The security reviewer attaches a `code_review` or `security_review` for that digest before handing off to QA. QA records an actual command, exit status, duration and matching artifact digest. The latest matching review/test controls the gate, so an earlier pass cannot override a later failure. Approval requests seal the task at `awaiting_approval`; this slice has no deployment or approval-execution adapter.

Workers must report real work through the local CLI. Handoffs clear the lease; the next worker must explicitly `heartbeat`. `start` establishes a two-minute lease. Missing or expired heartbeats display `stale`, not completion. Budget exhaustion stops active animation. No timer fabricates successful tasks. Historical evidence must be labeled as historical in the UI.

Limits are fixed at 32 steps, two starts, one hour from the initial start and 100 tasks. Stop commands remain available after step/time exhaustion. A worker cannot start a second active job. There is no unbounded execution loop, shell execution endpoint, model call, production deployment, outreach, purchase, or destructive adapter. The HTTP API cannot trigger any of them.

The API reports this ChatGPT session's token use and cost as unavailable (`null`). Provider receipt records, if explicitly imported by the owner, track exact token counts and billed cost separately. No synthetic provider receipt is created in application data; tests use their own isolated databases. The API execution budget is zero and paid execution is disabled.

Evidence summaries and paths are visible to anyone who can read this local preview. Store only reviewable, non-secret evidence. Relative evidence paths are informational; the API never opens or serves files from those paths. Actual worker execution and source provenance are verified by the supervising session before it records a result. This is not an independent cryptographic attestation service.
