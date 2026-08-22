# Production Readiness Rules

Applies whenever writing or editing production code, unit tests, configuration, or documentation.

## 1. Code Quality & Architecture

- **Read Context First**: Inspect existing project files, patterns, and conventions before making changes.
- **Single Responsibility**: Keep functions, classes, and modules focused on a single concern.
- **No Dead Code**: Remove unreachable code, unused imports, and stale commented-out code.
- **Clean Documentation**: Add structured docstrings (JSDoc, Docstrings, XML docs) to public/exported declarations explaining behavior and parameters.

## 2. Configuration & Environment Safety

- **Centralized Config**: Enumerate environment variables in a central config loader or `.env.example` file.
- **Fail Fast on Boot**: Validate required configuration on application startup with clear error messages if required variables are missing.
- **No Hardcoded Defaults for Secrets**: Secrets must never have fallback defaults in source code; missing secrets cause a boot failure.

## 3. Empirical Verification (Non-Negotiable)

- **Run Available Tests & Linters**: Execute project build, lint, and test commands (`npm test`, `pytest`, `go test`, `cargo test`) before declaring work complete.
- **Provide Empirical Evidence**: Include validation output in your final summary. If validation commands cannot be executed in the environment, state why and provide exact commands for the developer to run.
