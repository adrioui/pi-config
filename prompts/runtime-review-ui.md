---
description: Browser-backed runtime review for full-stack or UI flows, with code-path verification
model: gpt-5.4
thinking: xhigh
skill: browser-tools
---
Do a browser-backed runtime review for: $@

Use the local prompts, agents, and tools in this workspace. Skip any Linear-specific workflow. Reach for `subagent`, local repo reads, or web tools when they help.

Workflow:
1. Read the relevant frontend, backend, config, route, permission, and integration code first.
2. Identify the primary end-to-end user flows plus the most likely edge cases and failure modes.
3. Start the required frontend, backend, and supporting services, and keep them running while you inspect code and logs.
4. Use browser tools to manually exercise the real UI flow end-to-end whenever feasible.
5. While testing, inspect supporting runtime evidence:
   - frontend console or network failures
   - backend logs
   - API responses and error payloads
   - state transitions, permissions, gating, and feature flags
6. Compare observed UI and backend behavior against the implementation you read. Call out mismatches, regressions, hidden assumptions, weak empty states, and edge-case handling gaps.
7. If browser-based testing is blocked, fall back to the next-best runtime evidence path and explain the limitation clearly.
8. Return findings first, ordered by severity, with both runtime evidence and code evidence.

Rules:
- Do not stop at static review, screenshots, or unit tests alone.
- Prefer real browser interaction over simulated reasoning when the environment supports it.
- Keep the services alive while validating so you can correlate code, logs, and runtime behavior.
- Be explicit about exactly which flows were exercised, which edge cases were checked, and which parts remain unverified.
- If you fix anything during the review, re-run the affected flow and report the before/after evidence.
