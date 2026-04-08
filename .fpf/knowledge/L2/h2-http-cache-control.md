---
id: h2-http-cache-control
title: HTTP Cache-Control Headers
kind: pattern
scope: narrow
status: L1
---

## Summary
Leverage standard HTTP caching semantics by setting `Cache-Control`, `ETag`, and/or `Last-Modified` response headers on appropriate endpoints. No new infrastructure or dependencies are required — Express middleware or per-route logic emits the correct headers and the client (or any intermediary proxy) manages cache storage. For authenticated endpoints, `Cache-Control: private, max-age=<n>` scopes caching to the individual caller; for truly public read-only endpoints, `Cache-Control: public` allows CDN or proxy caching.

## Rationale
HTTP caching is the simplest possible caching layer: zero new packages, no in-process memory overhead, and behavior is standardized across every HTTP client and intermediary. Since the API is pure REST and already uses JWTs for stateless auth, conditional requests (`If-None-Match`, `If-Modified-Since`) fit naturally. It costs nothing to add headers now and provides immediate benefit if a reverse proxy or CDN is placed in front of the API later.

## Assumptions
- API consumers (clients or a gateway) respect `Cache-Control` directives.
- At least some endpoints return data that is stable enough over a short TTL to be worth caching (e.g., user profile reads).
- JWT-authenticated endpoints can safely use `Cache-Control: private` to prevent shared-cache poisoning.
- ETags can be derived cheaply (e.g., hash of the serialized response body) without materially increasing response time.

## Risks
- `Cache-Control` headers only instruct the client or proxy — the server still processes every request unless a conditional-request shortcut (304) is implemented server-side.
- Mis-configured `public` cache headers on authenticated routes can leak user data through a shared proxy or CDN.
- Without a real DB or persistent store, generating stable ETags from an in-memory object requires discipline to avoid serving stale ETags after a server restart.
- Provides no relief for server-side CPU or I/O load if clients do not cooperate with caching semantics.

## Logic Verification
**Verdict: PASS**

- Internal consistency holds: the assumptions directly support the rationale. JWT-based stateless auth naturally accommodates `Cache-Control: private` scoping; the zero-dependency claim is accurate since header emission requires no new packages in Express.
- No contradiction with project constraints: the codebase is Node.js/Express with JWT auth (`src/auth/tokens.js`, `src/middleware/authenticate.js`) and an in-memory store (`src/auth/userStore.js`). Adding response headers requires no external infrastructure.
- Feasibility confirmed: existing endpoints (`GET /me`, `GET /public`) are straightforward targets. The noted risk around in-memory ETag stability under restarts is correctly flagged and consistent with the known in-memory store constraint — it does not invalidate the hypothesis, it scopes it appropriately.

## Evidence Validation
**Verdict: PASS**
**trust_score: 0.88**

### Industry Practice
`Cache-Control: private, max-age=<n>` for JWT-authenticated REST endpoints is well-established engineering consensus. RFC 7234 defines the `private` directive precisely for this use case. Major API providers (GitHub REST API, Stripe) emit `Cache-Control: private` on user-scoped reads. The claim that CDNs (CloudFront, Fastly, Varnish) skip shared caching when an `Authorization` header is present is accurate — this is default behavior documented by all major CDN vendors and is why `Cache-Control: public` is required to override it.

### Cited Benefits and Risks — Consensus Check
- **ETag stability risk with in-memory store**: Confirmed valid. ETags derived from in-memory objects are invalidated on process restart; this is a known operational concern for stateless Node.js services and is correctly scoped as a discipline issue rather than a blocker.
- **Per-user cache fragmentation (`Cache-Control: private`)**: Accurate. Each authenticated caller gets an independent cache entry keyed by their client state. This is the correct tradeoff for user-specific data and is widely documented in HTTP caching literature.
- **Auth-header bypassing CDN shared caching**: Accurate. The `Authorization` request header causes standard CDN behavior to skip caching unless the origin explicitly sends `Cache-Control: public, s-maxage=<n>`. The hypothesis correctly distinguishes `private` (user-scoped) vs `public` (CDN-eligible) routing.
- **Server still processes every request without 304 short-circuit**: Accurate. Headers alone do not reduce server load; conditional request handling (`If-None-Match` → `304 Not Modified`) must be implemented server-side for that benefit.

### RCX Route Analysis (`src/app.js`)
- `GET /me` — requires `authenticate` middleware, returns `{ id, email }`. User profile data is stable across requests within a session. Best candidate for `Cache-Control: private, max-age=60` with ETag derived from the response body hash.
- `GET /admin` — requires `authenticate` + `requireRole('admin')`. Low-frequency admin read; `Cache-Control: private, max-age=30` appropriate; low priority.
- `GET /public` — uses `optionalAuth`; response varies depending on whether a JWT is present. Applying `Cache-Control: public` is only safe when `req.user` is null/undefined. With auth present, `private` is required. This route needs conditional header logic — the hypothesis's assumption of clean public vs. private segmentation is slightly complicated here, but not invalidated.
- `/auth` routes (POST) — mutations; no caching applicable. Correctly excluded by the hypothesis's implicit scope of GET read-only endpoints.

### Overall Assessment
The hypothesis is grounded in established HTTP standards and engineering practice, maps cleanly onto RCX's actual route structure, and correctly identifies both the benefits and the key risk boundary (in-memory ETag instability). The `GET /public` route introduces minor complexity not explicitly addressed in the hypothesis, which slightly reduces confidence but does not undermine the core claim. Trust score reflects high confidence with a small deduction for the optionalAuth edge case and the absence of measured client compliance data in this specific deployment context.
