# API & Services Rules

Applies whenever building or consuming REST endpoints, GraphQL APIs, gRPC services, or external integrations.

## 1. Clean API Contracts

- **Structured Error Responses**: Standardize error payloads (e.g. `{ error: { code, message, correlationId } }`).
- **Correct HTTP Status Codes**: Never return `200 OK` for error bodies. Use appropriate status codes (`400`, `401`, `403`, `404`, `422`, `500`).
- **No Stack Traces in Responses**: Scrub internal stack traces, raw SQL queries, or sensitive system details from client responses.

## 2. Integration Resilience

- **Bounded Timeouts**: Every outbound network or process call must specify an explicit timeout limit.
- **Retries & Backoff**: Retry transient network failures on idempotent requests using exponential backoff with jitter.
- **Idempotency Keys**: Require client idempotency keys (`Idempotency-Key` header) for retryable payment or record-creation mutations.
