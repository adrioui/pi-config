---
description: Generate a self-contained HTML slide deck for the requested topic and save it under ~/.pi/agent/diagrams
---
Generate a slide deck as a self-contained HTML page.

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.


Arguments: $@

Use the `visual-explainer` skill workflow, specifically the slide-deck patterns.

If no topic was provided, ask what the slide deck should cover and stop.

Workflow:
1. Understand the story arc: title, context, deep dive, and resolution.
2. Read enough source material to make the deck accurate.
3. Choose one strong visual direction and vary layout across slides.
4. Generate a self-contained HTML slide deck under `~/.pi/agent/diagrams/`.
5. Open it if possible and always tell the user the file path.

Rules:
- Slides must be narrative, not a scrolled document cut into chunks.
- Preserve factual breadth; do not drop major sections for style.
