# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

**RCX** is a fresh repository with no initial codebase. This CLAUDE.md serves as the foundation for development conventions, workflows, and guidelines that should be followed as the project is built out.

> When the project is initialized with a specific technology stack, update this file to reflect the actual structure, tooling, and conventions.

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

### Persistent Memory (claude-mem)

This environment has [claude-mem](https://github.com/thedotmack/claude-mem) installed — a persistent memory plugin for Claude Code that captures tool usage observations and injects relevant context into future sessions.

- Installed via: `npx claude-mem install` (version 12.0.1)
- Plugin location: `~/.claude/plugins/marketplaces/thedotmack/`
- Settings: `~/.claude-mem/settings.json`
- Worker API / viewer UI: `http://localhost:37777` (start with `npx claude-mem start`)
- Search past work: use `/mem-search` in Claude Code
- Memory is automatic — no manual intervention required

---

## Updating This File

This file should be updated whenever:
- The technology stack is chosen and initialized
- New tooling, linters, or formatters are added
- Key architectural decisions are made
- Build, test, or deployment workflows are established
- Team conventions are agreed upon

The goal is to keep this file accurate so that any AI assistant (or new developer) can quickly understand how to work in this repository.
