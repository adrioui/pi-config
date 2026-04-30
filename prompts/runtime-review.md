---
description: Runtime-backed review with real service testing, logs, and code-path verification
model: gpt-5.4
thinking: xhigh
skill: interactive-shell
---
Do a runtime-backed review for: $@

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.

Workflow:
1. Read the relevant implementation, configs, tests, docs, and setup instructions first.
2. Identify the minimum end-to-end flows and edge cases that must be exercised.
3. Start the required services, processes, or supporting tooling and keep them running while you inspect code and logs.
4. Manually exercise the highest-value runtime flows against the real running system.
5. Inspect runtime evidence while testing:
   - service logs
   - browser or API responses
   - database or storage state when relevant
   - background worker or connector behavior when relevant
6. Compare runtime behavior against the code paths you read. Call out mismatches, hidden assumptions, flaky behavior, and missing safeguards.
7. If runtime validation is blocked, explain exactly what blocked it, what you already verified, and the shortest next step to unblock it.
8. Return findings first, ordered by severity, with both code evidence and runtime evidence.

Rules:
- Do not stop at static review or unit tests alone.
- Prefer real runtime evidence over theoretical concerns when the environment allows it.
- Use interactive shell for long-running services or interactive CLIs.
- Use browser tools if the runtime flow clearly requires real UI interaction.
- Be explicit about what was actually run, what was actually tested, and what remains unverified.
- If you make any fixes during the review, say exactly what changed and what was re-tested afterward.
