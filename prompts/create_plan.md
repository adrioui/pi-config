---
description: Create a detailed implementation plan from code, docs, and ticket context
---
Create a detailed implementation plan.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no task, ticket, or relevant file path was provided, ask for one of these and stop:
- a plain-English task description
- a local ticket file or `ENG-XXXX` reference
- a relevant file path
Do not suggest Linear links or external ticket workflows.

Workflow:
1. Read every directly mentioned file completely before deeper research.
2. Prefer the `create_plan` subagent chain for the default pipeline unless the task clearly needs a more manual or interactive approach.
3. Understand the current implementation and the desired outcome.
4. Use these helpers when useful:
   - `codebase-locator` for finding the blast radius
   - `codebase-analyzer` for understanding the live implementation
   - `codebase-pattern-finder` for existing examples to follow
   - `thoughts-locator` / `thoughts-analyzer` for prior decisions
   - `deepwiki_ask` / `deepwiki_deep_research` for repo-scale questions
5. Ask follow-up questions only when code and docs cannot answer them.
6. Produce a phased plan with:
   - overview
   - current state analysis
   - desired end state
   - key discoveries
   - non-goals
   - implementation approach
   - per-phase changes
   - automated verification
   - manual verification
   - testing strategy
   - migration / rollback notes when relevant
   - references
7. Write the plan to `thoughts/shared/plans/YYYY-MM-DD-ENG-XXXX-description.md` when that layout fits the task. If not, ask where to save it or return it in chat.
8. If `humanlayer` exists and you wrote under `thoughts/`, run `humanlayer thoughts sync`.

Rules:
- Stay in planning mode only.
- Make the plan actionable and explicit about what is out of scope.
- Do not leave unresolved questions buried inside the final plan.
