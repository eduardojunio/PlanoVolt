# PlanoVolt — Residential Electrical Planning Assistant PRD

**Product/project name:** PlanoVolt  

**Version:** 1.0 — MVP  
**Status:** Proposed for development  
**Platform:** Responsive web application, mobile-first  
**Initial market:** Brazil  
**Primary audience:** Electricians performing residential installations and small renovations

> **Language policy:** Project documentation, source code, and technical content are written in English. The application interface is in Brazilian Portuguese (PT-BR); quoted Portuguese text in this document represents user-facing UI copy.

---

## 1. Product vision

### 1.1 Problem

Electricians often need to install new high-power equipment in existing homes, such as ovens, electric showers, and other equipment that requires dedicated circuits.

Although the required calculations are known, performing them correctly can require consulting tables, applying correction factors, checking regulatory criteria, and assessing the installation conditions.

Available tools often have complex interfaces, require substantial software expertise, or are designed for producing complete electrical projects.

This creates a practical challenge: carrying out quick, consistent, documented technical planning during a customer visit.

### 1.2 Proposed solution

Create an application that allows an electrician to:

1. Enter the equipment characteristics.
2. Describe how the new circuit will be installed.
3. Record relevant conditions of the existing panel and installation.
4. Obtain preliminary conductor and protective-device sizing.
5. Identify open items, incompatibilities, and required upgrades.
6. Generate a technical summary and a preliminary materials list.

The product will use forms, selectors, and automatic calculations rather than a chatbot interface.

### 1.3 Value proposition

**Plan a new residential circuit quickly, with traceable calculations, Brazilian technical criteria, and information organized for installation.**

The tool should reduce repetitive work without replacing on-site inspection, technical checks, or professional responsibility.

---

## 2. MVP objectives

### Primary objective

Allow an electrician to perform preliminary sizing for a dedicated residential circuit and produce a field-ready plan in a few minutes, when the required data is available.

### Secondary objectives

- Reduce arithmetic errors and missed checks.
- Standardize information gathering during site visits.
- Explain sizing issues in plain language.
- Prevent incomplete results from being interpreted as approval of the installation.
- Make job material preparation easier.
- Record the parameters used in each calculation.

### Proposed success criteria

| Metric | Initial target to validate |
|---|---|
| Time to complete a simple case | Up to 4 minutes when data is available |
| Flow completion without assistance | At least 80% of pilot users |
| Calculation agreement with technical reference cases | 100% in approved test cases |
| Results incorrectly classified as approved | Zero in test cases |
| Users able to generate a plan | At least 80% in the pilot |

Usability targets are product hypotheses and should be adjusted after initial testing with electricians.

---

## 3. Target audience

### Primary user

A professional electrician who:

- Performs residential installations and renovations.
- Frequently works with electric showers, ovens, and dedicated loads.
- Needs to size new circuits.
- Uses a phone during site visits and estimates.
- Understands basic electrical installation concepts.
- Prefers practical tools to complex engineering software.

### Primary need

“I need to install new equipment. I want to know how to size its circuit, which materials to consider, and what to check in the existing installation.”

### Users outside the initial focus

- Designers of large buildings.
- Engineers who need complete electrical projects.
- Industrial electricians.
- Consumers without technical training.
- Users sizing complex three-phase installations.

---

## 4. First-version scope

### 4.1 Included features

**P0 — Required for launch**

- Create, edit, and save installations.
- Select common equipment or a generic resistive load.
- Enter rated power or current, voltage, and supply type.
- Calculate design current for supported conditions.
- Enter distance, installation method, temperature, and grouping.
- Size copper conductors with 70 °C PVC insulation for MVP-supported conditions.
- Evaluate conductor size by ampacity and voltage drop.
- Present a candidate circuit breaker with pending checks clearly identified.
- Compare a shared-conduit option with an independent-conduit option when sufficient data is available.
- Record essential information about the existing installation.
- Display alerts, blockers, and open items.
- Generate a preliminary materials list.
- Export the plan as a PDF.

**P1 — Desirable if it does not jeopardize launch**

- Duplicate existing installations.
- View explanations of the applied criteria.
- Save the last set of technical preferences confirmed by the user.
- Work offline after the initial application load.

### 4.2 Out of scope for the MVP

