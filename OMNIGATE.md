# OmniGate AI Entry Point

> **Version**: `v1.0.0` · **Zero-Dependency** · **Universal & Drop-in Portable**

This repository uses **OmniGate AI**. This file (`OMNIGATE.md`) is the **authoritative entry point and master loader** for all AI coding assistants (Antigravity, Gemini, Claude Code, Cursor, Windsurf, GitHub Copilot, OpenAI Codex, Aider, Continue.dev, OpenHands, etc.).

> **Progressive Disclosure Principle**: Load context on demand. Only read detailed rule files when a specific task gate is triggered. Keeping prompt context minimal reduces token costs and keeps AI reasoning sharp.

---

## 1. Required Startup Protocol (Read at Session Start)

1. **Always-On Rules**: Read `.omnigate/rules/hard-stops.md` and `.omnigate/rules/secret-handling.md` at session start (lightweight indexes).
2. **Selective Context Intake**: Read **only these sections** of `.omnigate/PROJECT-CONTEXT.md`:
   - `Section 1: Required Intake Status`
   - Active `Section 3: Current Sprint Tasks` entry
   - `Section 4: Scope & Non-Goals`
   - `Section 5: System Boundaries`
   *(Do NOT read the entire file upfront unless performing fresh project intake).*
3. **Auto-Discovery**: If `.omnigate/PROJECT-CONTEXT.md` contains `<AUTO_DETECT>`, inspect project manifest files (`package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, etc.) to discover tech stack, linters, and build runners automatically.
4. **Task-Gated Loading**: Load additional rules from `.omnigate/rules/` strictly via the **Task-Gated Loading Table** below — one gate at a time, only when the task hits it.
5. **Fresh / Unknown Project Only**: Read `developer-handbook/prompts/PROJECT_INTAKE_PROMPT.md` and run the project intake protocol.

---

## 2. Non-Negotiable Rules (Always in Force — No File Read Needed)

- **Ask Before Assuming**: Seek developer clarification when business logic, stack requirements, or acceptance criteria are underspecified. Urgency is never a reason to guess.
- **Decline Governance Bypasses**: Never skip tests, hardcode credentials, bypass security rules, or execute force pushes. Decline unsafe shortcuts, explain the risk, and offer the compliant path.
- **Secret Protection**: Never write, log, or commit tokens, API keys, private keys, connection strings, `.env` values, or customer PII. Always use standard placeholders (`<TOKEN>`, `<DATABASE_NAME>`).
- **Git & PR Review Governance**: Never execute auto-commits, pushes, or merges silently. Always present the proposed Conventional Commit message (`feat(scope): ...`), changed files summary, and structured PR compare URLs for developer review before committing or pushing.
- **Schema & Persistence Seams**: Before database or persistence work, verify existing tables/models. Never invent table/column names or execute unreviewed DDL.
- **Approved UI Design System**: Build UIs following `.omnigate/skills/ui-ux-design/SKILL.md`. Never re-derive color palettes, logos, or fonts from memory.
- **Empirical Verification**: Never claim a task or bug fix is complete without running build/test validation commands or providing concrete verification logs.

---

## 3. Task-Gated Rule Loading Protocol

> **Progressive Disclosure Execution Rule for AI Assistants**:
> 1. When a developer sends a request, analyze the request keywords and intent against the Gate Triggers below.
> 2. A single request MAY trigger multiple gates simultaneously (e.g. creating a DB-backed UI form triggers `CODE` + `DB` + `UI`).
> 3. **Action Required**: Before writing code or generating responses, invoke your file reading tool (`view_file` / `read_file` / `Read`) to load the rule file specified for each matched gate.
> 4. **Do NOT pre-load un-triggered gates**. Keep un-triggered rules out of context to preserve token budget and reasoning sharpness.

```text
[Developer Prompt Received]
        │
        ▼
[Classify Intent vs Gate Table] ───> Gate(s) Matched (e.g. CODE + DB)
        │
        ▼
[Invoke Tool: view_file / Read] ───> Load .omnigate/rules/production-readiness.md
                                ───> Load .omnigate/rules/database-and-data.md
        │
        ▼
[Execute Task with Loaded Rules Active]
        │
        ▼
[Emit Concise Response: Changes · Validation · Risks]
```

### Task-Gated Rule Table

| Gate | Trigger Signals (Fires when task...) | Rule File to Read |
| :--- | :--- | :--- |
| **CODE** | Writes or edits application code, refactors functions, or updates logic | `.omnigate/rules/production-readiness.md` |
| **DB** | Touches database schemas, SQL queries, ORM models, or migrations | `.omnigate/rules/database-and-data.md` |
| **UI** | Builds or modifies UI screens, components, styles, or design tokens | `.omnigate/skills/ui-ux-design/SKILL.md` *(see UI protocol below)* |
| **API** | Defines or consumes REST, GraphQL, or gRPC endpoints | `.omnigate/rules/api-and-services.md` |
| **GIT** | Handles git branches, commit proposals, PR generation, or releases | `.omnigate/rules/git-and-workflow.md` |
| **AI** | Implements LLM model calls, prompts, RAG, or agent workflows | `.omnigate/rules/ai-features-governance.md` |
| **TEST** | Writes unit/integration tests, assertions, or test suites | `.omnigate/rules/testing-strategy.md` |
| **SECURITY**| Handles authentication, authz roles, encryption, or permissions | `.omnigate/rules/secret-handling.md` + `hard-stops.md` |
| **OBS** | Implements logging, telemetry, tracing, or health endpoints | `.omnigate/rules/observability.md` |
| **DEPS** | Adds or updates dependencies, lockfiles, or package manifests | `.omnigate/rules/dependency-management.md` |
| **PERF** | Optimizes query execution, caching layers, or bundle sizes | `.omnigate/rules/performance.md` |

---

## 4. UI Work Progressive Loading Protocol (Gate U)

When a task involves building or editing user interfaces:
1. Load `.omnigate/skills/ui-ux-design/SKILL.md` (master index, brand identity, layout principles).
2. Read `.omnigate/rules/ui-ux-quality.md` for shell, navigation, page archetypes, and data states.
3. Open **only** the specific reference files needed for components on this screen (e.g. `reference/design-tokens.md`, `reference/component-patterns.md`). Do NOT pre-load unneeded reference files.

---

## 5. Final Response Formatting (Concise by Default)

- **Routine Turns**: Lead tersely with minimal narration:
  - *Changes Made* · *Validation Commands & Results* · *Risks / Follow-ups*
- **Full Report**: (Summary, files changed, validation evidence, DB impact, security posture, risks) emitted only at: verified closeout, schema changes, live deployments, or when requested by developer.

---

## 6. Cost & Context Discipline

- **Model Tier Selection**:
  - **Tier 1 (Fast / Lightweight)**: Minor edits, basic CRUD, formatting, unit tests, docstrings.
  - **Tier 2 (Standard / Balanced)**: Feature implementation, REST endpoints, UI components.
  - **Tier 3 (High-Reasoning / Large)**: System architecture, complex schema migrations, hard debugging.
- **Context Hygiene**: Recommend `/clear` between unrelated tasks so stale reads don't bloat prompt context.
- **Targeted Retrieval**: Use `view_file` with specific line ranges and `grep_search` rather than pasting large file blobs into context.

---

## 7. Agent Personas

Load specialized review personas from `.omnigate/agents/` when performing dedicated reviews:

- **Code Reviewer**: `.omnigate/agents/code-reviewer.md`
- **Database Architect**: `.omnigate/agents/database-architect.md`
- **Release Manager**: `.omnigate/agents/release-manager.md`
- **Security Reviewer**: `.omnigate/agents/security-reviewer.md`
- **Test Engineer**: `.omnigate/agents/test-engineer.md`
- **DevOps Engineer**: `.omnigate/agents/devops-engineer.md`
