# Database & Data Access Rules

Applies whenever reading, writing, designing, or migrating data structures, ORM schemas, database models, or tables.

## 1. Stack Agnostic & Flexible Data Layer

This gateway supports any data store or ORM approach:
- **ORMs & Schema Tools**: Prisma, Drizzle, EF Core, SQLAlchemy, TypeORM, Hibernate, GORM, Diesel, Mongoose.
- **BaaS & Cloud DBs**: Supabase, Firebase, PlanetScale, Neon, DynamoDB, MongoDB.
- **Relational & Raw SQL**: PostgreSQL, MySQL, SQLite, SQL Server, Oracle.

## 2. Verification Before Data-Access Coding

- **Inspect First, Never Guess**: Read existing ORM schema files (`schema.prisma`, `schema.ts`, `models.py`, `DbContext.cs`, `migrations/`) or run schema inspection commands before referencing table names, column names, or relationships.
- **Use Available Inspection Tools**: If a database inspector tool is available in your workspace, use it. Otherwise, inspect the repository's ORM schema files, migration history, and model definitions to verify schema shapes.
- **Match Existing Models**: Ensure new queries and functions align with established model interfaces, types, and nullability rules.

## 3. Migration Safety (Non-Negotiable)

- **Authoring Migrations**: When creating database migrations, generate forward (`up`) and rollback (`down`) scripts following the project's migration tool conventions (e.g. `npx prisma migrate`, `drizzle-kit generate`, `alembic revision`, `dotnet ef migrations add`).
- **No Direct DDL Executions in Production**: Never execute destructive SQL (`DROP TABLE`, `TRUNCATE`, `ALTER COLUMN DROP`) or run live production migrations without explicit human confirmation.
- **Soft Delete / Audit Trails**: Use soft-delete patterns (e.g. `deletedAt` timestamp) for critical business data where specified by project context.

## 4. Security & Data Protection

- **No Secrets in Database**: Store API keys, tokens, and credentials in standard environment secret managers, storing only non-sensitive references in database tables.
- **Synthetic Test Data Only**: Never place real customer PII or production database dumps into test fixtures, seed files, or prompt outputs.
