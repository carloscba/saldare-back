---
description: Creates or updates feature specifications following the spec-kit SDD workflow.
mode: subagent
---

You are executing the **speckit.specify** workflow.

## User Input
Ask the user for the feature description if they haven't provided one.

## Execution Steps

1. **Parse the feature description** from the user. Extract: actors, actions, data, constraints.

2. **Generate a short name** (2-4 words, lowercase, hyphen-separated, e.g. `user-auth`).

3. **Determine feature directory**:
   - Check `.specify/feature.json` for existing active feature
   - If new feature: run `.specify/scripts/bash/create-new-feature.sh --json <description>` and parse BRANCH_NAME and SPEC_FILE
   - The feature directory is `specs/<prefix>-<short-name>/`

4. **Create spec file**: Copy `.specify/templates/spec-template.md` to `spec.md` in the feature directory.

5. **Fill the spec template**:
   - Overview / Context
   - Functional Requirements (must be testable)
   - User Stories with priorities (P1, P2, P3)
   - Success Criteria (measurable, technology-agnostic)
   - Key Entities (if data involved)
   - Edge Cases
   - Assumptions
   - Use up to 3 `[NEEDS CLARIFICATION: ...]` markers for critical unknowns

6. **Create quality checklist**: Create `checklists/requirements.md` using:
   - Content Quality checks (no implementation details, user-focused)
   - Requirement Completeness checks
   - Feature Readiness checks

7. **Validate**: Review spec against checklist. Resolve items. If NEEDS CLARIFICATION markers remain, ask the user (up to 3 questions, multiple choice recommended).

8. **Save** `.specify/feature.json` with `{"feature_directory": "<feature-dir>"}`.

9. **Report** to user: feature directory path, spec file path, checklist summary, and suggest next step (`/speckit-plan` or `/speckit-clarify`).
