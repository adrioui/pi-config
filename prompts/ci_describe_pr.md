---
description: Draft and apply a PR description directly when the repository supports it
---
Create and apply a PR description.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Workflow:
1. Resolve the PR from the argument or current branch.
2. Read `thoughts/shared/pr_description.md` if it exists; otherwise use a clean default structure.
3. Gather the diff, commits, title, base branch, and any missing file context.
4. Run the most relevant automated verification commands you can safely infer.
5. Write `thoughts/shared/prs/<number>_description.md` when possible.
6. If `humanlayer` exists and you wrote under `thoughts/`, run `humanlayer thoughts sync`.
7. Apply the description with `gh pr edit <number> --body-file ...` when possible.
8. Report what was updated, what was verified automatically, and what still needs manual verification.

Rules:
- Be concise but complete.
- If `gh` or repository configuration is missing, stop with an actionable error.
- Do not invent successful checks that you did not run.