- Complete residential electrical projects.
- Floor plans and single-line diagrams.
- Feeder and service-entrance sizing.
- Automatic calculation of residential demand.
- Complete short-circuit, loop-impedance, and selectivity calculations.
- Automatic assessment of the entire existing panel's compliance.
- Automatic sizing of existing conduits without an occupancy survey.
- Sizing motors, air conditioners, inverters, and unsupported load types.
- Three-phase circuits.
- Aluminum conductors and other insulation families.
- Price-based estimates.
- Customer records synchronized to the cloud.
- Conversational artificial intelligence.
- Equipment recognition from photographs.
- Issuing ART (technical responsibility records), reports, or certifications.

**Scope principle:** The first version does a good job of sizing a simple final circuit and helping identify open items. It does not attempt to automatically solve every aspect of an electrical installation.

---

## 5. Primary user journey

The flow consists of a home screen, three data-entry steps, and a results screen.

### Screen 1 — Home

**Goal:** Start or resume a plan.

Elements:

- Primary button (PT-BR UI copy): “Nova instalação”.
- List of saved installations.
- Equipment name.
- Last edited date.
- Plan status.

Actions:

- Create an installation.
- Open an installation.
- Edit an installation.
- Delete an installation after confirmation.

An account is not required to use the MVP.

### Screen 2 — Equipment

**Goal:** Collect the data needed to determine load current.

| Field | Type | Behavior |
|---|---|---|
| Equipment | Selector | Oven, electric shower, resistive heating, other |
| Rated power | Numeric, W | Alternative to rated current |
| Rated current | Numeric, A | Preferred when available on the nameplate |
| Rated voltage | Selector | 127 V, 220 V, or another supported value |
| Supply | Selector | Line-to-neutral or line-to-line |
| Connection type | Selector | Receptacle, direct connection, not verified |
| Load behavior confirmation | Selector | Resistive or unconfirmed |

Interface rules:

- Show dependent fields only when needed.
- Calculate and display estimated current immediately.
- Flag material inconsistencies if both power and current are entered.
- Equipment manual and nameplate requirements take precedence over generic application values.
- Loads outside the scope do not receive automatic sizing.

**Screen output:** Preliminary design current and equipment identification.

### Screen 3 — Circuit route

**Goal:** Collect the parameters that affect conductor sizing.

| Field | Type | Behavior |
|---|---|---|
| Distance from panel to equipment | Number in meters | One-way length |
| Installation method | Selector | Methods approved for the MVP |
| Conduit | Selector | Independent or shared |
| Other grouped circuits | Number | Shown for a shared conduit |
| Ambient temperature | Selector | Known value or pending |
| Conductors | Fixed for MVP | Copper, 70 °C PVC |
| Grouping information | Confirmation | Enough detail to apply the factor |

For the first version, installation method B1 is the primary approved scenario. Other methods may be shown as unsupported until their rules are implemented and validated.

The application must not automatically classify an environment as 30 °C without confirmation. If an assumption is used for a preview, the assumed value must be displayed and verification must remain open.

**Behavior:** Sizing updates whenever a relevant parameter changes.

### Screen 4 — Panel and safety

**Goal:** Record information that cannot be determined from power and distance alone.

Fields:

- Main circuit breaker: known value or not verified.
- Physical space available in the panel: yes, no, not verified.
- Protective conductor and grounding: verified or pending.
- RCD (DR) protection: present, planned, or pending assessment.
- Supply and panel capacity: verified or pending.
- Short-circuit conditions and protective-device suitability: verified or pending.
- Equipment manual and connection method: checked or pending.

These fields record checks performed by the professional; they are not automatic calculations.

If a check has not been performed, the application allows the user to continue, but the open item remains visible in the results.

### Screen 5 — Results

**Goal:** Bring calculation results and installation planning together.

The screen will present five sections.

**A. Summary**

- Equipment.
- Power.
- Voltage.
- Current.
- Distance.
- Plan status.

**B. Sizing**

- Preliminary active-conductor size.
- Protective conductor size.
- Candidate circuit breaker.
- Applicable or pending residual-current protection.
- Corrected ampacity.
- Calculated voltage drop for the circuit segment.
- Assumptions and criteria used.

**C. Alternatives**

When technically possible:

- Solution using a shared conduit.
- Solution using an independent conduit.

The tool presents differences, limitations, and required checks without claiming an option is feasible when data is still missing.

**D. Open items and required upgrades**

A list of items that need to be checked or corrected.

**E. Materials**

A preliminary list with estimated quantities and items that have not yet been specified.

Available actions:

- Edit information.
- Change the selected alternative.
- Record completed checks.
- Generate a PDF.
- Save the plan.

---

## 6. Functional requirements

