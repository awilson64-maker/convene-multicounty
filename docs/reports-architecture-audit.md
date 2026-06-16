# CONVENE Reports Architecture Audit

Status: updated after Phase 3D  
Last updated: 2026-06-16  
Repository: awilson64-maker/convene-multicounty

## Purpose

This document records the current Reports architecture after the Phase 3 cleanup work. Reports are working, but they still use a layered helper structure. This audit explains what is currently active, what was intentionally retired from runtime loading, and what should be cleaned later.

This document is architecture documentation only. It does not change the live app.

## Current loader order

Reports-related helpers are loaded through `js/app-loader.js` after the core app and other helper scripts.

Current reports load order:

1. `js/reports-v2.js`
2. `js/reports-standard-router.js`
3. `js/reports-filter-repair.js`
4. `js/reports-gap-sort-fix.js`
5. `js/reports-chart-sort.js`
6. `js/reports-need-layer.js`

Important note:

`js/reports-gap-action-priority.js` still exists in the repository for reference and rollback context, but it is no longer loaded by `js/app-loader.js`.

## Current report ownership

### `js/reports-v2.js`

Current role:

- Installs the Reports nav item.
- Creates the Reports view and base report builder UI.
- Adds report styles.
- Defines original report types:
  - County Ecosystem Snapshot
  - Focus Area Report
  - Geographic Access / Gap Report
  - Partner Engagement Report
  - Relationship / Network Report
  - Data Quality Report

Current risk:

- It still contains older generation behavior that has been superseded by later helpers.
- It remains the base UI owner, but it is not the only report behavior owner.

### `js/reports-standard-router.js`

Current role:

- Officially owns non-gap report generation.
- Intercepts Generate Report for all report types except `gap`.
- Builds ecosystem, focus, engagement, network, and quality reports.
- Handles HTML export for standard reports when it has generated the report output.

Current risk:

- It duplicates some helper logic that also exists in `reports-v2.js`.
- Standard reports still depend on event interception order.

### `js/reports-filter-repair.js`

Current role:

- Repopulates service type and focus tag filters from active county storage.
- Pulls service types from real organization `type` values.
- Also includes options already present in the organization Type dropdown.
- Runs on timeouts, county changes, Reports nav clicks, and periodic polling while Reports is active.

Current risk:

- The polling approach is stable but not elegant.
- This should eventually be folded into the official Reports initialization path.

### `js/reports-gap-sort-fix.js`

Current role:

- Post-render sort helper for older report table behavior.
- Kept temporarily while reports remain layered.

Current risk:

- It modifies output after generation.
- It depends on DOM structure and report wording.

### `js/reports-chart-sort.js`

Current role:

- Post-render chart sorting and light polish.

Current risk:

- It also depends on generated DOM structure.
- It should eventually be folded into report generation rather than run after the fact.

### `js/reports-need-layer.js`

Current role:

- Officially owns Geographic Access / Gap Report generation.
- Adds and manages the Need layer control.
- Intercepts Generate Report when report type is `gap`.
- Handles print/export for gap report output.
- Uses the corrected Phase 3D priority model:

```text
final gap priority = relative need x access gap
```

Why this matters:

- A high-need tract with a very close matching asset is no longer treated as a top geographic access gap.
- Such a tract may still deserve attention, but as a capacity, eligibility, outreach, hours, or coordination question rather than a distance/access gap.

## Retired from runtime loading

### `js/reports-gap-action-priority.js`

Current status:

- File remains in repo.
- File is not loaded by `js/app-loader.js`.
- It should not control live gap report behavior.

Reason:

- It duplicated the gap report engine.
- It competed with `reports-need-layer.js` for the same Generate Report button.
- Phase 3B made `reports-need-layer.js` the official gap engine.

## Completed Phase 3 work

### Phase 3A

Added this architecture audit.

### Phase 3B

Stopped loading the duplicate gap report engine.

### Phase 3C

Aligned Reports service-type filters with real organization Type values.

### Phase 3D

Changed gap priority from a weighted blend to an interaction score.

Old model:

```text
60% relative need + 40% access gap
```

Problem:

- Very high need could keep a tract ranked high even when a matching asset was very close.

Current model:

```text
relative need x access gap
```

Effect:

- A tract must have both meaningful need and weak geographic access to rank high.

## Current architectural issues

### 1. Reports are still layered

Reports currently work, but the architecture still relies on helpers loaded after the base app.

### 2. Standard and gap reports have separate owners

- Standard reports: `reports-standard-router.js`
- Gap reports: `reports-need-layer.js`

This is acceptable for now, but should eventually be simplified.

### 3. Filter repair still uses polling

`reports-filter-repair.js` works, but polling should eventually be replaced by a direct Reports initialization or refresh hook.

### 4. Post-render fixes still exist

`reports-gap-sort-fix.js` and `reports-chart-sort.js` still patch generated output after rendering.

That is stable for now, but not ideal long-term.

### 5. Coalitions are not yet summarized in Reports

Coalitions are official storage and have a basic UI, but Reports do not yet summarize coalition activity or membership.

This is acceptable. Do not add coalition reporting until the report architecture is simpler.

## Recommended next report cleanup

Do not rewrite Reports all at once.

Recommended future sequence:

1. Fold `reports-filter-repair.js` into the official Reports initialization path.
2. Move chart and table sorting into report generation instead of post-render helpers.
3. Decide whether `reports-v2.js` or `reports-standard-router.js` should own standard reports.
4. Only then consider deleting retired report helper files.

## Current smoke test checklist

Before merging future report code:

1. Open Reports.
2. Confirm report filters populate with detailed organization Type values.
3. Generate County Ecosystem Snapshot.
4. Generate Focus Area Report.
5. Generate Partner Engagement Report.
6. Generate Relationship / Network Report.
7. Generate Data Quality Report.
8. Generate Geographic Access / Gap Report with:
   - service type selected
   - need layer selected
   - charts on
   - org list on
9. Confirm known nearby-asset tracts do not rank as top geographic gaps.
10. Confirm print still opens.
11. Confirm Export HTML still downloads.
12. Confirm Organizations, Coalitions, Map, Census Gap Lens, Backup/Export, and CSV preview still load.
