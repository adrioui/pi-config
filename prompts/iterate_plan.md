---
description: Update an existing implementation plan with fresh validation and precise edits
---
Update an existing implementation plan.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

If no plan path or requested changes were provided, ask for them and stop.

Workflow:
1. Read the existing plan completely.
2. Read any directly mentioned research, tickets, or code files completely.
3. Determine whether the requested changes require fresh technical validation.
4. If they do, use direct reads, local agents, and targeted repo checks to validate the changes.
5. Summarize your understanding and, if anything is ambiguous, confirm before editing.
6. Edit the plan surgically while preserving its structure unless the user asked for a reshape.
7. If `humanlayer` exists and the plan lives under `thoughts/`, run `humanlayer thoughts sync`.
8. Report exactly what changed and any remaining open decisions.

Rules:
- This command edits the plan document only.
- Do not implement the plan.
- Do not leave unresolved questions buried in the plan.
