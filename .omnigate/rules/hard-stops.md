# Hard Stops - Universal Safety Non-Negotiables

Quick index of non-negotiable stops. If you hit any of these, **stop and ask the developer**. Do not bypass a hard stop because it is inconvenient or urgent.

| Hard Stop | Rule Source |
| :--- | :--- |
| Proceed past ambiguous business logic or stack requirements on a guess instead of asking | `.omnigate/rules/production-readiness.md` |
| Add a secret, token, API key, credential, or full connection string to source code or git commits | `.omnigate/rules/secret-handling.md` |
| Execute `git commit`, `git push`, `git merge`, or PR creation without presenting proposed commit messages, diff summaries, or PR links for developer review first | `.omnigate/rules/git-and-workflow.md` |
| Execute destructive DDL (`DROP TABLE`, `TRUNCATE`) or run live database migrations on production without explicit approval | `.omnigate/rules/database-and-data.md` |
| Change production deployment configs, infrastructure, authz, or host settings without explicit developer approval | `.omnigate/rules/git-and-workflow.md` |
| Place real production PII or customer data in non-production environments, unit tests, or prompt context | `.omnigate/rules/secret-handling.md` |
| Make unbounded outbound network calls without a timeout, or retry non-idempotent mutations without an idempotency key | `.omnigate/rules/api-and-services.md` |
| Return HTTP 200/Success responses for error payloads, or leak internal stack traces to clients | `.omnigate/rules/api-and-services.md` |
| Start an application with missing runtime configuration, or assign secrets hardcoded default values | `.omnigate/rules/production-readiness.md` |
| Claim a task or bug fix is complete without executing validation commands or providing testing evidence | `.omnigate/rules/production-readiness.md` |
| Execute high-impact or irreversible AI agent actions (deleting data, sending external emails) without human confirmation | `.omnigate/rules/ai-features-governance.md` |
