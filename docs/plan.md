# PlanoVolt MVP implementation plan

## Summary

Build a mobile-first React/TypeScript application covering all P0 requirements plus offline operation. Plans remain on the device; no accounts, backend, or telemetry are required.

Use Vite, React Router, IndexedDB through Dexie, Zod for input validation, Vitest for calculation tests, Playwright for browser tests, and client-side PDF generation with bundled fonts.

Build the complete application before professional review. Keep that review as a pilot-release gate rather than a development prerequisite.

## Scope and technical foundation

- Support resistive loads at 127 V and 220 V, line-to-neutral or line-to-line, with copper conductors and 70 °C PVC insulation.
- Interpret “the most common methods” as a bounded initial implementation of **B1, B2, and C**. Include cable construction and installation descriptions so users select an actual supported arrangement. These methods and their distinct arrangements are documented in [Prysmian’s sizing guide](https://br.prysmian.com/sites/default/files/atoms/files/Guia_de_Dimensionamento-Baixa_Tensao_Rev10.pdf); this is a scope choice, not a verified popularity ranking.
- Use the authorized files you will provide as the source of implementation rules. Record edition, clause/table references, supported conditions, extraction checks, and technical review status. Do not assume an edition is current from its filename.
- Before implementing numerical recommendations, derive a versioned technical specification covering ampacity, temperature/grouping factors, minimum sections, PE sizing, voltage-drop model and limits, breaker coordination, and supported component ratings.
- Unsupported combinations or missing table coverage return explicit issues, never interpolated or invented recommendations.
- Update the PRD to reflect expanded methods, required offline support, and the revised review sequence.

## Implementation

### Calculation engine and contracts

Create a pure TypeScript domain module independent of React, storage, and PDF rendering.

- Expose `evaluatePlan(input, ruleset): PlanEvaluation`, returning per-alternative results, status, input errors, blockers, open items, applied criteria, assumptions, and engine/ruleset versions.
- Model installations with a UUID, timestamps, schema version, equipment, route, professional checks, selected alternative, and materials allowance.
- Represent checks as pending, passed, failed, or explicitly justified not-applicable. Preserve the distinction between measured values, user confirmations, and calculated values.
- Prefer confirmed nameplate current; otherwise calculate current only for confirmed supported resistive loads. Use source-defined consistency criteria when both power and current are supplied.
- Evaluate conductor and breaker combinations together against every supported criterion; report the governing criterion and why smaller candidates fail.
- Distinguish circuit-segment voltage drop from total-installation verification. Never infer supply capacity from the main breaker rating alone.
- Derive status centrally: known execution incompatibility → blocked; insufficient calculation data → draft; calculated results with open checks → preliminary; all covered criteria and required checks satisfied → validated for execution preparation.
- Keep engine review status separate from individual-plan status. Development builds and their PDFs clearly identify an engine awaiting professional validation.

### Forms, results, and alternatives

- Implement Home → Equipment → Route → Panel and safety → Results, with direct editing from results.
- Use PT-BR copy, accessible controls, visible units, decimal-comma input, and inline validation. Preserve incomplete entries while navigating.
- Show current immediately when calculable; do not silently default unknown temperature or grouping conditions.
- Extend the safety form to record failures, total voltage-drop verification, route/conduit feasibility, and applicable connection and protection checks needed by the engine.
- Compare independent and shared conduit arrangements only where the selected installation method supports them. Require separate grouping inputs for the shared option; do not transfer feasibility confirmations between alternatives.
- Show sizing, applied factors, limitations, prioritized open items, and materials for the selected alternative. Incomplete alternatives remain visible without fabricated results.
- Keep trip curve, breaking capacity, RCD specification, and connection components undefined until sufficient supported information exists.

### Persistence, materials, PDF, and offline use

- Autosave drafts in IndexedDB with visible save state; provide explicit save confirmation and confirmed deletion. Handle storage failures without claiming the plan was saved.
- Version persisted records and migrate them transactionally. Recompute on reopening; invalidate results and dependent confirmations when relevant inputs or rules change.
- Generate materials from the selected arrangement, respecting individual-conductor versus multicore-cable construction. Show allowance separately, initially 0% and editable. Leave unspecified components marked “A definir.”
- Generate PDFs locally from an immutable evaluation snapshot, including all PRD-required inputs, results, checks, issues, materials, identifiers, versions, and limitations.
- Bundle fonts and runtime assets. Cache the application for offline reopening after a successful initial load; calculations, saving, and PDF export must work without a network.
- Offer updates between editing sessions so engine and ruleset versions cannot change midway through a calculation.
- Defer duplication and saved technical preferences. Explain browser-storage loss risks and keep installation data off servers.

## Delivery and validation

1. **Foundation:** scaffold the app, define contracts and ruleset provenance, ingest supplied sources, implement the engine and reference fixtures.
2. **Complete journey:** build forms, status handling, results, and local persistence against the engine.
3. **Planning and offline:** add alternatives, materials, PDF export, service-worker caching, and update handling.
4. **Release validation:** obtain professional review, correct findings, run the complete regression suite, and conduct electrician usability testing.

Required checks:

- Independent reference cases for each supported method, voltage, supply arrangement, and correction-factor boundary.
- PRD oven example, longer routes, three grouped circuits, insufficient cable capacity, unsupported loads/methods, and missing critical data.
- Breaker/conductor coordination, table limits, no feasible candidate, PE sizing, and no premature rounding at selection boundaries.
- Status transitions: failed checks block; missing checks prevent validation; changes invalidate dependent results.
- Save/reopen/edit/delete, persistence failures, schema upgrades, and recalculation after ruleset updates.
- Complete offline journey, including reload and PDF export; no unintended installation-data requests.
- Mobile accessibility, PT-BR numeric entry, and calculation updates within one second on a representative mid-range Android device.
- PDF pagination, Portuguese characters, long issue lists, and exact agreement with the exported evaluation snapshot.

Professional approval is not required to finish development. Pilot release requires reviewed reference cases and no unresolved critical calculation or classification defects.

## Assumptions and dependencies

- Source received: `/Users/eduardo/Downloads/NBR-5410.pdf`, identified from its cover as NBR 5410:2004 corrected 2008-03-17. Provenance, coverage, extraction checks and review status are recorded in `technical-spec.md`.
- B1, B2, and C are the chosen launch methods; other methods remain explicitly unsupported.
- Documentation and code stay in English; application and report copy use PT-BR.
- Deploy as static assets over HTTPS. Hosting-provider selection does not affect the application architecture.
- No cloud synchronization, customer database, analytics, or remaining P1 features enter this release.
