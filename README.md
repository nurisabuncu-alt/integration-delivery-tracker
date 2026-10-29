# Integration Delivery Tracker

Browser app for Integration effort estimation by **quarter** and **user**.

The app has two top-level workspaces:

- **Estimator:** workflow-based effort, quarter capacity, and Work %
- **Compliance:** phase-aware delivery controls, evidence, overdue gates, and next actions
- **OKRs:** weighted quarterly objectives and key results with editable Rocketlane phase/task progress

## Open

```powershell
Start-Process "C:\Users\bnsab\data-ops-integrations-handbook\apps\story-point-estimator\index.html"
```

Hard-refresh (`Ctrl+F5`) after updates. Storage key: `integration-sp-estimator-v4`.

## Modes

### Quick (default)
- Inputs: Project, Assignee, Type, Status, Std / Cpx **workflows** (or Hours for Premium / Misc), Dependency, ERP go-live
- **Workflow count:** CRUD tasks for the same document = 1 workflow (e.g. Insert/Update/Cancel SO = 1; same for TO and PO)
- **Hour stack:** Generic-base phase rates × Std/Cpx/Ins → × Type (Generic 1 / Custom 1.15) → × Dependency → meetings. Set **Weeks** on the project and meetings are `(weeks − 2) × 0.5` weekly calls plus 1 h kickoff. Blank weeks keeps the 20% overhead. **Other** skips that stack: enter hours on each quarter. The selected quarter uses that quarter’s hours.
- **Calibrated workflow rates:** Mapping **1.3/2.6/3.9 h** and Package **3.9/7.8/11.7 h** for Standard/Complex/Insane; Adapt 2.1 h per workflow. These are Onur's corrected Jan–Oct 2026 medians per named workflow (Generic). Custom ×1.15 puts Package on the 4.5 h Custom median and Adapt on 2.4 h. Complex and Insane stay 2× and 3×. Project-level kickoff, shared design/UAT, go-live, and closure remain separate flat/overhead work.
- **Misc** works like Premium: enter total hours directly; no IMPACT phase model or meetings overhead
- **Import RL CSV:** Rocketlane time report (`ProjectName`, `TrackedTime` in hours). Multi-file OK. Imports **all** named projects (blank project names skipped). HubSpot↔Jira, Radial RFIL, and Logiwa IO Generic Setup import as **Misc** with planned hours starting at 0. Other delivery projects: Std workflows reverse-estimated from actual hours — review Type, Dependency, ERP.
- **Integrations Team Tasks:** entries are imported as special Misc projects grouped by topic and assignee: MindCloud & CData, Velociraptor, AI & Automation, Documentation & Enablement, Reviews & Planning, Integration Improvements, Monitoring & Support, Project Support, and General & Unspecified. Their usage follows the dated hours in each quarter. Annual leave, sick leave, and date-range leave entries are excluded; blank task names are retained under General & Unspecified.
- **Phase inclusion:** each time entry is mapped to an IMPACT phase — RL `PhaseName` first, then task-name keywords, then `CategoryName` (Development/Configuration/Setup → Package, Test → Adapt, Design/Analysis → Mapping). Only phases with logged time are included in the estimate; the rest are excluded (0 h). Guard: the filter is trusted when ≥50% of a project's build hours are phase-mappable (or the project is tiny); otherwise the full lifecycle is kept and the note says why. Toggle phases per project via the checkboxes in the phase panel — reverse-estimated Std workflows and hours respect the included set.
- **Build vs overhead hours:** `Meeting`, `Team Meetings / 1-1s`, `Case Support` and `Email Support` categories count as overhead (covered by the project meeting allowance), not phase evidence.
- **Touchpoints:** a project with no delivery phase logged and under 5 h of build hours (weekly calls, intro meetings, CSM check-ins) is imported as **Misc** with hours = actual, instead of being costed as a full lifecycle. Change Type to Custom/Generic if it is really a delivery project.
- **Quarter attribution:** each phase is placed in the quarter where that phase's time was actually logged, so a project only appears in a quarter where it had real activity. Peak quarter is chosen from build hours (meetings don't count). Phases with no logged time fall back to a spread across the project's active build-hour span (early → first quarter, delivery → peak, go-live → last). Override any phase's quarter via the phase panel dropdowns.
- Outputs: Quarter hours, User %, Team %, and OKR weight. OKR weight is the project's allocated quarter hours divided by one person's quarter capacity (weekdays × 6 h), so the weights do not have to sum to 100%.
- Quarter focus presets: Full lifecycle / Design+Build / Build+Test / Go-live (splits phases across quarters without 6 dropdowns)
- Work % = share of **quarter hours**
- Capacity = **6 planning hours per weekday per person**; holidays and PTO are not deducted
- Dashboard: capacity by person, annual quarter outlook, IMPACT phase mix, and largest projects
- **Print report** produces a clean dashboard view for PDF or paper

