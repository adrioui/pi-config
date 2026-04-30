---
description: Create focused git commit(s) after reviewing the current changes
---
Create git commit(s) for the current work.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Workflow:
1. Review `git status --short`, staged vs unstaged diff, and recent work context.
2. Decide whether the changes should be one commit or several logical commits.
3. Draft concise imperative commit messages that explain why the change exists.
4. Show the commit plan first: files per commit and message per commit.
5. Ask for confirmation unless the user explicitly asked you to commit immediately.
6. After confirmation, add files explicitly (never `git add -A` or `git add .`), commit, and show `git log --oneline -n <count>`.

Rules:
- Never include `thoughts/`, secrets, temp files, generated junk, or unrelated edits unless the user explicitly asks.
- Never add co-authors or any AI attribution.
- If the diff is messy, propose a cleanup/staging split before committing.
