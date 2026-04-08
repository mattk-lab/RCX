# DRR: Caching Strategy
Date: 2026-04-08
Problem: What caching strategy should we use?

## Comparison Table
| Hypothesis | R_eff | Weakest Link | Status |
|------------|-------|--------------|--------|
| h1: No Caching — Deliberate Deferral | 0.89 | No proactive safety net if traffic grows unexpectedly; remediation is reactive after degradation is observable | RECOMMENDED |
| h2: HTTP Cache-Control Headers | 0.78 | Unverified client compliance with `Cache-Control` directives in RCX's specific deployment context; core benefit depends entirely on clients/intermediaries honouring headers | VIABLE (deferred) |
| h3: In-Process LRU Cache (lru-cache) | 0.62 | Current route handlers produce trivially cheap responses; the only confirmed non-trivial hot path is JWT re-verification, making practical benefit narrower than stated while implementation risk (auth-keyed cache keys) is non-trivial | NOT RECOMMENDED NOW |

## Recommended Decision
No Caching — Deliberate Deferral (h1)

## Rationale
The RCX codebase provides no performance problem for caching to solve. The user store is a plain in-memory `Map` with O(1) lookups, all five routes are either synchronous or bcrypt-bound, and there is no external I/O anywhere in the dependency tree. The dominant per-request cost is `bcrypt` at `BCRYPT_ROUNDS=12` (~250ms) — a cost that caching cannot reduce because it applies only to mutation endpoints (`/register`, `/login`) where caching is inappropriate regardless. Adding any cache layer now would be optimizing a non-bottleneck, introducing complexity and maintenance burden for zero measurable gain.

The deliberate-deferral stance is the highest-R_eff option (0.89) precisely because it matches the actual cost profile of the application. H2 (HTTP Cache-Control headers, R_eff 0.78) is technically sound and zero-dependency, but its benefit relies on unverified client compliance and provides no server-side load relief without additional 304 conditional-request handling. H3 (in-process LRU, R_eff 0.62) has a confirmed narrow benefit (JWT re-verification only), but the security requirement around auth-keyed cache keys elevates implementation risk disproportionate to a gain that has no empirical load data to support it at current traffic levels.

Crucially, deferral imposes no lock-in. Route handlers are simple functions with no caching abstractions in their interfaces. When a real bottleneck is measured — whether it is JWT re-verification frequency, a future database query, or an aggregation endpoint — either H2 or a scoped H3 (JWT middleware only) can be added with purely additive changes and no refactoring of existing code. The cost of deferral is the reactive-remediation risk acknowledged in the hypothesis; that cost is acceptable at this stage given the fully reversible path to either alternative.

## Trade-offs Accepted
- No proactive caching buffer if traffic grows faster than anticipated; the team must instrument and react under pressure rather than having a safety net already in place.
- Individual developers may introduce ad-hoc memoization point solutions over time if caching is never formally addressed, risking an inconsistent and unreviewed approach.
- Stakeholders expecting a "production-ready" API may perceive the absence of a formal caching strategy as an architectural gap, even though the current performance profile does not warrant one.
- HTTP `Cache-Control` headers (H2), while zero-cost to add, are deliberately deferred — this means any reverse proxy or CDN placed in front of the API will not benefit from caching hints until headers are added.

## When to Revisit
- A profiling or load-testing session identifies a measurable hot path — specifically, `jwt.verify()` call frequency approaches CPU saturation, or a new endpoint introduces external I/O or aggregation.
- A reverse proxy, CDN, or API gateway is introduced in front of the service, at which point H2 (HTTP Cache-Control headers) becomes immediately low-cost and high-value.
- The application is horizontally scaled (multiple Node.js instances behind a load balancer), which would require evaluating shared-cache infrastructure (Redis) rather than in-process LRU.
- Any mutable resource endpoint is added behind a GET route (e.g., a user profile update), requiring a formal cache invalidation strategy before TTL-only caching is safe.
- Traffic metrics from production show response time SLOs being breached, triggering a structured caching design exercise rather than speculative addition.
