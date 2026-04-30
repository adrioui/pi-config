---
description: Generate a visual HTML recap of the project's current state and recent activity
---
Generate a visual project recap.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow.

Treat the first argument as either a time window like `2w` / `30d` / `3m` or free-form recap context. Default to a recent-window recap if none is given.

Workflow:
1. Read the top-level project identity files (`README`, package metadata, etc.) and inspect the structure.
2. Gather recent git activity, contributor activity, open local changes, and TODO/FIXME hotspots.
3. Read the most relevant architecture entry points and recent plans/progress docs if available.
4. Produce a self-contained HTML recap under `~/.pi/agent/diagrams/` with:
   - project identity
   - architecture snapshot
   - recent activity themes
   - decision log
   - state of things
   - mental model essentials
   - cognitive-debt hotspots
   - likely next steps
5. Open it if possible and always tell the user the file path.

Rules:
- Keep it evidence-based and current-state oriented.
- Use git output and file references for claims.