### FR-01 — Installation management

The user can create, save, edit, and delete plans.

**Acceptance criteria:**

- Each installation receives a unique identifier.
- Data is preserved when the application is closed and reopened on the same device, within supported storage conditions.
- Changes to calculation inputs automatically invalidate old results.
- Deletion requires confirmation.

### FR-02 — Current calculation

For a single-phase resistive load under supported conditions:

**Ib = P / V**

Where:

- Ib = design current, in A.
- P = rated power, in W.
- V = rated voltage, in V.

If reliable rated current is available, it takes priority.

**Acceptance criteria:**

- Calculation runs automatically.
- Units are displayed correctly.
- Invalid inputs are rejected.
- The calculation is not indiscriminately applied to motors or loads with unknown characteristics.

### FR-03 — Conductor sizing

The system determines preliminary conductor size based on supported criteria from ABNT NBR 5410, considering:

- Reference current-carrying capacity.
- Installation method.
- Number of loaded conductors.
- Temperature.
- Grouping.
- Applicable minimum cross-sectional area.
- Voltage drop.

The selected size must satisfy all calculable criteria at the same time.

**Acceptance criteria:**

- Each applied factor can be inspected.
- The criterion that determined the size can be identified.
- The size cannot be reduced below the applicable minimum.
- No automatic recommendation is made if required parameters are missing or the case falls outside approved tables.
- The calculation records the version of the normative data used.

### FR-04 — Overcurrent protection

The application presents a candidate circuit breaker when the parameters allow preliminary selection.

Overload coordination will consider:

**Ib ≤ In ≤ Iz**

and, where applicable, the condition related to the device's conventional operating current.

Where:

- Ib = design current.
- In = device rated current.
- Iz = corrected conductor current-carrying capacity.

**Acceptance criteria:**

- The candidate circuit breaker cannot exceed the conductor's corrected capacity.
- Selection considers supported commercial ratings.
- Trip curve, breaking capacity, prospective short-circuit current, and disconnection conditions must be checked.
- Without these checks, protection remains preliminary.
- The application does not automatically choose a trip curve without the necessary information.

### FR-05 — Voltage drop

The application calculates the estimated voltage drop of the new circuit under supported conditions.

**Acceptance criteria:**

- The calculation uses the entered one-way length.
- The result is shown in volts and as a percentage of rated voltage.
- The calculation model, electrical parameters, and assumptions are recorded.
- The system distinguishes the calculated segment's voltage drop from the installation's total voltage drop.
- If total voltage drop cannot be verified, this remains an open item.

### FR-06 — Circuit grouping

When conduits are shared, the application applies the grouping factor that corresponds to approved conditions.

**Acceptance criteria:**

- The number of circuits affects sizing.
- The calculation updates when that number changes.
- Grouping cases without sufficient information or outside the supported model remain pending.
- The physical fill of an existing conduit is not assumed to be adequate.

### FR-07 — Solution comparison

The user can compare the sizing of:

- A circuit in an independent conduit.
- A circuit in a shared conduit.

**Acceptance criteria:**

- Each alternative has its own results.
- Changing the alternative recalculates the circuit.
- A solution without sufficient physical verification is identified as preliminary.
- The selected alternative appears in the report.

### FR-08 — Checks and open items

The application records known information, unverified information, and identified incompatibilities.

**Acceptance criteria:**

- Every missing critical detail creates an open item.
- A known incompatibility prevents the plan from being classified as validated.
- The application explains each open item.
- The user can update information and recalculate.
- There is no action that silently ignores a technical blocker.

### FR-09 — Materials list

The list is generated based on the selected alternative.

Initially supported items:

- Active conductors.
- Protective conductor.
- Candidate circuit breaker.
- RCD (DR), when planned.
- Receptacle or connection components, when specifiable.
- Conduit and accessories, when sufficient data is available.

**Acceptance criteria:**

- Conductor quantities account for the number of runs and an identified, configurable allowance.
- Estimated values are distinguished from confirmed values.
- Components without enough specification appear as “To be defined.”
- The list updates automatically after relevant changes.

### FR-10 — PDF export

The user can generate a planning report.

**Minimum content:**

- Installation identifier and date.
- Equipment data.
- Route data.
- Sizing results.
- Selected alternative.
- Assumptions used.
- Checks performed.
- Existing open items.
- Preliminary materials list.
- Calculation engine version and normative reference version.

The document must clearly state that it does not, by itself, constitute a compliance report or installation certification.

---

## 7. Calculation engine and technical rules

