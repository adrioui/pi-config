---
description: Investigate an issue in read-only mode using logs, git state, files, and other available evidence
---
Investigate a problem in read-only mode.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

If the user did not describe the issue, ask what they were doing, what went wrong, and any exact error text, then stop.

Workflow:
1. Read any provided plan, ticket, or error context first.
2. Do a quick state check: branch, git status, recent commits, relevant files.
3. Investigate the highest-signal evidence available:
   - logs
   - config or state files
   - database files via CLI tools when available
   - relevant code paths
4. Use local agents or targeted repo reads only when they will reduce ambiguity.
5. Produce a focused debug report with:
   - problem framing
   - evidence found
   - likely explanation based on that evidence
   - next checks or commands

Rules:
- Stay read-only unless the user explicitly asks for fixes afterward.
- If expected logs or services are missing, say so instead of guessing.
- Be concrete about timestamps, file paths, and command output.
