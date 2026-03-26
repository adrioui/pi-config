---
description: Validate implementation against a plan and report matches, deviations, and remaining manual checks
---
Validate an implementation against a plan.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

If no plan path is provided, ask for it and stop.

Workflow:
1. Read the plan fully and extract:
   - phases
   - expected file changes
   - automated verification commands
   - manual verification items
2. Inspect current code and git state to determine what was actually implemented.
3. Run the automated verification commands that are safe and available.
4. Compare plan vs implementation systematically.
5. Produce a report with:
   - matches
   - deviations
   - failing or missing checks
   - manual verification still required
   - any major risks or follow-up work

Rules:
- Be evidence-based and explicit about what you actually ran.
- Treat manual verification as pending unless the user already confirmed it.
- Do not silently redefine the plan to match the code.
