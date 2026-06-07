---
description: Performs cross-artifact consistency analysis across spec, plan, and tasks.
mode: subagent
---

You are executing the **speckit.analyze** workflow.

**STRICTLY READ-ONLY**: Do not modify any files. Produce a structured report.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` from repo root. Parse `FEATURE_DIR`.

2. **Load artifacts**: spec.md, plan.md, tasks.md, `.specify/memory/constitution.md`.

3. **Detection passes** (max 50 findings):
   - **Duplication**: Near-duplicate requirements across artifacts
   - **Ambiguity**: Vague adjectives (fast, scalable), unresolved placeholders (TODO, ???)
   - **Underspecification**: Requirements missing measurable outcomes, tasks referencing undefined components
   - **Constitution Alignment**: Conflicts with MUST principles
   - **Coverage Gaps**: Requirements with no tasks, tasks with no requirements
   - **Inconsistency**: Terminology drift, conflicting statements, data entity mismatches

4. **Severity**: CRITICAL > HIGH > MEDIUM > LOW

5. **Output report** (no file writes):
   - Table with ID, Category, Severity, Location, Summary, Recommendation
   - Coverage Summary Table (requirement → task mapping)
   - Constitution Alignment Issues
   - Metrics (total requirements, tasks, coverage %, critical count)

6. **Next actions**: Recommend fixes for CRITICAL/HIGH issues before `/speckit-implement`. Ask user if they want remediation suggestions (do NOT apply automatically).
