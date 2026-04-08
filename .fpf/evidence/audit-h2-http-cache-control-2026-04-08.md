---
audit_id: audit-h2-http-cache-control-2026-04-08
hypothesis_id: h2-http-cache-control
audit_date: 2026-04-08
auditor: claude-sonnet-4-6
R_eff: 0.78
verdict: PASS
---

# FPF Trust Audit — h2-http-cache-control

## Hypothesis Summary

Emit standard HTTP caching headers (`Cache-Control`, `ETag`, `Last-Modified`) on appropriate REST endpoints. No new dependencies or infrastructure required. Uses Express middleware or per-route logic. Authenticated endpoints use `Cache-Control: private`; public endpoints may use `Cache-Control: public` for CDN eligibility.

---

## Scoring

| Dimension | Raw Score | Weight | Weighted |
|---|---|---|---|
| Assumption validity | 0.80 | 0.30 | 0.240 |
| Evidence strength | 0.88 | 0.30 | 0.264 |
| Risk severity (inverted) | 0.45 (1 - 0.55) | 0.20 | 0.090 |
| Reversibility | 0.95 | 0.20 | 0.190 |
| **R_eff** | | | **0.784** |

---

## Dimension Analysis

### Assumption Validity — 0.80

The four stated assumptions were evaluated against the confirmed RCX codebase (Node.js/Express, JWT-based stateless auth in `src/auth/tokens.js` and `src/middleware/authenticate.js`, in-memory store in `src/auth/userStore.js`):

1. **API consumers respect `Cache-Control` directives** — Unverified for this specific deployment context. Standard behaviour for all major HTTP clients and proxies, but no empirical data from RCX's actual clients. Slight confidence reduction.
2. **Some endpoints return stable-enough data** — Confirmed. `GET /me` returning `{ id, email }` is stable within a session and is a strong caching candidate.
3. **JWT endpoints can safely use `Cache-Control: private`** — Confirmed. Stateless JWT auth aligns naturally with the `private` directive; no session affinity or shared-cache ambiguity.
4. **ETags can be derived cheaply** — Confirmed in principle. Body hash is computationally negligible for these small response payloads. Risk around in-memory stability under restarts is correctly flagged in the hypothesis.

Minor deduction: the `GET /public` route using `optionalAuth` introduces a conditional caching requirement (header must vary based on `req.user` presence) that slightly complicates the assumed clean public/private segmentation.

### Evidence Strength — 0.88

Matches the hypothesis file's own trust_score. Evidence is well-grounded:

- RFC 7234 formally defines `private` and `public` directive semantics — primary normative source.
- Major API providers (GitHub REST API, Stripe) emit `Cache-Control: private` on user-scoped reads — real-world confirmation.
- CDN vendor documentation (CloudFront, Fastly, Varnish) confirms that `Authorization` header presence bypasses shared caching by default — accurate and well-documented.
- The 304 conditional-request limitation (server still processes all requests without server-side `If-None-Match` handling) is accurately described and not a disputed claim.

Small deduction: no measured client compliance data from RCX's actual deployment environment; consensus evidence is general-purpose, not deployment-specific.

### Risk Severity — 0.55 (moderate)

Risks are real but bounded:

- **Security risk (highest severity):** Misconfigured `Cache-Control: public` on an authenticated route could cause a shared CDN or proxy to serve one user's response to another. This is a genuine data-leak vector. Mitigated by the hypothesis's recommendation to default to `private` and only opt into `public` deliberately.
- **ETag instability on restart:** Medium severity for correctness, low severity for security. A stale ETag after restart causes unnecessary 304 misses or stale responses, not data leakage. A discipline issue, not a structural failure.
- **No server-side load relief without 304 handling:** Low severity — this is an expected limitation explicitly documented, not a defect.
- **Non-cooperating clients:** Low severity — header emission is still correct and harmless when ignored.

Overall severity is moderate, driven primarily by the `public` header misconfiguration risk on the `GET /public` optionalAuth route.

### Reversibility — 0.95

HTTP headers are among the most reversible changes possible:

- No new packages, no schema migrations, no infrastructure changes.
- Adding or removing a `res.set('Cache-Control', ...)` call is a single-line change per route.
- No persistent state is introduced by the headers themselves.
- Rolling back is safe and immediate with a redeployment.

Minor deduction for the possibility that downstream clients or CDN configs become dependent on specific header values over time, but this is a long-term concern with negligible relevance at current project stage.

---

## Weakest Link

The weakest link is **unverified client compliance with `Cache-Control` directives in RCX's specific deployment context** — the hypothesis's core benefit (reduced redundant requests) depends entirely on clients or intermediaries honouring the headers, and no empirical evidence exists that they do in this deployment.

---

## Overall Verdict

**PASS at R_eff = 0.78**

The hypothesis is well-grounded in established HTTP standards, maps cleanly onto RCX's actual route structure, and correctly identifies both its benefits and key risk boundaries. The one security-critical risk (public header misconfiguration on authenticated routes) is explicitly flagged and the recommended mitigation (`private` as default) is sound. The implementation remains low-cost and fully reversible. Recommended to proceed with implementation, with particular care applied to the `GET /public` optionalAuth conditional header logic.

---

## Implementation Priority Notes

- `GET /me`: Highest priority. `Cache-Control: private, max-age=60` + ETag from body hash.
- `GET /public`: Medium priority. Requires conditional logic: `private` when `req.user` is set, `public` (or no caching) when anonymous.
- `GET /admin`: Low priority. `Cache-Control: private, max-age=30`.
- POST `/auth/*` routes: Excluded. Mutations must not be cached.
