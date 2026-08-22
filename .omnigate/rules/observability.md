# Observability Rules

Applies whenever adding logging, monitoring, alerting, health check endpoints, or distributed tracing.

## 1. Structured Logging

- **Use Structured Formats**: Log in structured formats (JSON, key-value pairs) rather than free-form text strings. Include fields: `timestamp`, `level`, `message`, `correlationId`, `service`.
- **Log Levels**: Use appropriate severity levels consistently: `DEBUG` for development diagnostics, `INFO` for normal operations, `WARN` for recoverable issues, `ERROR` for failures requiring attention.
- **No Secrets in Logs**: Never log secrets, tokens, passwords, API keys, full request bodies containing PII, or database connection strings. Mask or redact sensitive fields before logging.
- **Correlation IDs**: Propagate a `correlationId` (or `traceId`) across service boundaries so requests can be traced end-to-end through distributed systems.

## 2. Health Checks & Readiness

- **Health Endpoint**: Expose a `/health` or `/healthz` endpoint that returns service status without authentication. Include dependency health (database connectivity, cache availability, downstream service reachability).
- **Readiness vs. Liveness**: Distinguish between liveness (is the process alive?) and readiness (can it serve traffic?) probes for container orchestration environments.
- **Startup Validation**: Log service startup details (version, environment, loaded configuration keys — not values) at `INFO` level on boot.

## 3. Metrics & Alerting

- **Key Metrics**: Track request rate, error rate, latency (p50/p95/p99), and saturation (queue depth, connection pool usage) — the four golden signals.
- **Actionable Alerts**: Configure alerts on symptoms (error rate spike, latency degradation), not causes. Every alert must have a documented runbook or response action.
- **No Alert Fatigue**: Avoid alerting on expected or self-healing conditions. Tune thresholds to minimize false positives.

## 4. Error Reporting

- **Capture Context**: Error reports should include: stack trace, request metadata (method, path, user ID — not tokens), correlation ID, and environment.
- **Categorize Errors**: Distinguish between client errors (4xx — expected) and server errors (5xx — unexpected). Only alert on server errors by default.
