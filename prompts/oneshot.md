---
description: Research a task and draft an implementation plan in one pass
---
Run the inline research-then-plan workflow.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no ticket, file path, or problem statement was provided, ask for one and stop.

Workflow:
1. Resolve the source context (ticket file, ENG-XXXX local export, or direct problem statement).
2. Prefer the `oneshot_plan` subagent chain for the default research-then-plan pass unless the task clearly needs a more manual workflow.
3. Research the task inline:
   - read the source context
   - research the codebase
   - optionally write a research document if that fits the repo's `thoughts/` layout
4. Create or update the implementation plan inline:
   - write it under `thoughts/shared/plans/` when appropriate
5. Stop at the plan-review boundary. Do not prepare implementation automatically.
6. End with research path, plan path, unresolved questions, and the exact next step for human review.
