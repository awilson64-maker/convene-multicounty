# CONVENE Reports Architecture Audit

Status: Phase 3A draft  
Last updated: 2026-06-16  
Repository: awilson64-maker/convene-multicounty

## Purpose

This document audits the current Reports implementation before any consolidation work. Reports are working, but they are currently assembled through several layered helper scripts. The purpose of Phase 3A is to understand that stack before changing it.

This is documentation only. It does not change the live app.

## Current loader order

Reports-related helpers are loaded through `js/app-loader.js` after the core app and other helper scripts.

Current reports load order:

1. `js/reports-v2.js`
2. `js/reports-standard-router.js`
3. `js/reports-filter-repair.js`
4. `js/reports-gap-action-priority.js`
5. `js/reports-gap-sort-fix.js`
6. `js/reports-chart-sort.js`
7. `js/reports-need-layer.js`

This order matters because several scripts intercept the same report buttons and patch the same report output after generation.

## Script ownership audit

### `js/reports-v2.js`

Current role:

- Installs the Reports nav item.
- Creates the Reports view and base report builder UI.
- Adds report styles.
- Adds base Generate, Reset, Print, and Export behavior.
- Defines original report types:
  - County Ecosystem Snapshot
  - Focus Area Report
  - Geographic Access / Gap Report
  - Partner Engagement Report
  - Relationship / Network Report
  - Data Quality Report
- Loads report filters from workspace data.
- Generates base report HTML.

Risk:

- It is no longer the only report generator.
- Later scripts intercept the same Generate and Export buttons.
- Some report logic in this file has been superseded by later helpers but still remains present.

### `js/reports-standard-router.js`

Current role:

- Intercepts clicks on `#generateReportBtn` for non-gap reports.
- Uses capture-phase event handling and `stopImmediatePropagation()`.
- Rebuilds ecosystem, focus, engagement, network, and quality reports.
- Intercepts HTML export for non-gap reports when it has its own `state.lastHtml`.

Risk:

- Duplicates much of the report generation logic from `reports-v2.js`.
- Uses its own workspace loading, normalization, settings parsing, shell, tables, metrics, and chart helpers.
- Makes the Reports behavior depend on click interception order.

### `js/reports-filter-repair.js`

Current role:

- Repopulates service type and focus tag filters from storage.
- Runs on timeouts, interval polling, county changes, and reports nav clicks.
- Falls back to direct localStorage scanning if normal storage loading fails.

Risk:

- Uses recurring polling to patch filters.
- May hide an underlying timing/order problem in the base report UI.
- Duplicates active county and organization loading logic.

### `js/reports-gap-action-priority.js`

Current role:

- Adds a Need layer control for gap reports.
- Intercepts Generate clicks when report type is `gap`.
- Builds a gap report using an action-priority model.
- Provides need-layer options such as poverty, no vehicle, senior access, housing pressure, digital access, language access, and related composite scores.

Risk:

- It overlaps heavily with `reports-need-layer.js`.
- It also intercepts gap report generation.
- It has its own workspace loading, census parsing, metric options, need scoring, access scoring, tables, charts, and report shell.

### `js/reports-gap-sort-fix.js`

Current role:

- Polls the report output every 900ms.
- Finds the Geographic Access / Gap Report table.
- Re-sorts the recommended focus order table after the report has already been generated.

Risk:

- It is a post-render DOM fix instead of report-generation logic.
- It depends on report headings, table column positions, and category text.
- It can silently fail if report wording or table structure changes.

### `js/reports-chart-sort.js`

Current role:

- Adds small report styling polish.
- Sorts bar chart rows by count after generation.
- Runs on DOMContentLoaded, Generate click timeouts, and interval polling.

Risk:

- Another post-render DOM patch.
- Uses interval polling.
- Depends on `.chart-box`, `.bar-row`, and `<b>` count structure.

### `js/reports-need-layer.js`

Current role:

- Adds a Need layer control for gap reports.
- Intercepts Generate clicks when report type is `gap`.
- Builds the current need-layer gap report.
- Intercepts Print and Export for gap report output when its own gap HTML exists.
- Uses a need/access priority model and supports several Census signal options.

