---
description: Validate local environment setup for current worktree services
---
Check the local development environment for the current worktree.

Arguments: $@

Special case: if the arguments explicitly ask for a pi-web capability check, do that first with `web_search`, `fetch_content`, or `code_search`, then return the result without running the full environment checklist.

Checklist:

1. Check mise config: read `.mise.toml` and `.mise.local.toml` (worktree-specific ports).
2. Check if shared infrastructure is running: `docker compose -p bliv-infra -f docker-compose.infra.yml ps`.
3. Check if worktree services are running: `process-compose status` or `mise up` state.
4. Validate `config/local.env` files exist for active services (backend, backend_data_house, backend_virtualization).
5. Check PostgreSQL connectivity on the worktree's BLIV_PG_PORT.
6. Check for port conflicts with other worktrees (each gets a port offset via BLIV_WORKTREE_ID).

Key commands:
- `mise up` — start all layers (shared infra + worktree DB + backends)
- `mise migrate` — run Alembic for 3 services (backend, backend_data_house, backend_virtualization)
- `mise infra-up` — start shared infra only (Keycloak, Trino, NiFi, MinIO)

Report: ready / needs-setup with specific fix commands.

Use local evidence first. If the user explicitly asks for external docs, dependency behavior, or a pi-web capability check, use `web_search`, `fetch_content`, or `code_search` as needed.
