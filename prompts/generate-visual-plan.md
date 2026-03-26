---
description: Generate a visual HTML implementation plan from a feature request, ticket, or plan draft
---
Generate a visual implementation plan as a self-contained HTML page.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow.

If no task, ticket, or plan topic was provided, ask for it and stop.

Workflow:
1. Read the feature request, plan, or relevant ticket.
2. Read the most relevant code, patterns, and integration points.
3. Build a fact sheet covering files, state, API surfaces, edge cases, and assumptions.
4. Produce a self-contained HTML plan page under `~/.pi/agent/diagrams/` with:
   - problem / desired outcome
   - state or flow diagrams
   - file changes
   - API or command changes
   - edge cases
   - test requirements
   - implementation notes
5. Open it if possible and always tell the user the file path.

Rules:
- Show key snippets and file references, not giant source dumps.
- Mark uncertain assumptions clearly.
