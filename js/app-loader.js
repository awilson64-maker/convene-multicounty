(() => {
  if (window.__conveneAppLoaderLoaded) return;
  window.__conveneAppLoaderLoaded = true;

  const scripts = [
    ['js/startup-splash.js', 'data-convene-startup-splash', '__conveneStartupSplashLoaded'],
    ['js/start-here-card.js', 'data-convene-start-here', '__conveneStartHereLoaded'],
    ['js/org-type-control.js', 'data-convene-org-type-control', '__conveneOrgTypeControlLoaded'],
    ['js/org-focus-tags.js', 'data-convene-focus-tags', '__conveneOrgFocusTagsLoaded'],
    ['js/org-tag-clickfix.js', 'data-convene-focus-clickfix', '__conveneOrgTagClickFixLoaded'],
    ['js/focus-tag-cleanup.js', 'data-convene-focus-cleanup', '__conveneFocusTagCleanupLoaded'],
    ['js/compact-list-style.js', 'data-convene-compact-list-style', '__conveneCompactListStyleLoaded'],
    ['js/org-list-controls.js', 'data-convene-org-list-controls', '__conveneOrgListControlsLoaded'],
    ['js/backup-export-tools.js', 'data-convene-backup-export-tools', '__conveneBackupExportToolsLoaded'],
    ['js/bulk-csv-import-aliases.js', 'data-convene-bulk-csv-import-aliases', '__conveneBulkCsvImportAliasesLoaded'],
    ['js/coalitions-ui.js', 'data-convene-coalitions-ui', '__conveneCoalitionsUiLoaded'],
    ['js/reports-v2.js', 'data-convene-reports', '__conveneReportsV2Loaded'],
    ['js/reports-standard-router.js', 'data-convene-reports-standard-router', '__conveneReportsStandardRouterLoaded'],
    ['js/reports-filter-repair.js', 'data-convene-reports-filter-repair', '__conveneReportsFilterRepairLoaded'],
    ['js/reports-gap-action-priority.js', 'data-convene-gap-action-priority', '__conveneGapActionPriorityLoaded'],
    ['js/reports-gap-sort-fix.js', 'data-convene-gap-sort-fix', '__conveneGapSortFixLoaded'],
    ['js/reports-chart-sort.js', 'data-convene-reports-chart-sort', '__conveneReportsChartSortLoaded'],
    ['js/reports-need-layer.js', 'data-convene-reports-need-layer', '__conveneReportsNeedLayerLoaded']
  ];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadHelpers);
  else loadHelpers();

  function loadHelpers() {
    scripts.forEach(item => loadScriptOnce(item[0], item[1], item[2]));
  }

  function loadScriptOnce(src, attr, flagName) {
    if (document.querySelector('script[' + attr + ']') || (flagName && window[flagName])) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, 'true');
    document.body.appendChild(script);
  }
})();