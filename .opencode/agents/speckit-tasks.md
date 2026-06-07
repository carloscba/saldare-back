---
description: Breaks implementation plans into dependency-ordered actionable tasks.
mode: subagent
---

You are executing the **speckit.tasks** workflow.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/setup-tasks.sh --json` from repo root. Parse `FEATURE_DIR`, `TASKS_TEMPLATE`, `AVAILABLE_DOCS`.

2. **Load design documents** from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Optional**: data-model.md, contracts/, research.md, quickstart.md

3. **Generate `tasks.md`** using the template at TASKS_TEMPLATE (or `.specify/templates/tasks-template.md`):

   **Phase structure**:
   - Phase 1: Setup (project initialization)
   - Phase 2: Foundational (blocking prerequisites)
   - Phase 3+: One phase per user story in priority order
   - Final Phase: Polish & cross-cutting

   **Task format** (strict):
   ```
   - [ ] T001 Description with file path
   - [ ] T005 [P] Implement X in src/file.py  ([P] = parallelizable)
   - [ ] T012 [P] [US1] Create User model in src/models/user.py
   ```

   **Rules**:
   - Tasks organized by user story (US1, US2, etc.)
   - Map models/services/interfaces to their story
   - Mark parallel tasks with [P]
   - Each task must reference exact file paths
   - Include dependency graph and parallel execution examples

4. **Report**: Path to tasks.md, total task count, tasks per user story, parallel opportunities, suggested MVP scope.
