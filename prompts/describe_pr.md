---
description: Draft or update a PR description using repo context, diffs, and verification evidence
---
Draft a strong PR description for the relevant pull request.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

Workflow:
1. Resolve the PR:
   - If an argument looks like a PR number, use it.
   - Otherwise try `gh pr view` for the current branch.
   - If that fails, list a few PRs and ask the user which one to describe.
2. Read `thoughts/shared/pr_description.md` if it exists. If it does not, fall back to a clear structure: Summary, Changes, Risks, Verification, Follow-ups.
3. Gather PR context with `gh pr view`, `gh pr diff`, commit metadata, base branch, and any relevant local files not fully visible in the diff.
4. Run verification commands when they are obvious and safe; distinguish automated checks from manual checks.
5. Write the description to `thoughts/shared/prs/<number>_description.md` when that structure exists; otherwise present it in chat and ask where to save it.
6. Show the draft to the user for approval before applying it to the PR, unless the user explicitly asked for direct update.
7. If approved and `gh` is available, update the PR body from the saved file.
8. If `humanlayer` exists and you wrote under `thoughts/`, run `humanlayer thoughts sync`.

Output requirements:
- Be specific about user impact and technical changes.
- Include what changed, why, risk areas, and how to verify.
- Mark manual verification items clearly instead of pretending they were run.