### Full
- All SP attributes, per-phase quarter assignment, Total SP / Q SP columns, Config rates

## Project compliance

Compliance is linked to the existing estimator projects and saved in the same browser storage. Existing compliance dates, evidence links, statuses, and notes are kept. Portfolio updates only add projects that are not already present. Misc and Other projects start outside compliance scope; a project can be included or excluded from its Compliance profile. Cancelled projects are always reported as Excluded.

The nine controls are:

1. Rocketlane Project Plan
2. Integration Design Document
3. Design Sign-off
4. End-to-End Test Documentation
5. UAT Test Documentation
6. UAT / E2E Sign-off
7. Closure Sign-off
8. Timesheets
9. Project Status Calls

Each control supports a status, due date, completed date, evidence URL, and notes. Complete = 1 point, In progress = 0.5, and Not started = 0. `N/A` and controls due in a future IMPACT phase are excluded from the denominator.

- **Compliant:** 90–100%
- **Watch:** 70–89%
- **At Risk:** below 70%, or any critical control overdue

A non-recurring control is overdue when its due date has passed or the project has advanced beyond its required phase without completion. The portfolio is sorted by risk and shows one next required action per project. **Export compliance CSV** produces a governance-ready record with the project result and every control’s status, dates, evidence, and notes.

## OKRs

The OKR workspace follows the Q4 sample workbook structure: Objective, Key Result, Details, Goal, Achievement, Weight, Result, Feedback, Manager Review, Project Type, and five delivery progress columns.

- **Achievement** defaults to the average of only the delivery phases assigned to the OKR row's quarter. Project Management follows Initiate; Mapping follows Mapping; Design and Development follow Package; Proof of Delivery follows Adapt, Commence, and Transition. Phases assigned to another quarter remain visible but do not affect achievement or confidence. When no linked phase belongs to the quarter, confidence stays Not set and the row is excluded from the scored-weight denominator. Enter Achievement directly to use a manual value; clear the field to return to the quarter-phase average.
- **Weight** for a Rocketlane-linked row is that project's allocated quarter hours divided by one person's quarter capacity (weekdays × 6 h). It recalculates when projects or the quarter change. A row with no hours in the quarter has no weight. Manual rows keep the weight you type. The total does not have to be 100%.
- **Weighted result** is `min(Achievement ÷ Goal, 1) × Weight`. All users together can total more than 100% because each person is measured against their own quarter capacity.
- The starter Q4 sheet contains the 13 key results from `OKR Sample.xlsx`; all fields and phase percentages are editable.
- Link a row to an existing Rocketlane project or add all projects active in the selected quarter.
- Filter the OKR sheet and its summary metrics by owner.
- **Sync linked projects** uses phase status and task completion. A completed phase is 100%; otherwise its tasks are averaged (Complete 100%, In progress 50%, To do 0%). Design tasks are classified separately by task name.
- The API key is used only in the sync request and is cleared afterward. It is not stored with tracker data.
- Confidence, evidence, feedback, and manager review support regular OKR check-ins. **Export CSV** creates a review-ready quarterly record.

## Companion

Excel: `templates/Integration-Story-Point-Effort-Estimator.xlsx`
