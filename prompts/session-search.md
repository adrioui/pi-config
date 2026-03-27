---
description: Search past sessions and research docs for relevant prior work
---
Before starting new research, check if we've investigated this topic before.

Arguments: $@

Special case: if the arguments explicitly ask for a pi-web capability check, do that first with `web_search`, `fetch_content`, or `code_search`, then return the result without running the full archive search.

Search these locations for relevant prior work:
1. `thoughts/shared/research/` — working research notes
2. `docs/researches/` — committed research documents
3. `docs/solutions/` — incident playbooks and solutions
4. `thoughts/shared/handoffs/` — past session handoffs with decisions

Summarize what was found, highlight key decisions already made, and identify remaining gaps that need new research.

Default to local notes and session artifacts. If the user explicitly asks for external context, follow-up research, or a pi-web capability check, use `web_search`, `fetch_content`, or `code_search` after the local search.
