---
id: h3-in-process-lru
title: In-Process LRU Cache (lru-cache)
kind: technology
scope: moderate
status: L1
---

## Summary
Introduce a lightweight in-process LRU (Least Recently Used) cache using the `lru-cache` npm package (or equivalent). A fixed-size cache keyed by request parameters (e.g., user ID, resource path) stores serialized response payloads in the Node.js heap. Cache entries are evicted by size or TTL. All caching is scoped to a single process instance with no shared state across restarts or horizontal scale-out nodes.

## Rationale
`lru-cache` is a single npm dependency with no external infrastructure. It is a well-understood pattern for REST APIs: expensive-to-compute or frequently-read responses are memoized in memory and served without re-executing handler logic. Given the project already uses an in-memory user store and `express-rate-limit` with a memory store, this is architecturally consistent — everything stays in-process. It is the smallest concrete caching step beyond "do nothing" and can be added incrementally per route.

## Assumptions
- Some route handlers produce responses that are computationally non-trivial or called at high frequency relative to how often the underlying data changes.
- The application runs as a single process (or cache-miss behavior on other processes is acceptable).
- The Node.js heap can absorb the additional memory footprint of cached payloads without triggering GC pressure.
- Cache invalidation can be handled by TTL expiry alone, without requiring event-driven invalidation.

## Risks
- In-process memory is not shared across multiple Node.js instances (e.g., behind a load balancer), producing inconsistent cache hit rates and potentially stale responses depending on which instance handles the request.
- Cache is lost on every process restart, which for this in-memory-only project happens on every deploy.
- TTL-based invalidation means stale data is served for up to the full TTL after a mutation — requires careful TTL tuning per resource type.
- Cache key design is non-trivial for authenticated endpoints: keys must incorporate the JWT subject or risk serving one user's data to another.

## Logic Verification

**Verdict: PASS**

- Assumptions are internally consistent with the rationale: single-process scope, memory-only architecture, and TTL-only invalidation are each individually justified and mutually coherent.
- No contradiction with known project constraints: aligns with Node.js/Express runtime, in-memory userStore pattern, memory-store rate limiter, stateless JWT auth, and the explicit constraint of no external infrastructure.
- Feasible against the current codebase: the app is a small Express API (`app.js`, `src/auth/`, `src/middleware/`) with no existing caching layer; `lru-cache` is a single npm dependency and can be introduced incrementally per route.
- Risks are accurately scoped and disclosed (multi-instance cache miss, process-restart loss, TTL staleness, JWT-keyed cache key requirement) — none constitute logic failures in the hypothesis itself.

## Evidence Validation

**Verdict: PASS**

trust_score: 0.65

### Finding 1 — lru-cache package maturity
`lru-cache` is among the most downloaded packages on npm (used by webpack, npm CLI, and other critical tooling). It is production-ready, actively maintained, and well-understood. This assumption in the hypothesis holds.

### Finding 2 — Token re-verification benefit (CONFIRMED)
`src/middleware/authenticate.js` calls `verify(token)` synchronously on every authenticated request. This is a real hot path performing a crypto operation (HMAC or RSA signature check) on every request. An LRU cache keyed by token string returning the decoded payload would genuinely avoid re-verification for repeated tokens within the TTL window. The benefit is real and directly applicable.

### Finding 3 — User lookup caching benefit (OVERSTATED)
`src/auth/userStore.js` stores users in a native `Map` keyed by email. `findByEmail` is a single `Map.get()` — an O(1) in-memory operation with negligible cost. Adding an LRU cache in front of this provides no measurable performance benefit and introduces indirection overhead. This claimed benefit does not apply to the current codebase.

### Finding 4 — Single-process limitation risk
The project already commits entirely to single-process, in-memory architecture: user data lives in a `Map`, rate limiting uses a memory store, and there is no external infrastructure. The LRU cache's single-process limitation is architecturally consistent with existing choices and does not introduce new risk at current scale. The risk is real in theory but pre-accepted by design.

### Summary
The hypothesis is net-valid: the JWT re-verification caching benefit is real and directly applicable, the package is production-grade, and the architectural fit is strong. The user-lookup caching claim is overstated (native Map is already O(1) in-process), which slightly reduces confidence. The single-process risk is accurately disclosed and already accepted throughout the architecture. Trust score reflects the genuine but partially overstated benefit claims.
