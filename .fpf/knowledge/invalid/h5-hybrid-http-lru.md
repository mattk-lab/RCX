---
id: h5-hybrid-http-lru
title: Hybrid HTTP Cache-Control + In-Process LRU
kind: hybrid
scope: moderate
status: L0
---

## Summary
Combine HTTP `Cache-Control` headers (h2) with an in-process LRU cache (h3) in a layered strategy. The LRU cache absorbs repeated identical requests within the server process, reducing handler execution cost. The `Cache-Control` headers simultaneously instruct cooperating clients and proxies to avoid sending duplicate requests in the first place. Together they form two independent cache layers: one server-side and one client/proxy-side, with no external infrastructure required.

## Rationale
Neither HTTP headers alone nor an in-process LRU alone is fully satisfying: headers only help if the client cooperates, and an in-process LRU only helps if requests actually reach the server. The hybrid approach hedges both bets with a single npm dependency and no new infrastructure. It is the most coverage available within the "no external infra" constraint and aligns with standard REST API best practices. The two layers are also independently tunable — LRU TTL can be shorter (hot-path deduplication) while `Cache-Control: max-age` can be longer (client-side freshness).

## Assumptions
- There are at least some read-heavy endpoints where both server-side deduplication and client-side freshness matter.
- The added code complexity of managing two cache layers is acceptable given the team's familiarity with both mechanisms.
- Cache key design for the LRU tier correctly accounts for authenticated vs. public routes to prevent data leakage.
- The LRU cache size is bounded conservatively enough that it does not materially affect Node.js GC behavior.

## Risks
- Two cache layers double the surface area for cache-coherence bugs: a mutation may invalidate the LRU entry but the client's `Cache-Control` TTL keeps serving stale data, or vice versa.
- Debugging cache behavior is more complex — a "stale data" report requires determining which layer served the stale response.
- May be premature complexity for a project with an in-memory store and no identified performance bottleneck; the marginal benefit over either single-layer approach is unproven.
- Cache invalidation on write operations must be applied consistently to both layers, increasing the maintenance burden as new routes are added.

## Logic Verification

**Verdict: PASS**

- Internal consistency: The rationale correctly identifies the complementary gap each layer fills (client cooperation vs. server-side deduplication), and the assumptions directly address the known risk areas (auth-aware cache keys, bounded LRU size). No circular or contradictory reasoning detected.
- Project constraints: Explicitly requires no external infrastructure; a single LRU npm package fits within the Node.js/Express stack. The JWT auth concern is anticipated in the assumptions. No contradiction with in-memory store or no-external-infra constraints.
- Feasibility: Standard `lru-cache` package is well-supported in Node.js; `Cache-Control` headers are zero-dependency Express middleware. Implementation is straightforward given the existing Express route structure.

## Evidence Validation

**Verdict: FAIL**

**trust_score: 0.35**

### 1. Pattern recognition in Node.js/Express ecosystem
The hybrid HTTP `Cache-Control` + in-process LRU pattern is well-established and widely used in the Node.js/Express ecosystem. The `lru-cache` npm package is one of the most downloaded packages in the ecosystem, and pairing it with `Cache-Control` headers is a recognized REST API best practice. On this criterion the hypothesis is sound.

### 2. Complexity vs. benefit at RCX's current scale
Examining `src/app.js`, RCX currently exposes exactly three routes:
- `GET /me` — authenticated, returns the requesting user's own identity (per-user response; LRU deduplication yields near-zero benefit since each user's key is unique)
- `GET /admin` — role-gated authenticated route with a static message (trivially cheap; no data store call)
- `GET /public` — optionalAuth, returns the user object (no backing data store call visible)

There is no evidence of read-heavy shared-response endpoints, no external data store calls, and no identified performance bottleneck. The hypothesis itself concedes this risk: "May be premature complexity for a project with an in-memory store and no identified performance bottleneck." At this scale, the marginal benefit of the hybrid over either single-layer approach (h2 or h3 alone) is not justified. The simpler strategies are sufficient until a concrete bottleneck or shared-cacheable workload emerges.

### 3. Risk mitigation adequacy
- **Auth-key leakage**: The assumption that "cache key design correctly accounts for authenticated vs. public routes" is stated but not resolved — it is deferred entirely to implementation. Given that two of three routes (`/me`, `/admin`) are authenticated and return per-user data, this is a real, non-trivial risk surface. No concrete key-scoping strategy or safeguard is proposed.
- **LRU bounding**: Acknowledged but not quantified. No size or TTL figures are given, making it impossible to reason about GC impact.
- Both mitigations are recognized but unresolved, raising the implementation risk beyond what is warranted for the current codebase size.

### Summary
The pattern is technically valid and ecosystem-supported, but the cost-benefit trade-off is negative at RCX's current scale and the auth-leakage risk lacks a concrete mitigation. The hypothesis should be revisited if RCX develops genuinely read-heavy, shared-response endpoints.
