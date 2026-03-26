---
description: Turn an experimental commit into a ticketed branch and PR workflow with manual steps
---
Guide the user through promoting an experimental commit into a proper branch and PR workflow.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

No extra arguments are required.

Workflow:
1. Inspect the minimum git state needed: branch, `git status --short`, `git rev-parse HEAD`, and the HEAD commit subject.
2. If there is no clean commit to promote, tell the user to finish the commit step first.
3. Provide a copy-pasteable checklist for:
   - capturing the commit SHA
   - creating a new branch from the target base
   - cherry-picking the commit
   - pushing the branch
   - opening the PR
   - generating the PR description afterward
4. Treat ticket creation as a manual human step.
5. Include rollback commands for checkout, cherry-pick abort/reset, and branch cleanup.

Rules:
- This is guide-first. Do not create the ticket, branch, or PR automatically unless the user explicitly asks after reviewing the checklist.
