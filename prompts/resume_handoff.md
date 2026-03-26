---
description: Resume work from a handoff by validating the current state and proposing the next step
---
Resume work from a handoff document.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no handoff path or ENG-XXXX reference was provided, ask for one and stop.

Workflow:
1. If the argument is `ENG-XXXX`, optionally run `humanlayer thoughts sync` if the CLI exists, then find the newest handoff under `thoughts/shared/handoffs/ENG-XXXX/`.
2. Read the chosen handoff completely.
3. Read the linked research, plan, and artifact files it depends on.
4. Validate current repo state with read-only checks such as `git status --short`, recent changes, and file existence.
5. Summarize:
   - original tasks and status
   - validated learnings
   - artifacts reviewed
   - gaps or conflicts between handoff state and current state
   - recommended next action
6. Stop after analysis and ask the user whether to proceed.

Rules:
- Do not start implementation automatically.
- Prefer direct file reads for the critical context instead of delegating them away.
