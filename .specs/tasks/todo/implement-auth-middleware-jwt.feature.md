---
title: Implement Authentication Middleware with JWT Support
---

## Initial User Prompt

Design and implement authentication middleware with JWT support

---

## Description

Authentication middleware for RCX provides a consistent, secure mechanism for verifying caller identity on every protected route. The middleware extracts a JWT from the `Authorization: Bearer` header, verifies the signature using an explicit HS256 algorithm constraint, validates the payload shape, and attaches a typed `req.user` object for downstream handlers. This replaces the current ad-hoc pattern where individual route handlers make assumptions about payload structure (e.g., `req.user.sub`, `req.user.email`), removing a class of silent runtime failures when token shape evolves.

Beyond basic verification, this work hardens the authentication surface against known attack vectors. Explicit algorithm pinning in `tokens.js` closes the algorithm confusion vulnerability present in the current `jsonwebtoken` usage. Standardized error codes (`expired_token`, `invalid_token`, `missing_token`) replace generic 401 responses, enabling clients and monitoring systems to distinguish failure modes programmatically. A rate limiter on `/auth/login` using `express-rate-limit` v7 prevents credential brute-force without requiring application-layer session state.

The middleware also introduces two new behavioral modes: a role-based guard that compares a required role against `req.user.roles` and returns 403 when the claim is absent or insufficient, and an optional-authentication mode that allows unauthenticated requests to reach public routes while still populating `req.user` when a valid token is present. Both modes are implemented as composable middleware factories rather than route-level conditionals.

---

## Acceptance Criteria

1. Given a request with a valid, unexpired Bearer token, when the middleware runs, then the handler receives `req.user` with verified `sub`, `email`, and `roles` fields and the response is 200.

2. Given a request with an expired token, when the middleware runs, then the response is 401 with JSON body `{ "error": "expired_token" }`.

3. Given a request with a missing `Authorization` header or a header not matching `Bearer <token>`, when the middleware runs, then the response is 401 with JSON body `{ "error": "missing_token" }`.

4. Given a request with a well-formed header but a malformed or unparseable token string, when the middleware runs, then the response is 401 with JSON body `{ "error": "invalid_token" }`.

5. Given a token signed with a different algorithm (e.g., RS256 or `alg: none`), when `tokens.verify()` is called, then verification is rejected with `invalid_token` and no payload is returned.

6. Given a token with a valid format but an incorrect signature, when the middleware runs, then the response is 401 with JSON body `{ "error": "invalid_token" }`.

7. Given the `/auth/login` endpoint receives 5 requests within 15 minutes from the same IP, when a 6th request arrives within that window, then the response is 429 with a `Retry-After` header.

8. Given a route guarded with `requireRole("admin")` and a token where `roles` does not include `"admin"`, when the middleware runs, then the response is 403 with JSON body `{ "error": "forbidden" }`.

9. Given a route using optional-authentication mode and a request with no token, when the middleware runs, then `req.user` is `null` and the handler proceeds normally with 200.

10. Given a route using optional-authentication mode and a request with a valid token, when the middleware runs, then `req.user` is populated and the handler proceeds with 200.

---

## Out of Scope

- Refresh token issuance, rotation, or storage
- Token revocation / blocklist (database or Redis)
- Issuer (`iss`) and audience (`aud`) claim validation
- OAuth2 / third-party identity provider integration
- Multi-factor authentication
- API key authentication

---

## Architecture Overview

### Component Map

```
src/
  auth/
    tokens.js          (MODIFY) — add algorithms:["HS256"] to verify()
    router.js          (MODIFY) — add roles to sign(); rate limiter on POST /login
    userStore.js       (NO CHANGE)
  middleware/
    authenticate.js    (MODIFY) — typed error codes, payload validation, classifyJwtError
    requireRole.js     (NEW)    — role-check middleware factory
    optionalAuth.js    (NEW)    — optional-auth wrapper
  app.js               (NO CHANGE)

tests/
  auth.test.js         (MODIFY) — add expired, algorithm, rate-limit, requireRole, optionalAuth cases
```

