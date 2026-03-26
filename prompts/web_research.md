---
description: Run focused external web research with the web_research subagent chain
---
Run focused external web research.

Use the local prompts, agents, and tools in this workspace.


Arguments: $@

If no research topic or question was provided, ask for one and stop.

Workflow:
1. Prefer the `web_research` subagent chain for the default workflow.
2. Use external web sources to answer the question directly.
3. Return a concise summary first, then the key findings with sources.
4. If the user wants a saved note and the repo uses `thoughts/shared/research/`, write it there.

Rules:
- Keep the answer source-backed.
- Call out uncertainty or gaps explicitly.
- Do not pretend live codebase research can substitute for external sources.
