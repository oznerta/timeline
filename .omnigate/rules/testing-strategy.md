# Testing Strategy Rules

Applies whenever writing, reviewing, or planning tests, test infrastructure, or QA strategy.

## 1. Test Pyramid & Coverage

- **Unit Tests First**: Prioritize fast, isolated unit tests over integration or end-to-end tests. Reserve E2E tests for critical user flows.
- **Coverage Targets**: Aim for meaningful coverage of business logic branches, not vanity line-coverage percentages. Cover happy paths, edge cases, and known failure modes.
- **Test Naming**: Use descriptive test names that state the scenario and expected outcome (e.g., `should_return_404_when_user_not_found`).

## 2. Fixture & Data Isolation

- **Isolated Test State**: Each test must set up and tear down its own state. Never depend on test execution order or shared mutable state across tests.
- **Synthetic Data Only**: Use factory functions or builders to create test data. Never use production data, real PII, or database dumps in test fixtures.
- **Deterministic Tests**: Avoid flaky tests by mocking time, randomness, and external services. Pin timestamps and UUIDs in test fixtures.

## 3. Mocking & Dependency Boundaries

- **Mock at Boundaries**: Mock external services, databases, and third-party APIs — not internal business logic. Prefer dependency injection over monkey-patching.
- **Contract Tests**: When mocking external APIs, maintain contract tests or schema validation to catch upstream changes.
- **No Production Side Effects**: Tests must never send real emails, charge real payment methods, write to production databases, or call live external APIs.

## 4. CI Integration

- **Tests Must Pass Before Merge**: All tests must pass in CI before a Pull Request can be merged. No "skip tests" exceptions without explicit documented justification.
- **Fast Feedback**: Keep unit test suites under 60 seconds. Parallelize where possible. Run slow integration tests in a separate CI stage.
- **Regression Tests**: When fixing a bug, write a regression test that reproduces the bug first, then verify the fix makes it pass.