### Token Payload Schema

JWT claims: `{ sub: string, email: string, roles: string[], iat: number, exp: number }`

`req.user` contract (after middleware): `{ sub: string, email: string, roles: string[] }`
Unknown fields are dropped at the middleware boundary.

### Error Response Schema

| Condition | HTTP | `error` field |
|---|---|---|
| No Authorization header / not Bearer | 401 | `missing_token` |
| JWT structurally malformed | 401 | `invalid_token` |
| Bad signature or wrong algorithm | 401 | `invalid_token` |
| Token expired | 401 | `expired_token` |
| Payload shape invalid | 401 | `invalid_token` |
| Role not present in `req.user.roles` | 403 | `forbidden` |
| Rate limit exceeded on /login | 429 | `too_many_requests` + `Retry-After` header |

### Middleware Composition

```js
// Protected with role:
router.get("/admin", authenticate, requireRole("admin"), handler)

// Optional auth:
router.get("/public", optionalAuth, handler)
```

### Key Design Decisions

1. **`classifyJwtError(err)` helper in `authenticate.js`** — centralizes TokenExpiredError → `expired_token`, all others → `invalid_token` mapping. Easy to extend; independently testable.
2. **Separate files for `requireRole` and `optionalAuth`** — each independently unit-testable; no flags/branches inside `authenticate.js`.
3. **Drop unknown payload fields** — destructure only `{ sub, email, roles }` into `req.user`. Prevents leakage of internal claims.
4. **Rate limiter inside `router.js`, not `app.js`** — co-located with the route it protects; each route can have independent limits.
5. **`/me` endpoint unchanged** — new `authenticate.js` guarantees the same `req.user.sub` and `req.user.email` shape, so no route-level changes needed.

---

## Implementation Process

### Batch A (parallel — no dependencies)

**Step 1 — Pin HS256 algorithm in `tokens.js`** `[S]`
Files: `src/auth/tokens.js`
Add `algorithms: ["HS256"]` to the options object passed to `jwt.verify()`. No behavioral change for well-formed tokens; closes algorithm confusion attack vector.

**Step 2 — Add `roles` to token payloads in `router.js`** `[S]`
Files: `src/auth/router.js`
Add `roles: ["user"]` to both the `/register` and `/login` `sign()` calls so issued tokens carry the required `{ sub, email, roles }` shape.

**Step 6 — Install and configure `express-rate-limit`** `[M]`
Files: `src/auth/router.js`
`npm install express-rate-limit`. Create limiter with `windowMs: 15 * 60 * 1000`, `max: 5`, handler returning `{ error: "too_many_requests" }` 429. Apply only to `POST /login`. Note: Steps 2 and 6 both touch `router.js` — if done in parallel, coordinate to avoid conflicts.

### Batch B (after Batch A)

**Step 3 — Harden `authenticate.js`** `[M]`
Files: `src/middleware/authenticate.js`
Add `classifyJwtError(err)` helper. Destructure `{ sub, email, roles }` from decoded payload; set `roles` to `[]` if absent. Return typed error codes: `missing_token` (401) on missing header, `expired_token` / `invalid_token` (401) on verification failure.

### Batch C (parallel — after Step 3)

**Step 4 — Create `requireRole.js`** `[S]`
Files: `src/middleware/requireRole.js` (new)
Middleware factory `requireRole(...allowed)` that checks `req.user?.roles` for overlap with `allowed`. Returns 403 `{ error: "forbidden" }` on mismatch or missing `req.user`.

**Step 5 — Create `optionalAuth.js`** `[S]`
Files: `src/middleware/optionalAuth.js` (new)
Same extraction/verify logic as `authenticate`, but on absent/missing Authorization header sets `req.user = null` and calls `next()`. On invalid token: still returns 401. Reuses `classifyJwtError` from `authenticate.js`.