Risk:

- It overlaps with `reports-gap-action-priority.js`.
- It probably represents the newer gap report behavior, but both scripts are still loaded.
- Like the other report helpers, it carries its own workspace loading and normalization logic.

## Main architectural issues

### 1. Multiple scripts own Generate Report

At least three scripts participate in Generate behavior:

- `reports-v2.js`
- `reports-standard-router.js`
- `reports-gap-action-priority.js`
- `reports-need-layer.js`

The current behavior depends on event interception order and `stopImmediatePropagation()`.

### 2. Gap reports have duplicate engines

Both `reports-gap-action-priority.js` and `reports-need-layer.js` can build gap reports and add/handle a Need layer control.

This is the highest-priority Phase 3B cleanup target.

### 3. Post-render fixes are doing report-engine work

`reports-gap-sort-fix.js` and `reports-chart-sort.js` modify report output after generation.

That works as a bridge, but it is fragile because it depends on DOM structure after the fact.

### 4. Workspace loading is duplicated

Several scripts define their own versions of:

- active county lookup
- workspace loading
- organization normalization
- activity normalization
- relationship normalization
- date filtering
- tag parsing
- chart helpers
- table helpers

This increases the chance that reports disagree with each other or fail differently.

### 5. Coalitions are not yet part of Reports

Phase 2B and 2C made coalitions official storage and added a Coalitions UI. Reports do not yet summarize coalitions.

That is acceptable for now. Do not add coalition reporting during Phase 3B unless the reports engine is first stabilized.

## What should not be changed first

Do not start Phase 3B by rewriting every report file into one giant script.

That would be too risky because Reports currently work and are useful. A full rewrite would touch report routing, filters, charts, export, print, gap logic, census parsing, and UI all at once.

## Recommended Phase 3B plan

Phase 3B should be small and focused:

### Phase 3B target: choose one official gap report engine

Recommendation:

- Keep `reports-need-layer.js` as the official gap report engine.
- Retire or disable `reports-gap-action-priority.js` after confirming all useful logic has already been carried forward.
- Keep `reports-gap-sort-fix.js` temporarily only if it is still needed after the official gap engine is confirmed.

Why this target first:

- It removes the most dangerous duplicate ownership.
- It avoids changing all report types at once.
- It has a clear smoke test: generate a gap report using service/focus and need layer.

### Phase 3C target: fold filter repair into Reports bootstrap

After gap routing is cleaned up:

- Move the useful filter loading behavior from `reports-filter-repair.js` into the official reports initialization path.
- Remove interval polling if possible.
- Keep timeout-based retry only if needed for helper-script timing.

### Phase 3D target: move post-render chart/sort fixes into report generation

After routing and filters are stable:

- Sort chart data before rendering charts.
- Sort gap tables before rendering tables.
- Remove polling-based post-render fixes.

### Phase 3E target: standard reports consolidation

Finally:

- Decide whether `reports-v2.js` or `reports-standard-router.js` is the official standard report engine.
- Keep one owner for ecosystem, focus, engagement, network, and quality reports.
- Remove duplicate shell/table/chart/workspace helpers where safe.

## Phase 3B smoke test checklist

Before merging any Phase 3B code:

1. Open Reports.
2. Confirm report filters populate.
3. Generate County Ecosystem Snapshot.
4. Generate Focus Area Report.
5. Generate Partner Engagement Report.
6. Generate Relationship / Network Report.
7. Generate Data Quality Report.
8. Generate Geographic Access / Gap Report with:
   - service type selected
   - focus tag selected, if available
   - need layer selected
   - charts on
   - org list on
9. Confirm print still opens.
10. Confirm Export HTML still downloads.
11. Confirm Organizations, Coalitions, Map, Census Gap Lens, Backup/Export, and CSV preview still load.

## Phase 3A status

Started on branch:

```text
phase-3a-reports-audit
```

Phase 3A should be merged before any report code consolidation begins.
