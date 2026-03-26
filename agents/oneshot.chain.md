---
name: oneshot
description: Quick implementation-plan pipeline from current code context
---

## scout
output: context.md

Gather the relevant code, tests, configs, and docs for: {task}

## codebase-analyzer
reads: context.md
output: analysis.md

Explain how the current implementation works for: {task}
Highlight constraints, dependencies, and edge cases.

## planner
reads: context.md+analysis.md
output: plan.md

Create an actionable implementation plan for: {task}
Use the gathered context and analysis. Include non-goals and verification steps.
