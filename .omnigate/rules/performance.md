# Performance Rules

Applies whenever optimizing application performance, database query efficiency, caching, bundle size, or scalability.

## 1. Database Query Efficiency

- **Prevent N+1 Queries**: Use eager loading, joins, or batch queries to avoid N+1 query patterns. Profile query counts during development.
- **Pagination Required**: All list/collection endpoints must support pagination (`limit`/`offset` or cursor-based). Never return unbounded result sets.
- **Index Awareness**: Ensure database queries leverage appropriate indexes. Add indexes for columns used in `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY` clauses — but avoid over-indexing write-heavy tables.
- **Query Complexity Limits**: Set query timeout limits. Log slow queries exceeding a configurable threshold for investigation.

## 2. Caching Strategy

- **Cache Expensive Operations**: Cache database queries, API responses, and computed results that are read-heavy and change infrequently. Use appropriate TTLs.
- **Cache Invalidation**: Define explicit invalidation strategies (TTL expiry, event-driven invalidation, or versioned cache keys). Document what triggers cache invalidation.
- **No Stale-Critical Data**: Never cache data where staleness causes correctness issues (e.g., account balances, auth tokens) without real-time invalidation.

## 3. Frontend & Bundle Performance

- **Lazy Load Non-Critical Resources**: Defer loading of below-the-fold content, heavy libraries, and non-essential assets. Use dynamic imports and code splitting.
- **Optimize Assets**: Compress images, minify CSS/JS, and use modern formats (WebP, AVIF) where supported. Enable gzip/brotli compression on responses.
- **Bundle Size Awareness**: Monitor bundle sizes. Set size budgets and alert when bundles exceed thresholds after adding new dependencies.

## 4. Scalability Patterns

- **Async for I/O**: Use asynchronous processing for I/O-bound operations (network calls, file I/O, database queries). Avoid blocking the main thread or event loop.
- **Connection Pooling**: Use connection pools for database and HTTP client connections. Configure pool sizes appropriate to the deployment environment.
- **Rate Limiting**: Implement rate limiting on public-facing endpoints to protect against abuse and ensure fair resource allocation.
