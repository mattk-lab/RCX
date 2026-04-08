---
id: h1-no-cache
title: No Caching — Deliberate Deferral
kind: pattern
scope: narrow
status: L0
---

## Summary
Explicitly choose not to implement any caching layer at this stage. Every request is handled synchronously by the Express route handlers, reading directly from the in-memory user store. This is not an oversight — it is a deliberate decision to defer caching until there is measurable evidence that it is needed.

## Rationale
The data store is already in-memory, so the cost of a "cache miss" is essentially a hash-map lookup — already near-zero latency. Adding a cache on top of an in-memory store would cache a cache, introducing complexity without a measurable win. The project has no DB, no external I/O, and no identified hotspot. Premature optimization here would add maintenance burden and obscure future architectural decisions.

## Assumptions
- The in-memory user store lookups are fast enough that response time is dominated by network RTT and JWT verification, not data retrieval.
- Traffic volume is low enough that a single Node.js process is not saturated.
- No expensive computed responses (aggregations, reports) exist or are planned in the near term.
- If performance becomes a problem, profiling will identify the real bottleneck before a caching strategy is chosen.

## Risks
- If traffic grows faster than expected, there is no caching safety net and remediation is reactive rather than proactive.
- Individual route handlers may accumulate ad-hoc memoization over time if caching is never formally addressed, producing an inconsistent and unreviewed approach.
- Stakeholders expecting a "production-ready" API may perceive the absence of caching as an architectural gap.

## Logic Verification

**Verdict: PASS**

The assumptions are internally consistent and accurately reflect the actual codebase. The user store (`src/auth/userStore.js`) is confirmed to be a plain `Map` — a direct hash-map lookup with near-zero latency, making the "caching a cache" argument valid. The application has no database, no external I/O calls, and no aggregation endpoints; all route handlers in `src/app.js` and `src/auth/router.js` are simple synchronous or bcrypt-bound operations. JWT verification is the dominant per-request cost alongside network RTT, as the hypothesis claims. No external infrastructure (Redis, Memcached, etc.) is present in `package.json` dependencies. The rationale for deferral is sound: adding a cache layer here would increase complexity with no measurable benefit. Risks are honestly acknowledged and do not invalidate the decision.

## Evidence Validation

**Verdict: PASS**

trust_score: 0.92

### Industry Practice (YAGNI / Premature Optimization)

Strong consensus in the industry supports deferring caching until a measured bottleneck is identified. Martin Fowler's YAGNI principle, the XP community, and Google's SRE practices all advise against speculative infrastructure. For early-stage APIs — especially those backed by in-memory data and lacking external I/O — caching is a textbook example of premature optimization. The hypothesis correctly identifies this and provides a clear trigger condition (profiling) before a caching strategy would be chosen.

### Benefits and Risks (Engineering Consensus)

The claimed benefits align with known engineering consensus:

- **"Caching a cache" is wasteful**: Confirmed. The user store is a `Map` (hash-map O(1) lookup). Wrapping it in another cache layer would add bookkeeping overhead with no throughput gain.
- **bcrypt is the dominant cost**: Confirmed by code inspection. Both `/auth/register` and `/auth/login` invoke `bcrypt.hash`/`bcrypt.compare` at `BCRYPT_ROUNDS = 12` — a deliberately slow operation (~250ms) that dwarfs any data-access cost by several orders of magnitude. JWT `verify()` (HMAC-SHA256) is similarly faster than any cache lookup overhead.
- **No external I/O**: Confirmed. `package.json` has no Redis, Memcached, database driver, or HTTP client in dependencies. All five runtime deps (`bcryptjs`, `dotenv`, `express`, `express-rate-limit`, `jsonwebtoken`) are used and none introduce caching.
- **Reactive remediation risk is real but acceptable**: The acknowledged risk is honest. For a non-production, early-stage API this is the appropriate stance; for production traffic the risk increases but that is correctly flagged.

### RCX Codebase Evidence

- `src/auth/userStore.js`: Plain `Map` — three operations: `get`, `has`, `set`. No async I/O, no serialization. Cache overhead would exceed lookup cost.
- `src/app.js`: Three routes (`/me`, `/admin`, `/public`). None perform aggregation, joins, or computed data. `/me` and `/admin` are JWT-decode-and-return; `/public` is a no-op optionalAuth check.
- `src/auth/router.js`: Two routes (`/register`, `/login`). Both are bcrypt-bound; per-request latency is dominated by hashing, not data access.
- `src/middleware/authenticate.js`: JWT `verify()` using `jsonwebtoken` — synchronous HMAC check, sub-millisecond, no store access.
- No caching dependencies anywhere in the dependency tree (confirmed by `package.json`).

The evidence fully supports all assumptions. Route complexity is minimal (5 routes total), data shapes are flat user objects, and in-memory Map lookup cost is negligible relative to bcrypt work. The hypothesis is well-grounded, internally consistent, and supported by both industry best practice and direct codebase inspection.
