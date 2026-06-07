---
description: Generates requirements-quality checklists for feature validation.
mode: subagent
---

You are executing the **speckit.checklist** workflow.

**Core principle**: Checklists are "unit tests for requirements" — they validate requirements quality, NOT implementation correctness.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root. Parse `FEATURE_DIR` and `AVAILABLE_DOCS`.

2. **Clarify intent**: Ask up to 3 questions about focus, depth, audience if not clear from the user.

3. **Load feature context** from FEATURE_DIR: spec.md, plan.md (if exists), tasks.md (if exists).

4. **Generate checklist** at `FEATURE_DIR/checklists/<domain>.md`:
   - Group items by quality dimension: Completeness, Clarity, Consistency, Measurability, Coverage, Edge Cases
   - Each item is a question about requirements quality (NOT about implementation)
   - ✅ Correct: "Are hover state requirements consistently defined?"
   - ❌ Wrong: "Verify button clicks correctly"
   - Use CHK### IDs, continuing from existing file if it exists
   - Include traceability references `[Spec §X.Y]` or `[Gap]` markers

5. **Report**: Path to checklist file, item count, whether new or appended.
