# Fresh Project Bootstrap Command

Use this command when initializing OmniGate AI on a new or unconfigured project codebase.

---

## Bootstrap Sequence

1. **Auto-Detect Project Identity**:
   - Inspect manifest files (`package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `pom.xml`, `build.gradle`, etc.).
   - Extract project name, language, runtime versions, package manager, and build/test runners.

2. **Initialize `.omnigate/PROJECT-CONTEXT.md`**:
   - Fill in auto-detected values into Section 1 (`Intake Status`) and Section 2 (`Tech Stack`).
   - Leave unknown business logic, primary users, and database details as `<ASK_DEVELOPER>`.

3. **Run Intake Interview**:
   - Prompt the developer with 3-5 high-yield questions to clarify business purpose, database engine, authentication model, and primary users.

4. **Verify Secret Protection**:
   - Ensure `.gitignore` contains standard OmniGate secret protection directives (`.env`, `*.pem`, `*.key`, `credentials.json`).
