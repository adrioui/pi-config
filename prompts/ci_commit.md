---
description: Create focused git commit(s) without an approval pause unless blocked
---
Create git commit(s) for the current work.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

Workflow:
1. Review `git status --short` and the diff.
2. Split the work into the smallest sensible logical commits.
3. Stage files explicitly for each commit and commit them without stopping for a confirmation round unless the user asked for one.
4. Show the resulting commit list with `git log --oneline -n <count>`.

Rules:
- Never stage `thoughts/`, secrets, temp files, generated junk, or unrelated edits.
- Never use `git add -A` or `git add .`.
- Never add AI attribution or co-author trailers.
- If something important is ambiguous, stop and ask instead of guessing.
