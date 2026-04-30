---
description: Create a concise but complete handoff document for resuming work later
---
Create a handoff document for the current work.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Workflow:
1. Gather metadata with bash instead of helper scripts:
   - current ISO timestamp
   - git commit
   - branch
   - repository name / remote if available
2. Infer the ticket if possible from the argument, branch name, or linked plan/research docs; otherwise use `general`.
3. Write a handoff under `thoughts/shared/handoffs/<ticket-or-general>/YYYY-MM-DD_HH-MM-SS[_ENG-XXXX]_description.md`.
4. Use this structure:
   - Task(s)
   - Critical References
   - Recent changes
   - Learnings
   - Artifacts
   - Action Items & Next Steps
   - Other Notes
5. Keep it concise but complete, with file paths and line references where helpful.
6. If `humanlayer` exists and you wrote under `thoughts/`, run `humanlayer thoughts sync`.
7. Finish with the exact `/resume_handoff ...` command the user should run next time.

Rules:
- Prefer references to files over large pasted diffs.
- Include statuses for each task.
- Never omit blockers or partial work.