### 7.1 Logical architecture

The calculation engine will be separate from the graphical interface.

It must accept structured data and return:

- Calculated values.
- Candidate components.
- Applied rules.
- Assumptions used.
- Input errors.
- Open items.
- Incompatibilities.
- Rules-version identifier.

This separation is required to support automated testing, auditing, and normative updates.

### 7.2 Normative basis

The primary reference will be ABNT NBR 5410, in the edition applicable at launch.

The product must also consider:

- Applicable NR-10 requirements.
- Relevant product standards for conductors, protective devices, and connections.
- Manufacturer specifications.
- Utility requirements when relevant to assessment of the supply.

Implemented tables and rules must be obtained and verified from authorized normative sources, respecting document usage rights.

The standard version and implementation review date will be recorded.

### 7.3 Safety rules

The engine must follow these principles:

1. Do not assume an existing installation is adequate.
2. Do not interpret missing information as approval.
3. Do not recommend configurations that conflict with known conditions.
4. Do not use an unconfirmed calculation assumption to declare the plan validated.
5. Do not claim full compliance with ABNT NBR 5410 when only some criteria have been assessed.
6. Do not recommend a receptacle or connection that conflicts with the manual or applicable requirements.
7. Do not automatically size situations outside the approved scope.
8. Recalculate and reassess open items whenever data changes.

### 7.4 Plan states

The application will use four states.

**Draft:** There is not enough data to perform the calculation.

**Preliminary sizing:** Results have been calculated, but assumptions or checks remain unconfirmed.

**Plan blocked:** A known incompatibility prevents execution of the current alternative.

**Plan validated for execution preparation:** All criteria covered by the application have passed, and required external checks have been recorded by the professional.

The last state does not certify the installation's overall safety. Installation and final testing remain the responsibility of a competent professional.

---

## 8. Expected behavior example

### Case: residential electric oven

**Inputs**

- Equipment: electric oven.
- Power: 3,500 W.
- Voltage: 220 V.
- Supply: line-to-line.
- Connection: 20 A receptacle, as specified in the manual.
- Distance: 12 m.
- Method: B1, confirmed.
- Conductors: copper, 70 °C PVC.
- Temperature: 30 °C, confirmed.
- Conduit: independent.
- Grouping: no other circuits.
- Two loaded conductors.

**Processing**

1. Calculate an approximate current of 15.9 A.
2. Look up current-carrying capacity for the approved scenario.
3. Apply correction factors.
4. Evaluate candidate sizes and minimum conductor size.
5. Check voltage drop.
6. Perform a preliminary overload-protection coordination check.
7. Identify any external checks still required.

**Expected preliminary result**

- Phase conductors: 2.5 mm².
- PE conductor: 2.5 mm², subject to applicable conditions.
- Candidate circuit breaker: 20 A, two-pole.
- Residual-current protection: selection and need to be verified for the application.
- Voltage drop: calculated and displayed.
- Short-circuit protection: pending verification.
- Existing supply capacity: pending verification.

The application must not present this result as full approval of the installation.

### Scenario change

The user changes the route to a conduit shared with two other circuits.

**Expected behavior:**

- The grouping factor is updated.
- Corrected current-carrying capacity is recalculated.
- The application reassesses the proposed conductor size.
- The previous size may no longer meet requirements.
- The result shows the new candidate size and the need to check conduit fill.
- The report records the change and open items.

---

## 9. User experience requirements

### UX principles

**Few fields per screen.** Advanced technical information appears only when relevant.

**Immediate calculations.** The user does not need to navigate to a report to see the result.

**Practical language.** Technical terms are accompanied by short explanations.

**Transparency.** Calculated values, assumptions, and confirmed information are distinguishable.

**No conversation interface.** There will be no simulated assistant messages or chat interface.

**Avoid alert overload.** Open items are grouped and prioritized by importance.

### Interface

- Prioritize use on phone screens.
- Use appropriate keyboards for numeric fields.
- Provide selectors for common options.
- Keep units visible.
- Highlight the primary action for each step.
- Allow users to go back without losing information.
- Show error messages next to relevant fields.
- Allow editing directly from the results screen.

### Navigation

Primary flow:

Home → Equipment → Route → Panel and safety → Results → Export.

Calculable results may be shown before all checks are complete, provided their status is clearly identified.

---

## 10. Non-functional requirements

### Platform

Responsive web application, with an architecture ready for installation as a PWA.

### Performance

