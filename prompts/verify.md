---
description: Run all verification commands for changed files and report results
---
Detect changed files using git diff. Run `pre-commit run --files` on all changed Python files. Then identify affected services and run `pytest` for each. Report what passed and what failed.

If `src/custom_lib/py/bliv_lib/` changed, find ALL consuming services and test them too.

Use the `verify_changes` tool if available. Otherwise run the commands manually.
