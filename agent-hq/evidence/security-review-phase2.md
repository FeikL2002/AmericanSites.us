# Phase 2 — independent security and product review

Reviewer: the separate security-reviewer session role.
Scope: plain-language work status, private operations/bookkeeping records,
read-only live updates, and a local prospect concept.

Final verdict: **passed for the trusted-local, read-only preview scope and QA
handoff**. This is not approval for public hosting, production deployment,
remote writes, outreach, spending, or unattended model execution.

Latest reviewed manifest: `phase2-final-manifest.json`.
Manifest SHA-256:
`10e4dc39d9a5be8643f11e2aa6dadb644bbb90e90c3b8d7e6716cfc17e38904b`.
Independently recomputed all **24** listed source/test file digests; **zero
mismatches**. The manifest contains no runtime records.

The original reviewed manifest `phase2-build-manifest.json` remains preserved at
SHA-256 `33ffcfb01bc4d3c9fcbad1315ba58c929c9d951bbd35e63dc4bb65da101be642`.

## Product judgment

The most useful business view answers four questions at each desk: what is
being done, why it matters, what was last verified, and what needs Lewis next.
A status animation is useful only when those answers come from recorded work.
Role names must not imply that an independently connected model provider ran.

Prospect concepts should remain visibly unsent and unaffiliated until an actual
agreement or authorized contact exists. Publicly observed business processes
support a question to ask, not a claim of missing software or buying intent.

Bookkeeping should distinguish recorded collections, refunds, expenses,
receivables, and obligations. A recorded subtotal is not a reconciled bank
balance or a verified payout. Missing fees and unimported activity remain
unknown. Fictional concept payments must never enter this ledger.

## Backend review and verified fixes

Reviewed actual `server/operations.mjs`, `server/store.mjs`, `server/index.mjs`,
the trusted local CLI, and corresponding tests. The same trusted-local operator
boundary remains: HTTP and SSE are read-only; actor fields are local workflow
attribution, not authenticated remote identities.

The following defects were found and fixed during this review:

1. Whitespace in receipt identity fields bypassed duplicate protection. Receipt
   identity is now normalized before lookup.
2. A payment could settle a receivable from a different account. Links now
   require the same account and currency.
3. Importing a later company opt-out left the older active stage unchanged.
   Imports now escalate to do-not-contact and older snapshots cannot clear it.
4. A changed receipt could be silently skipped during import. Conflicting
   immutable receipt data now raises an explicit conflict.
5. A changed currency could create a second copy of the same receipt. Currency
   is now immutable receipt data, rather than part of receipt identity. Existing
   earlier-key records are checked through a normalized lookup without mutation.

The first three were independently reproduced in isolated synthetic memory
databases. No real customer or accounting records were changed by this reviewer.

Verified controls include safe integer amounts and aggregate overflow checks;
separate supported cent-currency totals; linked cumulative refund limits;
receivables separated from income; append-only accounting; role/revision checks;
atomic imports; and explicit field allowlists that omit raw connector payloads,
credentials, phone numbers, and email fields. Transaction details are not copied
into general task event messages.

Provider receipt records and role labels remain distinct from unmeasured session
token use. No payment, outreach, paid-model, or production-deployment adapter was
introduced by the reviewed backend.

## Independent backend validation

Command:
`node --test agent-hq/tests/backend.test.mjs agent-hq/tests/operations.test.mjs`.

Observed result: **33 passed, 0 failed, exit 0**; runner duration **708.38 ms**.
Tests use synthetic data and temporary/in-memory databases.

An additional independently started local API probe observed:

| Probe | Observed result |
| --- | --- |
| First eight SSE connections | 200 each |
| Ninth SSE connection | 429 |
| Foreign Host on SSE | 403 |
| Foreign Origin on SSE | 403 |
| POST to SSE | 403 |

Streams have connection and lifetime limits, disconnect cleanup, and a buffered
output limit. The state/SSE response includes private local ledger data; it must
not be exported to public GitHub evidence or exposed through an unauthenticated
public reverse proxy. Existing local Host checks are not remote user login.

## Prototype source review

