# Feature: Authentication Middleware with JWT Support

## Summary

Design and implement production-ready authentication middleware that verifies JWT tokens on protected routes, enforcing access control across the Express application.

---

## Background

The current implementation has a working `authenticate` middleware (`src/middleware/authenticate.js`) that verifies Bearer tokens. This spec defines the full requirements, edge cases, and acceptance criteria to harden it for production use.

---

## Acceptance Criteria

### Happy Path

```gherkin
Scenario: Authenticated request succeeds
  Given a valid JWT token in the Authorization header as "Bearer <token>"
  When the request reaches a protected route
  Then the middleware calls next()
  And req.user is populated with the decoded payload { sub, email, iat, exp }
```

### Missing or Malformed Header

```gherkin
Scenario: No Authorization header
  Given a request with no Authorization header
  When the request reaches a protected route
  Then the middleware responds 401
  And the body is { "error": "Missing or invalid Authorization header" }

Scenario: Authorization header present but not Bearer scheme
  Given an Authorization header like "Basic dXNlcjpwYXNz"
  When the request reaches a protected route
  Then the middleware responds 401
  And the body is { "error": "Missing or invalid Authorization header" }
```

### Invalid / Expired Token

```gherkin
Scenario: Token has an invalid signature
  Given a Bearer token with a tampered signature
  When the request reaches a protected route
  Then the middleware responds 401
  And the body is { "error": "Invalid or expired token" }

Scenario: Token is expired
  Given a Bearer token whose exp claim is in the past
  When the request reaches a protected route
  Then the middleware responds 401
  And the body is { "error": "Invalid or expired token" }
```

---

## Technical Design

### Current State

`src/middleware/authenticate.js` — single responsibility: extract Bearer token, call `jwt.verify`, attach `req.user`, or return 401.

### Required Changes / Hardening

| Area | Current | Required |
|------|---------|----------|
| Token extraction | Slice after "Bearer " | Same — no change needed |
| Error discrimination | Single catch block | Distinguish `TokenExpiredError` vs `JsonWebTokenError` if separate messages are desired (optional) |
| `req.user` shape | Raw decoded payload | Document the shape: `{ sub: number, email: string, iat: number, exp: number }` |
| Type safety | None (plain JS) | No change required (project is plain JS) |
| Algorithm enforcement | Default (HS256 implied) | Explicitly pass `{ algorithms: ['HS256'] }` to `jwt.verify` to prevent algorithm confusion attacks |

### Security Fix — Algorithm Pinning

```js
// src/utils/jwt.js
function verify(token) {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] });
}
```

This prevents algorithm-confusion attacks (e.g., `alg: none` or RS256 with a public key as the secret).

### Middleware Contract (unchanged interface)

```
Input:  req.headers.authorization = "Bearer <jwt>"
Output (success): req.user = { sub, email, iat, exp }, calls next()
Output (failure): res.status(401).json({ error: string })
```

---

## Test Cases to Add

- [ ] Expired token returns 401 (generate a token with `expiresIn: 0`)
- [ ] Tampered signature returns 401
- [ ] `alg: none` token is rejected
- [ ] `Bearer ` with empty string after returns 401
- [ ] `req.user` contains expected fields after success

---

## Out of Scope

- Role-based access control (RBAC) — separate feature
- Refresh token flow — separate feature
- Token revocation / blocklist — separate feature
- Rate limiting — separate concern

---

## Definition of Done

- [ ] Algorithm pinning added to `jwt.verify`
- [ ] All new test cases passing
- [ ] No existing tests broken
- [ ] Code committed on feature branch
