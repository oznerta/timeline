# Dependency Management Rules

Applies whenever adding, upgrading, removing, or auditing project dependencies and packages.

## 1. Lockfile Discipline

- **Always Commit Lockfiles**: Commit `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Pipfile.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`, or equivalent lockfiles to version control. This ensures deterministic builds across environments.
- **Install from Lockfile in CI**: Use lockfile-based install commands in CI/CD (`npm ci`, `pip install --require-hashes`, `cargo build --locked`) to prevent supply-chain drift.
- **Review Lockfile Diffs**: When a lockfile changes, review the diff for unexpected transitive dependency additions or version bumps.

## 2. Security & Vulnerability Scanning

- **Audit Before Merge**: Run `npm audit`, `pip audit`, `cargo audit`, `dotnet list package --vulnerable`, or equivalent before merging dependency changes.
- **No Known Critical Vulnerabilities**: Do not merge Pull Requests that introduce dependencies with known critical or high-severity CVEs without explicit documented justification and a remediation timeline.
- **Pin Versions**: Use exact versions or tight ranges (`~` not `*`) to prevent unexpected breaking changes from auto-upgrades.

## 3. Minimal & Intentional Dependencies

- **Evaluate Before Adding**: Before adding a new dependency, evaluate: Is this a well-maintained package? Could this be implemented with a few lines of code instead? What is the transitive dependency footprint?
- **One Dependency, One Purpose**: Avoid adding multiple packages that solve the same problem (e.g., two HTTP clients, two date libraries).
- **Remove Unused Dependencies**: Periodically audit and remove dependencies that are no longer imported or used. Use tools like `depcheck`, `pipdeptree`, or language-specific equivalents.

## 4. License Compatibility

- **Check Licenses**: Before adding a dependency, verify its license is compatible with the project's license. Avoid GPL-licensed packages in MIT/Apache projects unless the project is also GPL.
- **Document Exceptions**: If a dependency with a restrictive license is necessary, document the justification and any compliance requirements.
