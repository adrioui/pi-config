---
description: Generate a visual HTML diff review for a ref, PR, commit, or working tree change
---
Generate a visual HTML diff review.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow for the final output.

Workflow:
1. Resolve the comparison target from the first argument:
   - branch / ref / range / PR number / commit / `HEAD`
   - default to `main` when nothing is provided.
2. Gather facts first:
   - `git diff --stat`
   - `git diff --name-status`
   - key changed files and tests
   - any relevant docs/changelog updates
3. Read the changed files and the surrounding context needed to make accurate claims.
4. Build a fact sheet before generating HTML. Mark anything uncertain instead of asserting it.
5. Produce a self-contained HTML page under `~/.pi/agent/diagrams/` with:
   - executive summary
   - scope dashboard
   - architecture or flow comparison
   - major file/feature changes
   - test and verification notes
   - code review findings
   - decision log / re-entry context when recoverable
6. Open the file if the environment supports it; otherwise report the path clearly.

Rules:
- Prioritize accuracy over style.
- Keep citations tied to real git output or file references.
- Use the browser page for the rich review and chat for a short summary plus path.
