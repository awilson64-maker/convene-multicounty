(() => {
  if (window.__conveneAppLoaderLoaded) return;
  window.__conveneAppLoaderLoaded = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHelpers);
  } else {
    loadHelpers();
  }

  function loadHelpers() {
    loadStartupSplashHelper();
    loadStartHereHelper();
    loadOrgTypeHelper();
    loadFocusTagHelper();
    loadCompactListHelper();
    loadOrgListControlsHelper();
    loadBackupExportToolsHelper();
    loadBulkCsvImportAliasHelper();
    loadReportsHelper();
  }

  function loadStartupSplashHelper() {
    loadScriptOnce('js/startup-splash.js', 'data-convene-startup-splash', '__conveneStartupSplashLoaded');
  }

  function loadStartHereHelper() {
    loadScriptOnce('../js/start-here-card.js', 'data-convene-start-here', '__conveneStartHereLoaded');
  }

  function loadOrgTypeHelper() {
    loadScriptOnce('../js/org-type-control.js', 'data-convene-org-type-control', '__conveneOrgTypeControlLoaded');
  }

  function loadFocusTagHelper() {
    loadScriptOnce('../js/org-focus-tags.js', 'data-convene-focus-tags', '__conveneOrgFocusTagsLoaded');
    loadScriptOnce('../js/org-tag-clickfix.js', 'data-convene-focus-clickfix', '__conveneOrgTagClickFixLoaded');
    loadScriptOnce('../js/focus-tag-cleanup.js', 'data-convene-focus-cleanup', '__conveneFocusTagCleanupLoaded');
  }

  function loadCompactListHelper() {
    loadScriptOnce('../js/compact-list-style.js', 'data-convene-compact-list-style', '__conveneCompactListStyleLoaded');
  }

  function loadOrgListControlsHelper() {
    loadScriptOnce('../js/org-list-controls.js', 'data-convene-org-list-controls', '__conveneOrgListControlsLoaded');
  }

  function loadBackupExportToolsHelper() {
    loadScriptOnce('../js/backup-export-tools.js', 'data-convene-backup-export-tools', '__conveneBackupExportToolsLoaded');
  }

  function loadBulkCsvImportAliasHelper() {
    loadScriptOnce('../js/bulk-csv-import-aliases.js', 'data-convene-bulk-csv-import-aliases', '__conveneBulkCsvImportAliasesLoaded');
  }

  function loadReportsHelper() {
    loadScriptOnce('../js/reports-v2.js', 'data-convene-reports', '__conveneReportsV2Loaded');
    loadScriptOnce('../js/reports-standard-router.js', 'data-convene-reports-standard-router', '__conveneReportsStandardRouterLoaded');
    loadScriptOnce('../js/reports-filter-repair.js', 'data-convene-reports-filter-repair', '__conveneReportsFilterRepairLoaded');
    loadScriptOnce('../js/reports-gap-action-priority.js', 'data-convene-gap-action-priority', '__conveneGapActionPriorityLoaded');
    loadScriptOnce('../js/reports-gap-sort-fix.js', 'data-convene-gap-sort-fix', '__conveneGapSortFixLoaded');
    loadScriptOnce('../js/reports-chart-sort.js', 'data-convene-reports-chart-sort', '__conveneReportsChartSortLoaded');
    loadScriptOnce('../js/reports-need-layer.js', 'data-convene-reports-need-layer', '__conveneReportsNeedLayerLoaded');
  }

  function loadScriptOnce(src, attr, flagName) {
    if (document.querySelector(`script[${attr}]`) || (flagName && window[flagName])) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, 'true');
    document.body.appendChild(script);
  }
})();
