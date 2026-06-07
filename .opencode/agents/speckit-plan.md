---
description: Generates implementation plans with research, data models, contracts, and quickstart guides.
mode: subagent
---

You are executing the **speckit.plan** workflow.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root. Parse output for `FEATURE_SPEC`, `IMPL_PLAN`, `SPECS_DIR`, `BRANCH`.

2. **Load context**: Read `FEATURE_SPEC` (spec.md), `.specify/memory/constitution.md`, and the plan template at `IMPL_PLAN`.

3. **Phase 0 — Research**: Generate `research.md` in the feature directory:
   - Identify unknowns/NEEDS CLARIFICATION from the spec
   - Research each unknown (tech choices, best practices, dependencies)
   - For each decision: document Decision, Rationale, Alternatives Considered

4. **Phase 1 — Design & Contracts**:
   - Extract entities from spec → `data-model.md` (entities, fields, relationships, validation rules, state transitions)
   - Define interface contracts → `contracts/` directory (API endpoints, CLI schemas, UI contracts as appropriate)
   - Create `quickstart.md` with integration scenarios
   - Update `.github/copilot-instructions.md` between `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` to reference the plan file

5. **Fill `plan.md`** (the IMPL_PLAN template):
   - Technical Context (tech stack, libraries, project structure)
   - Constitution Check (validate against constitution principles)
   - Phase 0 research results
   - Phase 1 data model and contracts
   - Re-evaluate Constitution Check post-design

6. **Report**: Branch name, IMPL_PLAN path, and list of all generated artifacts (research.md, data-model.md, contracts/, quickstart.md).
