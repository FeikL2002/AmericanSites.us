# Phase 2 independent QA

## Product critique and source review

The initial source showed worker roles, revisions and JSON before the owner could see a business result. Five recommendations were sent to the orchestrator:

1. Lead with the company, problem, deliverable and preview.
2. Explain what happened, who is working, and what happens next using recorded events.
3. Show human-readable evidence before technical JSON.
4. Clearly distinguish a prepared request from an assigned or started task.
5. Separate confirmed business transactions, obligations, unknown costs and fictional prototype money.

The revised App source implements company/project context, a working product preview, plain-language worker explanations, expandable evidence, a read-only bookkeeping view and clear prepared-request wording. It discloses that the dashboard does not run unattended workers after this session. It does not claim external Claude/Gemini calls.

The office fallback is now a seven-room SVG cutaway with keyboard-selectable desks. Its typing class requires active worker state, connectivity and motion enabled. This is a source review, not a browser animation assertion.

## Prototype acceptance

Added `tests/prototype.test.mjs` with 15 acceptance tests covering:

- Calendar dates, labels, integer-cent bounds and empty-session creation.
- Immutable updates, anonymous DEMO identifiers, duplicates and the 100-record cap.
- Registration-gated check-in and preserving attendance through payment edits.
- Invalid update rejection and exact cash/check/outstanding arithmetic.
- Storage round trips, validation and dropping unexpected personal fields.
- CSV sample labeling, decimal dollars, quoting and formula defense.
- Clear concept/affiliation limits, no submission transports, explicit clearing before replacing records and storage failure disclosure.

The builder resolved the source-review finding that zero-fee sessions offered unusable cash/check controls: these controls now show no payment due and are disabled at a zero example fee.

After the recorded QA handoff, independent execution passed:

- npm test: exit 0; 61 tests passed, 0 failed (18 backend, 15 operations, 15 prototype, 3 website, 10 replay). Command elapsed 988.61698 ms; test-runner duration 717.062218 ms.
- npm run build: exit 0; 53 modules transformed. Command elapsed 3251.378919 ms.
- Exact command output and timestamps: evidence/qa-phase2-results.json.

The build emitted a size advisory: combined JavaScript is 1,211.00 kB, gzip 340.84 kB. This is a performance consideration, not a failed build.

All 24 implementation/test files matched the reviewed manifest before and after execution. Manifest SHA-256: 33ffcfb01bc4d3c9fcbad1315ba58c929c9d951bbd35e63dc4bb65da101be642. All four prototype file hashes match its implementation report.

Additional independent checks compare saved Scout evidence with the prototype source: source URLs, independent/unsent label, unconfirmed need, cash-only policy qualification and sample-money separation align. This does not independently reverify the external website. The public accounting report contains no customer identifiers, contacts, payment references or amounts; no private ledger data was read for this check. Exact results: evidence/qa-phase2-integrity.json.

Inline prototype script equals the tested domain plus application sources: true. Inline CSS equals its source: true.

## Verification boundaries

QA has not performed outreach, payment processing, production deployment or live database mutations. The orchestrator owns browser interaction. Local sample workflow tests use synthetic records only and do not import those records into AmericanSites accounting.

## Final verification after browser-discovered iframe correction

Root found that the opaque embedded preview needed allow-forms for its local native submit event. The corrected iframe permission was independently security-reviewed while network connections and actual form submissions remain blocked by the serving content policy.

After a new recorded QA handoff, this role reran both commands against evidence/phase2-final-manifest.json:

- npm test: exit 0; 61 passed, 0 failed. Command elapsed 846.666841 ms; runner duration 672.799606 ms.
- npm run build: exit 0; command elapsed 2817.927068 ms. Output JavaScript 1,211.01 kB, gzip 340.85 kB; size advisory remains.
- Reviewed final manifest SHA-256: 10e4dc39d9a5be8643f11e2aa6dadb644bbb90e90c3b8d7e6716cfc17e38904b. All listed files matched before and after testing.
- Exact output, timestamps, timings, browser-evidence provenance and limits: evidence/qa-phase2-final-results.json. Prior results are preserved.

Root reported direct CUA verification of sample session creation; disabled check-in for an unregistered anonymous sample; registration then check-in producing one on the mat; and a $10 fictional cash entry producing $10 sample payments and $0 outstanding. QA did not repeat those browser interactions.

**Browser CSV download remains unverified:** the browser download wait timed out. Pure CSV generation, formatting and formula-defense tests passed; this does not establish successful browser downloading.
