---
description: Verify a markdown or HTML document against the actual codebase and correct factual errors in place
---
Fact-check a document against the codebase and git history.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Workflow:
1. Resolve the target file:
   - Use the explicit path if provided.
   - Otherwise use the newest HTML file in `~/.pi/agent/diagrams/`.
2. Read the file and extract every verifiable claim: names, counts, behaviors, file paths, before/after statements, and timeline claims.
3. Re-check each claim against source files, git output, or the relevant plan/diff.
4. Classify each claim as confirmed, corrected, or unverifiable.
5. Correct the document in place while preserving structure and styling.
6. Add a verification summary:
   - HTML: visually integrated section/banner
   - Markdown: `## Verification Summary`
7. Report how many claims were checked, what changed, and where the updated file lives.

Rules:
- Do not re-review opinions or design judgments.
- Correct facts only.
- Preserve Mermaid, layout, and formatting unless they encode factual mistakes.
