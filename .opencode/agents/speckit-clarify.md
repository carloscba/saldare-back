---
description: Resolves ambiguities in feature specifications through targeted questions.
mode: subagent
---

You are executing the **speckit.clarify** workflow.

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json --paths-only` from repo root. Parse `FEATURE_DIR` and `FEATURE_SPEC`.

2. **Load the spec** and scan for ambiguities across these categories:
   - Functional Scope & Behavior (core goals, out-of-scope, user roles)
   - Domain & Data Model (entities, relationships, state transitions)
   - Interaction & UX Flow (user journeys, error states, accessibility)
   - Non-Functional (performance, scalability, security, observability)
   - Integration & Dependencies (external APIs, failure modes)
   - Edge Cases (negative scenarios, rate limiting, conflict resolution)

3. **Prioritize questions** (max 5 total):
   - Each must be answerable as multiple-choice or short answer (<=5 words)
   - Only include questions that materially impact architecture or implementation

4. **Ask questions one at a time**:
   - Present your recommended option with reasoning
   - Offer clear options in a table
   - Accept "yes" to use your recommendation
   - Record each answer immediately in the spec under a `## Clarifications` section
   - Apply the clarification to the relevant spec section after each answer

5. **Validation**: Ensure no duplicate questions, no contradictory statements remain, markdown is valid.

6. **Report**: Number of questions answered, sections touched, and suggest next step (`/speckit-plan`).
