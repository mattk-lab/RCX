# FPF Context

## Problem Statement
What caching strategy should we use?

## Project Summary
**RCX** is a Node.js/Express REST API providing user authentication (JWT, bcrypt, HS256-pinned). Current stack: Express 5, jsonwebtoken, bcryptjs, express-rate-limit. No persistence layer yet (in-memory userStore). No caching layer exists today.

## Constraints
- Node.js / Express runtime
- Stateless JWT auth (no sessions)
- In-memory data store for now (production may evolve to a real DB)
- No external infrastructure dependencies committed to yet
- No client-side rendering context (pure REST API)
- Rate limiting already in place via express-rate-limit (memory store)

## What "caching" could mean here
1. HTTP response caching (ETags, Cache-Control headers)
2. In-process memory caching of computed results (user lookups, decoded tokens)
3. External cache store (Redis, Memcached) for shared state across instances
4. JWT denylist/blocklist caching (token revocation — currently out of scope per spec)

## Date
2026-04-08
