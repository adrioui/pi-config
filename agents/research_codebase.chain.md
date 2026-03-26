---
name: research_codebase
description: Code-first technical brief from the live implementation
---

## scout
output: context.md

Map the code, tests, configs, and entry points relevant to: {task}

## codebase-analyzer
reads: context.md
output: analysis.md

Explain how the current implementation works for: {task}
Use precise file references and stay descriptive.

## worker
reads: context.md+analysis.md
output: report.md

Synthesize a concise research brief answering: {task}
Base it on context.md and analysis.md. Include file references and clearly mark uncertainty.
