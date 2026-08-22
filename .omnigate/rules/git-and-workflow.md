# Git & Workflow Rules

Applies whenever working with branches, commits, Pull Requests, version tags, or git repositories.

---

## 1. Mandatory Review Before Commits, Pushes & Merges

- **No Silent / Auto Commits**: AI agents MUST NOT execute `git commit`, `git push`, `git merge`, or `git rebase` silently or automatically.
- **Commit Proposal Protocol**: Before committing, the AI agent MUST:
  1. Inspect `git status` and `git diff` to summarize changed and staged files.
  2. Propose a **Suggested Commit Message** formatted according to Conventional Commits standard (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`, `refactor(scope): ...`).
  3. Wait for developer approval or present the exact command line for the developer to execute.

---

## 2. Branching & Conventional Commits

- **Branch Naming Standard**: `main`/`master` (production), `dev` (integration), `feature/<name>` (features), `fix/<name>` (bug fixes), `chore/<name>` (maintenance).
- **Commit Message Format**:
  ```text
  <type>(<scope>): <short summary in imperative mood>

  [optional body explaining motivation and context]
  ```

---

## 3. Pull Request (PR) Hand-Off & Link Generation

When preparing a Pull Request, the AI agent MUST NOT auto-merge or force-push. Instead, the agent MUST generate and hand over a complete **PR Review Package**:

### PR Package Deliverables

1. **Suggested PR Title**: Conventional Commits formatted (e.g. `feat(crm): implement contact enrichment review table`).
2. **Suggested PR Body**:
   ```markdown
   ## Summary of Changes
   - Describe what was built or fixed.

   ## Motivation & Context
   - Business goal or issue reference.

   ## Validation & Testing
   - Commands executed and pass evidence (e.g. `npm run test`, `vendor/bin/pint`).

   ## Breaking Changes & DB Impact
   - None / Schema migration notes.
   ```
3. **Direct GitHub PR Creation Link**:
   Format: `https://github.com/<OWNER>/<REPO>/compare/<BASE_BRANCH>...<HEAD_BRANCH>?expand=1`
4. **CLI Command Alternative**:
   `gh pr create --base <BASE_BRANCH> --head <HEAD_BRANCH> --title "<SUGGESTED_TITLE>" --body "<SUGGESTED_BODY>"`

---

## 4. Version Tagging & Release Approval

- **Semantic / Calendar Versioning**: Use standard semantic versioning (`v1.0.0`) or calendar versioning (`v2026.1.0`).
- **Release Confirmation**: Executing live production releases, tag pushes, or production migrations strictly requires explicit developer review and confirmation.
