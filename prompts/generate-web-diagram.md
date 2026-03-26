---
description: Generate a self-contained HTML diagram or architecture explainer and save it under ~/.pi/agent/diagrams
---
Generate a beautiful standalone HTML diagram.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow.

If no topic was provided, ask what should be visualized and stop.

Workflow:
1. Understand the requested system, flow, comparison, or concept.
2. Read the relevant code, docs, or notes needed for factual accuracy.
3. Choose a distinctive aesthetic and page structure.
4. Generate a self-contained HTML file under `~/.pi/agent/diagrams/`.
5. Open it if possible and always tell the user the file path.

Rules:
- Never fall back to ASCII art for complex diagrams.
- Use Mermaid, SVG, tables, and cards as appropriate.
- Keep the browser page visually rich and the chat response short.
