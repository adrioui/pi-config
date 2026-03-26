---
description: Implement an approved plan phase by phase with verification and human pauses
---

## Pre-flight

Before starting any implementation work, load `/skill:clean-coder` to establish professional coding standards for this session.

## Getting Started

Arguments: $@

If no plan path is provided, ask for one and stop.

1. Read the plan completely, then read the ticket, research, docs, and files it references.
2. **Read files fully**—never use limit/offset parameters; you need complete context.
3. Detect what is already complete from plan checkboxes or existing changes.
4. Think deeply about how the pieces fit together before writing any code.
5. Use local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, DeepWiki, or web tools when they help.

## Implementation

1. Implement one phase at a time unless the user explicitly approved multiple phases in one run.
2. Follow the plan's intent while adapting to what you find in the codebase.
3. Prefer exact file edits and verifiable progress over large speculative changes.

### When reality doesn't match the plan

Stop and explain the mismatch before improvising:

```
Issue in Phase [N]:
Expected: [what the plan says]
Found: [actual situation]
Why this matters: [explanation]

How should I proceed?
```

## Verification

After each phase:
1. Run the automated verification steps from the plan (e.g. `make check test`).
2. Fix any issues found by those checks.
3. Update completed checkboxes in the plan file.
4. Summarize what changed.
5. Pause for manual verification unless the user explicitly told you to continue through multiple phases:

```
Phase [N] Complete — Ready for Manual Verification

Automated verification passed:
- [list automated checks that passed]

Please perform the manual verification steps listed in the plan:
- [list manual verification items from the plan]

Let me know when manual testing is complete so I can proceed to Phase [N+1].
```

## Resuming Work

If the plan has existing checkmarks:
- Trust that completed work is done.
- Pick up from the first unchecked item.
- Verify previous work only if something seems off.

## Rules

- Do not commit, open PRs, or create ticket updates as part of this command.
- Do not mark manual verification as complete until the user confirms it.
- Do not present work you are not confident in—flag risks and verification steps.
