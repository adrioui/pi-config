---
description: Generate a visual HTML review of a plan against the current codebase state
---
Generate a visual HTML review of a plan.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow for the final output.

If no plan path is provided, ask for one and stop.

Workflow:
1. Read the plan in full.
2. Read every file the plan references plus the most relevant callers, tests, configs, and types.
3. Verify the plan's assumptions about the current codebase before you render anything.
4. Build a fact sheet of current-state behavior, proposed changes, risks, and gaps.
5. Produce a self-contained HTML page under `~/.pi/agent/diagrams/` with:
   - plan summary and scope
   - impact dashboard
   - current architecture
   - planned architecture
   - change-by-change breakdown
   - dependency/ripple analysis
   - risks / questions / review notes
6. Open the page if possible and tell the user the path.

Rules:
- Flag mismatches between plan assumptions and actual code.
- Distinguish solid plan decisions from missing rationale or missing coverage.
- Keep claims grounded in the plan text and actual files.