The local concept uses anonymous `DEMO-###` identifiers, strict session and
participant validation, and fictional payment wording. Its code uses DOM text
rendering, neutralizes spreadsheet formula prefixes in CSV export, and contains
no payment, fetch, or messaging adapter. Browser storage failure is handled as
in-memory-only sample state. It does not write to the AmericanSites ledger.

Local preview references require an existing HTML file under the prototype
directory; traversal, remote URLs, missing files, and symbolic links are rejected
when a project is recorded. This validates the record, not every future file
replacement. The local host operator remains trusted.

## Final prototype and UI integration review

The concept now has a self-contained inline script/style bundle. The iframe uses
`sandbox="allow-scripts allow-downloads allow-forms"` and omits same-origin, popup, and
top-navigation privileges. Embedded sample storage therefore falls back to
page memory; its separate full-preview link can use device-local sample storage.
The reviewed code does not access the parent window or HQ API.

The prototype response policy denies external resources, connections, forms,
base-URL changes, and object content while permitting the reviewed inline code
and styles. An encoded-path alias initially bypassed that policy; this reviewer
reproduced it and the server was corrected to normalize the path before the
allowlist and policy check. Final independent local Vite probes observed:

| Route | Observed result |
| --- | --- |
| Literal prototype HTML | 200, restrictive CSP, no-store |
| Directory alias | 200, same restrictive CSP, no-store |
| Encoded index alias | 200, same restrictive CSP, no-store |
| Raw prototype module route | 404 |
| Unknown prototype route | 404 |
| Runtime database route | 403 |

These checks used an independently started/closed local server from the frozen
source. They do not claim that this reviewer reached the parent's managed
preview process or performed a browser-level WebGL test.

The business-facing interface now derives accounting freshness and source labels
from accounting entries rather than an unrelated import. It separates sample
money from business records, visibly displays unverified observations and
do-not-contact status, and marks failed tests as failures. Inactive or stale
desks say "Last recorded work"; arbitrary notes are excluded from the recorded
result summary. Request idempotency uses a fresh UUID per new request instead
of colliding on repeated titles. Provider/model limits and the absence of an
unattended runner are stated explicitly.

The dashboard currently refreshes through bounded sequential polling. The SSE
endpoint was separately tested; its presence is not evidence that the frontend
uses it. Work animation still depends on recorded leases, not a stage label.

### Follow-up: local form interaction

Follow-up task: `facd537b-a5cf-4071-8e01-7b8553716314`.

Browser QA found that the initial iframe sandbox suppressed the native submit
event, leaving valid sample-session inputs unchanged. The correction adds
`allow-forms` so the local event handler can receive and prevent the submission.
The response still has `form-action 'none'` and `connect-src 'none'`; no
same-origin, popup, or top-navigation privilege was added.

This reviewer verified that removing only the added `allow-forms` token from
the final App source reproduces the original manifest's exact App hash. All
other 23 manifest files are unchanged. The fix therefore preserves the
reviewed network and origin boundary and **passes for QA handoff**. Supervising
browser QA reported that sample-session creation now works; this reviewer
independently verified the source/hash boundary rather than claiming that
browser observation as their own. The earlier automated test results remain
historical results and are not represented as a new test execution.

## Privacy and remaining scope limits

Runtime database paths remain ignored by Git and blocked by the development
server. The new public accounting evidence is metadata only: reviewed fields
contained no amount, payment/customer/transaction identifier, email, or raw
provider payload. No runtime database or environment file appeared in the
tracked-file query. Financial details remain in the private local runtime.

The prototype security headers are implemented in Vite development middleware.
A future static or production deployment must reproduce those headers and add
authenticated access before publishing private records. Direct full previews
are trusted local documents; this is not an arbitrary untrusted-code hosting
service. Remote authentication, long-lived hosting/backups, provider execution,
bank reconciliation, and a production approval adapter are still outside this
slice. No Operations research reservation or policy was changed by this reviewer.

This report contains no real transaction amounts, customer payment references,
raw Stripe payloads, or private customer details. It is a software/data-integrity
review and does not certify tax treatment, business profitability, bank payout
availability, or the completeness of financial records.