**Step 7 — Verify `/me` endpoint** `[S]`
Files: `src/app.js`
Confirm `req.user.sub` and `req.user.email` still map correctly after Step 3. No code change expected; verify during testing.

### Batch D (after all prior steps)

**Step 8 — Extend test suite** `[L]`
Files: `tests/auth.test.js`
Add tests for:
- Expired token → `expired_token` (use `jwt.sign(..., { expiresIn: -1 })`)
- Algorithm confusion token → `invalid_token`
- Bad-signature token → `invalid_token`
- `requireRole`: match (200), missing role (403), no token (401/403)
- `optionalAuth`: no token (null + 200), valid token (populated + 200), invalid token (401)
- Rate limit: 6 sequential POST /auth/login → 6th returns 429 + `Retry-After` header

Rate-limiter tests must isolate IP counting (use dedicated describe block or reset store between runs).

---

## Parallelization Summary

| Batch | Steps | Bound by |
|---|---|---|
| A | 1, 2, 6 | M (Step 6) |
| B | 3 | M |
| C | 4, 5, 7 | S |
| D | 8 | L |

Critical path: Step 1 → Step 3 → Step 4 → Step 8 (4 cycles vs 8 sequential)

---

## Verification Rubric (LLM-as-Judge)

### Automatic Disqualifiers (score = 0)

- `algorithms` option omitted from any `jwt.verify()` call
- Existing passing tests broken
- `req.user` populated from unverified payload
- Secrets or keys hardcoded without env var indirection

### Scoring

| Category | Weight | Max pts |
|---|---|---|
| Security correctness | 30% | 3.0 |
| Functional correctness | 30% | 3.0 |
| Code quality | 20% | 2.0 |
| Test completeness | 20% | 2.0 |

**Security (3.0 pts)**
- `algorithms: ["HS256"]` in every `jwt.verify()` call — 1.0
- Wrong-algorithm token rejected with `invalid_token` — 0.5
- Bad-signature token rejected with `invalid_token` — 0.5
- Rate limiter: 429 + `Retry-After` on 6th request — 0.5
- Error responses contain only defined error codes, no internal detail — 0.5

**Functional correctness (3.0 pts)** — 0.3 pts per AC
Each of the 10 acceptance criteria is pass/fail.

**Code quality (2.0 pts)**
- Three middlewares are separate, composable units — 0.5
- `/me` reads only `req.user` (no re-verification) — 0.5
- No duplicated `jwt.verify` logic — 0.5
- Error shape centralized (single helper or enum) — 0.5

**Test completeness (2.0 pts)**
- All three error codes tested with distinct assertions — 0.5
- `requireRole`: match / missing / no-token all covered — 0.5
- `optionalAuth`: absent / valid / invalid all covered — 0.5
- Rate-limiter test sends 6 requests, asserts 429 + `Retry-After` — 0.5

**Formula:**
```
raw = (sec/3.0)*0.30 + (func/3.0)*0.30 + (qual/2.0)*0.20 + (test/2.0)*0.20
total_score = raw * 5.0   # range [0.0, 5.0]
```

---

## Definition of Done

- [ ] `algorithms: ["HS256"]` in all `jwt.verify()` calls
- [ ] `req.user` shape is `{ sub, email, roles }` — unknown fields dropped
- [ ] `expired_token`, `invalid_token`, `missing_token` error codes in unit tests with distinct assertions
- [ ] `requireRole` middleware unit tested: match (200), missing role (403), no token (401/403)
- [ ] `optionalAuth` middleware unit tested: absent token (null + 200), valid token (populated + 200), invalid token (401)
- [ ] Rate limiter on `/auth/login`: 429 + `Retry-After` verified by integration test
- [ ] `/me` endpoint reads only validated `req.user` shape
- [ ] No existing passing tests broken
