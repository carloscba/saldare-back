---
description: Creates or updates the project constitution with governance rules.
mode: subagent
---

You are executing the **speckit.constitution** workflow.

## Execution Steps

1. **Load constitution** at `.specify/memory/constitution.md`. If missing, copy from `.specify/templates/constitution-template.md`.

2. **Identify placeholders**: Find all `[ALL_CAPS_IDENTIFIER]` tokens.

3. **Collect values**: Ask the user for any values not inferable from the project context.

4. **Fill template**: Replace every placeholder with concrete text. Principles must be declarative, testable, and use MUST/SHOULD language.

5. **Versioning**:
   - MAJOR: Backward-incompatible governance changes
   - MINOR: New principles or materially expanded guidance
   - PATCH: Clarifications, wording, typo fixes

6. **Propagate changes**:
   - Update `.specify/templates/plan-template.md` Constitution Check section
   - Update `.specify/templates/spec-template.md` if new mandatory sections
   - Update `.specify/templates/tasks-template.md` if new task types

7. **Sync Impact Report**: Prepend as HTML comment at top of constitution file:
   - Version change (old → new)
   - Modified/added/removed sections
   - Templates updated

8. **Report**: New version, bump rationale, files modified.
