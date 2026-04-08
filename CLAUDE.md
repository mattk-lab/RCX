# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

**RCX** is a Node.js/Express REST API. Stack: Express 5, bcryptjs, jsonwebtoken, Jest + supertest.

```
src/
  app.js            # Express app (no listen — testable)
  server.js         # Entry point (calls listen)
  auth/
    router.js       # POST /auth/register, POST /auth/login
    tokens.js       # JWT sign/verify
    userStore.js    # In-memory user store (replace with DB)
  middleware/
    authenticate.js # Bearer-token guard
tests/
  auth.test.js
```

Run tests: `NODE_ENV=test npm test`
Start server: `npm start`

---

## Git Workflow

### Branch Naming
- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Documentation: `docs/<short-description>`
- Claude-initiated work: `claude/<short-description>`

### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:
```
<type>(<scope>): <short summary>

[optional body]
```
Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

Example:
```
feat(auth): add JWT token validation
fix(api): handle null response from upstream service
docs: update CLAUDE.md with project structure
```

### Branch Lifecycle
1. Branch from `main` (or the default branch)
2. Develop on the feature branch
3. Commit with descriptive messages
4. Push to origin: `git push -u origin <branch-name>`
5. Open a pull request targeting `main`

---

## Development Principles

### Code Quality
- Write the minimum code needed to solve the problem — no gold-plating
- Do not add features, abstractions, or utilities that are not immediately needed
- Do not add error handling for impossible scenarios
- Prefer editing existing files over creating new ones
- Delete unused code rather than commenting it out

### Security
- Never commit secrets, credentials, API keys, or tokens
- Validate all input at system boundaries (user input, external APIs)
- Do not introduce SQL injection, XSS, command injection, or other OWASP Top 10 vulnerabilities
- Use `.env` files for local secrets; never commit `.env` to version control

### Testing
- Write tests for new functionality and bug fixes
- Tests should live adjacent to or in a dedicated directory mirroring the source structure
- Prefer testing behavior over implementation details

---

## File Conventions

### Documentation
- `CLAUDE.md` — AI assistant guidance (this file)
- `README.md` — Human-facing project overview, setup, and usage
- Do not create additional markdown documentation files unless explicitly requested

### Environment
- `.env.example` — Template for required environment variables (committed)
- `.env` — Local secrets (never committed; add to `.gitignore`)

---

## Working with This Repository

### When Starting Development
1. Determine the technology stack and update this file accordingly
2. Initialize the project (`npm init`, `cargo init`, `go mod init`, etc.)
3. Add a `.gitignore` appropriate for the chosen stack
4. Create a `README.md` with setup instructions
5. Commit the initial scaffolding before adding features

### AI Assistant Guidelines
- Read this file at the start of each session
- Do not push to `main` directly — always use a feature branch
- Confirm with the user before creating pull requests
- Confirm before taking irreversible actions (deleting files, force-pushing, etc.)
- Keep changes focused and minimal — one concern per commit when practical
- After significant changes, update this CLAUDE.md if the project structure or conventions have changed

---

## Strategies and Hard Rules

### Authentication Security Checklist

When implementing or modifying auth endpoints:

- **Email enumeration**: Register must return `201` even for duplicate emails. Hash the password on both paths so timing is indistinguishable.
- **Password length cap**: bcrypt silently truncates at 72 bytes. Reject passwords >72 chars with a clear error rather than silently accepting a misleading credential.
- **Timing-safe unknown-user login**: Always call `bcrypt.hash` (not `compare`) on the dummy path when a user is not found, so response time matches a real user.
- **Email format validation**: Validate with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` at the boundary — reject before hashing.
- **Test-only helpers**: Guard test-only exports (e.g. `_clear()`) with `if (process.env.NODE_ENV !== 'test') throw`. Always set `NODE_ENV=test` when running tests.
- **Rate limiting**: Login and register endpoints must have rate limiting before going to production (e.g. `express-rate-limit`). Not included in MVP but must not ship without it.
- **JWT_SECRET**: Must be set at process start; `tokens.js` throws if missing. Never hard-code a fallback.

### Anti-Patterns to Avoid

- Returning `409 Conflict` on duplicate email registration — reveals valid email addresses.
- Returning different error messages or response times for wrong-password vs unknown-user — timing/content oracle.
- Calling `bcrypt.hash` with unbounded input — cap at 72 chars or the hash silently changes meaning.
- Exporting test helpers without an environment guard — allows accidental data loss in production.

### Verification Checklist (auth changes)

1. Does register return the same status for duplicate and new emails?
2. Does login hash even when the user is not found?
3. Are all inputs validated before hashing?
4. Is `_clear()` guarded by `NODE_ENV !== 'test'`?
5. Is `JWT_SECRET` required at boot (no silent fallback)?

---

## Updating This File

This file should be updated whenever:
- The technology stack is chosen and initialized
- New tooling, linters, or formatters are added
- Key architectural decisions are made
- Build, test, or deployment workflows are established
- Team conventions are agreed upon

The goal is to keep this file accurate so that any AI assistant (or new developer) can quickly understand how to work in this repository.
