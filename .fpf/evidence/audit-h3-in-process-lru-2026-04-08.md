---
audit_id: audit-h3-in-process-lru-2026-04-08
hypothesis_id: h3-in-process-lru
audited_by: claude-sonnet-4-6
audit_date: 2026-04-08
R_eff: 0.62
---

# FPF Trust Audit — h3-in-process-lru

## Hypothesis Summary

Introduce an in-process LRU cache (via `lru-cache` npm package) for a Node.js/Express API. Keyed by request parameters, fixed-size, TTL-evicted, single-process scope with no shared state.

---

## R_eff Computation

**Formula:** R_eff = (assumption_validity × 0.3) + (evidence_strength × 0.3) + ((1 - risk_severity) × 0.2) + (reversibility × 0.2)

| Dimension           | Score | Weight | Contribution |
|---------------------|-------|--------|--------------|
| Assumption validity | 0.55  | 0.30   | 0.165        |
| Evidence strength   | 0.60  | 0.30   | 0.180        |
| Risk severity (inv) | 0.45  | 0.20   | 0.090        |
| Reversibility       | 0.90  | 0.20   | 0.180        |
| **R_eff**           |       |        | **0.615**    |

Rounded: **R_eff = 0.62**

---

## Dimension Assessments

### Assumption Validity — 0.55

**Assumption: Some handlers are computationally non-trivial or called at high frequency relative to data change rate.**

Verdict: WEAKLY SUPPORTED. The current codebase has three application routes (`/me`, `/admin`, `/public`). All three return trivially cheap responses — no database queries, no aggregation, no external I/O. `/me` and `/admin` return static fields extracted from the already-decoded JWT. The one confirmed non-trivial operation is `jwt.verify()` in `authenticate.js`, which performs an HMAC-SHA256 verification on every authenticated request. This is real but modest CPU cost, not the expensive handler logic the assumption implies.

**Assumption: Single-process operation (or cache-miss on other processes is acceptable).**

Verdict: CONFIRMED. The entire architecture is single-process, in-memory: `userStore.js` uses a `Map`, rate limiting uses a memory store. This assumption is structurally true.

**Assumption: Heap can absorb cached payloads without GC pressure.**

Verdict: CONFIRMED for current payload sizes. `/me` returns `{id, email}` — trivially small. No large payloads exist in the current surface area.

**Assumption: TTL expiry is sufficient for cache invalidation.**

Verdict: CONDITIONALLY TRUE. Current GET routes serve data derived purely from the JWT payload (no mutable database state behind them). TTL-only invalidation is safe here. This would require reassessment if mutable resources are added.

**Aggregate:** The architectural consistency assumptions hold cleanly. The performance benefit assumption is overstated for the current route set — the only real target is JWT re-verification, not handler-level caching.

---

### Evidence Strength — 0.60

**Finding 1 — Package maturity (STRONG):** `lru-cache` is one of the most downloaded packages on npm, used in webpack and the npm CLI. Production-grade, actively maintained. No doubt here.

**Finding 2 — JWT re-verification benefit (CONFIRMED, DIRECTLY APPLICABLE):** `src/middleware/authenticate.js` calls `verify(token)` on every authenticated request via `jwt.verify()` with HMAC-SHA256 (`algorithms: ['HS256']`). This is a synchronous crypto operation. An LRU cache keyed by token string returning the decoded payload would genuinely eliminate repeated crypto work for identical tokens within the TTL window. The benefit is real and the codebase confirms it.

**Finding 3 — User lookup caching benefit (REFUTED):** `src/auth/userStore.js` implements `findByEmail` as a single `Map.get()` on a native JavaScript `Map`. This is O(1) with negligible wall-clock cost. An LRU cache in front of this adds only indirection and a second key lookup with zero net benefit. This claimed benefit does not apply to the current implementation.

**Finding 4 — No frequency or load data:** There is no load testing, request profiling, or traffic data available to validate that `authenticate` is called at a rate where crypto re-verification cost is measurable. The benefit is architecturally plausible but empirically unconfirmed.

**Aggregate:** One confirmed benefit (JWT re-verification), one refuted benefit (Map lookup), strong package confidence, no empirical load data. Net evidence is moderate.

---

### Risk Severity — 0.55 (contributing (1-0.55)×0.2 = 0.09)

**Risk: Cache key design for authenticated endpoints.**

This is the most severe risk in the hypothesis. The hypothesis itself flags that "keys must incorporate the JWT subject or risk serving one user's data to another." This is a security-critical implementation requirement, not merely a performance concern. If a cache keyed only by resource path (without JWT subject) serves `/me` responses, user A could receive user B's data. Given that `/me` is an authenticated endpoint, an incorrect key design produces an authorization bypass. This risk is accurately disclosed but is high-severity if materialized.

**Risk: Stale data on mutation (TTL staleness).**

Moderate severity. Current routes are read-only (no mutation behind GET handlers), but TTL-misconfiguration risk grows as routes are added. Manageable with discipline.

**Risk: Cache loss on restart.**

Low effective severity. The entire in-memory architecture (user store, rate limits) is already lost on restart. This is a pre-accepted property of the architecture, not a new risk.

**Risk: Multi-instance cache miss rates.**

Low effective severity. Single-process architecture is a deliberate constraint. This risk is theoretical and pre-accepted.

**Aggregate:** Risk severity is moderate-to-high primarily because of the auth-keying security requirement. The implementation gap between "add LRU cache" and "add LRU cache safely for authenticated endpoints" is non-trivial and easy to get wrong.

---

### Reversibility — 0.90

The change is purely additive: a single npm dependency, applied per-route, with no schema migrations, no infrastructure changes, and no protocol changes. Removal requires deleting the cache wrapper and reverting to direct handler calls. No downstream coupling. Reversibility is very high. Minor deduction for the fact that cache key logic may be embedded across multiple route files once adopted, creating a small removal surface.

---

## Weakest Link

The weakest link is the assumption that current route handlers produce responses worth caching — the only confirmed non-trivial hot path is JWT re-verification in middleware, while all actual route handlers return trivially cheap responses, meaning the practical performance benefit is narrower than the hypothesis implies, and the implementation risk (auth-keyed cache keys) is non-trivial relative to that benefit.

---

## Verdict

The hypothesis is architecturally sound and technically feasible. The `lru-cache` package is production-grade and the single-process fit is strong. However, the performance benefit in the current codebase is narrower than stated (JWT re-verification only; user-lookup benefit is refuted), and the security requirement around cache key design for authenticated endpoints elevates implementation risk. The hypothesis is net-valid but should be scoped precisely to JWT token-level caching in the `authenticate` middleware rather than broader response caching, which has no confirmed performance target at current route complexity.

**Recommended action:** Proceed with caution — implement as JWT verification cache in `authenticate.js` only, with explicit key design review before touching any response-level caching on authenticated routes.
