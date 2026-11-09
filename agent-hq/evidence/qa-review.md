# QA review — AmericanSites Agent HQ

Recorded: 2026-11-09T08:12:32.974Z

## Independently executed backend verification

Command: `node --test tests/backend.test.mjs`

Exit code: 0. Result: 16 tests passed, 0 failed. Runner-reported duration: 185.533401 ms.

Covers legal and forbidden transitions, immutable event ordering, role restrictions, stale revisions, idempotency, matching artifact evidence, latest failing review/test precedence, leases, bounded retries/steps/runtime, safe artifact paths, provider receipt validation, persistence after reopening SQLite, HTTP mutation and origin/host rejection, and concurrent worker starts.

This was run independently by the QA role after implementation. Test fixtures are synthetic only inside the test suite; they are not live task records or claimed provider usage.

## Website improvement

Baseline: `node --test tests/website.test.mjs` failed all 3 acceptance checks against the original historical index. Exact evidence is in `evidence/website-baseline.json`.

Final verification: node --test tests/website.test.mjs → exit 0; 3 tests passed, 0 failed. Executed 2026-11-09T08:13:28.696Z; elapsed 154.469 ms.

Verified first focusable body control is the skip-to-main link, the target is a unique focusable main landmark, and standalone local focus styles reveal the link above the sticky header. Exact command, timestamps, SHA-256, output and duration are in evidence/website-qa.json.

Source SHA-256: 10e373b2bdaaf1042ebdc0bd761165446a6af1c06df0976b092fbedb4c16eccc

## Limits

No production deployment, outreach, payment, form submission, or external model API call was exercised. Backend HTTP access is read-only. Remote persistence still requires separate verification.


## Independent final verification

- npm test: exit 0; 31/31 tests passed (18 backend, 10 replay reducer, 3 website). Measured command elapsed: 410.259427 ms.
- npm run build: exit 0; 51 modules transformed. Measured command elapsed: 3372.879177 ms. JavaScript output: 1,187.28 kB, gzip 333.73 kB.
- Exact command output, timestamps, timing, source digest and local HTTP attempts: evidence/final-verification.json.

The replay tests verify ownership through handoffs, recorded leases, malformed timestamp handling, runtime/step limits, and that evidence alone does not invent work or completion.

## Browser evidence reported by orchestrator

Provenance: root agent reported direct CUA observation; the QA child did not repeat these browser interactions. On the sanitized real website snapshot at http://127.0.0.1:4173/qa/website.html, first Tab focused “Skip to main content” with y=12, height=48 and a 3px outline. Enter focused MAIN#top and changed the URL fragment to #top. External scripts are stripped and CSP blocks submissions on this review route.

The cloud browser has WebGL disabled. The actual 3D scene was therefore **not visually validated** in a WebGL-capable browser; a successful JavaScript build does not establish rendered 3D quality.

## Preview HTTP checks

Attempted GET requests for the SQLite database path, absolute database path, WAL sidecar, hostile Host, sanitized website and read-only API from this QA executor failed with connection refusal. ports 4173, 5173 and 4318 were unreachable here while sites-preview status reported http://127.0.0.1:4173/. These attempts did not establish live Vite file-denial behavior. The orchestrator must verify it through the reachable browser environment. The independent backend HTTP tests passed host/origin/mutation rejection in their isolated local test server.
