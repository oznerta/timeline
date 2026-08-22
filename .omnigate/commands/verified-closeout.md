# Verified Closeout Command

Use this command when concluding a feature, bug fix, or refactoring task to ensure complete empirical verification and structured reporting.

---

## Closeout Protocol

1. **Execute Validation Commands**:
   - Run linter / formatter (e.g. `npm run lint` / `vendor/bin/pint`).
   - Run unit & integration test suites (e.g. `npm test` / `php artisan test`).
   - Run build command (e.g. `npm run build`).

2. **Summarize Changes**:
   - List modified, created, and deleted files.
   - Summarize key architectural decisions or schema updates.

3. **Git & PR Review Handoff**:
   - Inspect `git status` and `git diff`.
   - Propose Conventional Commit message (`feat(scope): ...`).
   - Provide structured PR Title, PR Body description, and direct GitHub compare URL.

4. **Emit Full Closeout Report**:
   ```markdown
   ### Verified Closeout Report
   - **Summary of Changes**: <HIGH_LEVEL_SUMMARY>
   - **Files Modified**: <LIST_OF_FILES>
   - **Validation Results**: Build PASSED · Tests PASSED (e.g., 24/24 tests passed)
   - **Git Proposed Commit**: `feat(<scope>): <summary>`
   - **PR Compare URL**: `https://github.com/<OWNER>/<REPO>/compare/<BASE>...<HEAD>?expand=1`
   - **Risks & Follow-ups**: None / <NOTES>
   ```
