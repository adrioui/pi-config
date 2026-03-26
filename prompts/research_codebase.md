---
description: Research how the codebase works today and optionally save a structured note
---
Research the codebase and document how it works today.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no research question, code area, or file path was provided, ask for one and stop.

Workflow:
1. Read any directly mentioned files completely before doing deeper discovery.
2. Prefer the `research_codebase` subagent chain for the default code-first path unless the task clearly needs a more manual or interactive workflow.
3. Break the question into a few concrete research angles.
4. Use the most appropriate helpers:
   - `codebase-locator` for file maps
   - `codebase-analyzer` for implementation details
   - `codebase-pattern-finder` for analogous patterns
   - `thoughts-locator` / `thoughts-analyzer` for historical context
   - `deepwiki_ask` / `deepwiki_deep_research` for repo-scale analysis
5. Validate the highest-signal claims yourself with direct file reads or targeted commands.
6. Use web research only when the user explicitly wants external sources or external docs are essential.
7. Produce a concise answer plus detailed findings with file paths and line ranges.
8. If the task clearly belongs in `thoughts/shared/research/`, write a research note there and sync it when `humanlayer` is available.

Rules:
- Treat live code as the source of truth.
- Keep the report descriptive unless the user explicitly asks for recommendations.
