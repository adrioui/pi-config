---
name: create_plan
description: Pattern-aware implementation planning pipeline
---

## scout
output: context.md

Map the relevant code, entry points, tests, configs, and blast radius for: {task}

## codebase-pattern-finder
reads: context.md
output: patterns.md

Find the closest existing patterns and reusable examples for: {task}

## planner
reads: context.md+patterns.md
output: plan.md

Draft a concrete implementation plan for: {task}
Use context.md and patterns.md. Include phases, non-goals, automated verification, and manual verification.
