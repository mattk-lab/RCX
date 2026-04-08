---
id: h4-redis-cache
title: External Redis Cache
kind: technology
scope: broad
status: L0
---

## Summary
Introduce Redis as a dedicated caching layer external to the Node.js process. Route handlers check Redis for a cached response before executing business logic; on a miss, they compute the result, write it to Redis with a TTL, and return it. The `ioredis` or `redis` npm client connects the Express app to a Redis instance (local Docker container in development, managed service in production). Cache keys encode the resource type, identifier, and any relevant query parameters.

## Rationale
Redis is the de-facto standard caching layer for Node.js REST APIs at production scale. It provides a shared, persistent (across restarts) cache visible to all Node.js process instances, making it horizontally scalable from day one. Redis also subsumes other future needs: session storage, pub/sub, distributed rate limiting (replacing the in-memory `express-rate-limit` store), and job queuing. If the project is heading toward real infrastructure, adopting Redis early avoids a later migration.

## Assumptions
- The project will eventually run with more than one Node.js instance or will need cache persistence across restarts.
- A Redis instance can be provisioned without violating the "no external infra committed yet" constraint, or that constraint is being relaxed.
- The team has operational capacity to manage a Redis instance (monitoring, memory limits, eviction policy).
- Network RTT to the Redis instance (even localhost) is acceptable relative to the latency savings gained from avoiding handler execution.

## Risks
- Directly contradicts the stated constraint of "no external infra committed yet" — adds a new required service to the deployment topology immediately.
- Adds operational complexity: Redis must be running for the API to function (or cache fallback logic must be written), increasing the surface area for outages.
- Over-engineered for the current scale: with an in-memory user store and no DB, the bottleneck is almost certainly not data retrieval, making Redis a solution to a non-existent problem.
- Introduces a new category of failure: network partitions between Express and Redis, Redis OOM evictions, and serialization bugs in cache keys.

## Logic Verification

**Verdict: FAIL**

The hypothesis directly contradicts the stated project constraint of "no external infra committed yet" — a point the hypothesis itself acknowledges in both its assumptions and risks sections. The current codebase (Node.js/Express, JWT auth, in-memory user store, no database) has no data retrieval bottleneck that caching would address, making Redis a solution to a non-existent problem at this stage. Adoption would add a required external service dependency, increasing deployment complexity and failure surface without providing measurable benefit given the current architecture.
