---
description: Analyze blast radius of current changes across services
---
Analyze the blast radius of current changes. Load the `btj-test-impact` skill if available.

Arguments: $@

Special case: if the arguments explicitly ask for a pi-web capability check, do that first with `web_search`, `fetch_content`, or `code_search`, then return the result without running the full blast-radius workflow.

1. List all changed files (git diff --name-only HEAD).
2. Map each file to its owning service.
3. If `src/custom_lib/py/bliv_lib/` changed, trace ALL importing services.
4. For each affected service, list the specific test commands to run.
5. Flag any cross-service risks.

Output a clear impact report with exact verification commands.

Default to local code and git evidence. If the user explicitly asks for external context, dependency behavior, or a pi-web capability check, use `web_search`, `fetch_content`, or `code_search` to support the analysis.
