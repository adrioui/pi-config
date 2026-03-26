---
description: Validate Alembic migration safety for current changes
---
Check all Alembic migration files in the current diff for safety. Load the `btj-migration-safety` skill.

Migration files are at `src/<service>/migrations/versions/*.py` (NOT alembic/versions/).

Validate:
1. No data-loss operations (DROP COLUMN, ALTER TYPE without backfill)
2. Revision chain is unbroken (down_revision points to existing migration)
3. No raw SQL interpolation in op.execute()
4. Migration is correctly service-scoped
5. Rollback path exists (downgrade reverses upgrade)
6. No mixing of DDL and DML
7. For backend_admin: check both `migrations/` and `migrations_log/` suites

Migration run command: `cd src/<service> && python main.py migrate`

Report: safe/has-risks/unsafe with specific findings.