- Update calculations in less than 1 second on target devices.
- Navigate without a full page reload.
- Work well on mid-range Android smartphones and modern browsers.

### Storage

- Store data locally in the first version.
- Authentication is not required.
- Inform users about the risk of data loss when clearing browser data or switching devices.
- Make result export available without registration.

### Privacy

- Do not require customer personal data to perform calculations.
- Do not transmit installation information to servers without need and notice.
- Collect usage metrics only with appropriate privacy mechanisms.

### Quality and reliability

- Unit tests for all calculation rules.
- Reference cases reviewed by a qualified professional.
- Version control for the rules.
- Explicit handling of values outside supported ranges.
- Regression tests after any normative or technical change.

---

## 11. Product acceptance criteria

The MVP is ready for pilot when the following scenarios pass.

| Scenario | Expected result |
|---|---|
| Resistive oven with complete data and independent circuit | Preliminary sizing is calculated |
| Circuit distance increases | Voltage drop is recalculated and size is reassessed |
| Three grouped circuits | Corresponding factor applied under approved conditions |
| Cable capacity insufficient for the protective device | Combination rejected |
| Critical information unknown | Open item visible, with no automatic approval |
| Unsupported installation method | Automatic sizing blocked |
| Non-resistive load or unknown behavior | Routed to analysis outside the MVP |
| Existing supply not verified | Plan remains preliminary |
| Power or voltage changes | All dependent results updated |
| Export with open items | PDF clearly identifies the open items |

In addition to these tests, the approved calculation set must be compared with independent examples and technically reviewed before the pilot.

---

## 12. Dependencies and risks

### Risk 1 — Incorrect interpretation of standards

**Mitigation:** Review by a qualified electrical engineer, traceability matrix between requirements and normative criteria, and use of authorized documentation.

### Risk 2 — False sense of security

**Mitigation:** Separate calculated results from external checks, keep open items explicit, and never produce a generic “safe installation” badge.

### Risk 3 — Excessive interface complexity

**Mitigation:** Reveal advanced fields only when needed and test the flow with electricians who have not used the product before.

### Risk 4 — Incorrect user-provided data

**Mitigation:** Validate inputs, confirm critical parameters, and record the assumptions used.

### Risk 5 — Excessive scope expansion

**Mitigation:** Restrict the MVP to essentially resistive loads and approved installation methods. Other scenarios must be rejected or treated as unsupported until specific rules are implemented.

---

## 13. Proposed development plan

### Phase 1 — Technical foundation

Deliverables:

- Data model.
- Calculation engine isolated from the interface.
- Initial approved tables and rules.
- Automated tests.
- State and open-item model.

**Gate to proceed:** Technical approval of implemented calculations.

### Phase 2 — Primary flow

Deliverables:

- Home screen.
- Equipment form.
- Route form.
- Panel and safety form.
- Sizing and open-items screen.
- Local persistence.

**Gate to proceed:** Complete journey works on a phone.

### Phase 3 — Planning and export

Deliverables:

- Comparison of supported alternatives.
- Preliminary materials list.
- PDF report.
- Installation history.

**Gate to proceed:** Results are reproducible, traceable, and exportable.

### Phase 4 — Field validation

Deliverables:

- Testing with electricians.
- Usability issue fixes.
- Final technical review.
- Validation of error and blocking cases.
- Pilot release preparation.

**Launch gate:** No critical calculation or safety-classification defects identified in approved tests.

---

## 14. Product decisions

The following decisions are established to keep the MVP viable:

1. **A sizing and planning product**, not a complete electrical project tool.
2. **A form-based interface**, not a chatbot.
3. **One circuit per plan.**
4. **An initial load set limited to essentially resistive equipment.**
5. **A Brazilian normative basis, versioned and technically approved.**
6. **A mobile-first web application with no required login.**
7. **Preliminary results available even with external open items**, provided there is enough data for the calculations.
8. **No automatic safety approval of the existing installation.**
9. **A materials list and PDF report included in the MVP.**
10. **Expansion to methods, equipment, and calculations only after the initial core is validated.**

---

## 15. Definition of success

The MVP will be considered successful when an electrician can, during a residential visit:

- Open the application without registering.
- Enter equipment data.
- Describe a circuit route.
- Obtain technically traceable results.
- Identify incompatibilities and pending checks.
- Compare supported alternatives.
- Review a preliminary materials list.
- Save and export the plan.

**The product succeeds when it turns field information into a clear, verifiable electrical plan without hiding calculation limitations or requiring the complexity of traditional engineering software.**
