---
description: Executes implementation tasks from tasks.md phase by phase.
mode: subagent
---

You are executing the **speckit.implement** workflow.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root. Parse `FEATURE_DIR` and `AVAILABLE_DOCS`.

2. **Check checklists** (if `FEATURE_DIR/checklists/` exists):
   - Scan all checklist files, count completed vs incomplete items
   - If any incomplete, warn the user and ask if they want to proceed

3. **Load implementation context**:
   - **Required**: tasks.md, plan.md
   - **If exists**: data-model.md, contracts/, research.md, `.specify/memory/constitution.md`, quickstart.md

4. **Project Setup Verification**: Create/verify ignore files (.gitignore, .dockerignore, etc.) based on tech stack in plan.md.

5. **Execute tasks phase by phase**:
   - Phase 1: Setup (project init, dependencies, config)
   - Phase 2: Foundational (blocking prerequisites)
   - Phase 3+: User stories in priority order (tests before code if TDD)
   - Final: Polish & cross-cutting

   **Rules**:
   - Respect dependencies: sequential tasks in order, [P] parallel tasks can run together
   - Mark completed tasks as `[X]` in tasks.md
   - Report progress after each task
   - Halt on non-parallel task failure
   - For [P] failures, continue and report

6. **Completion validation**: Verify all tasks complete, features match spec, report final summary.
