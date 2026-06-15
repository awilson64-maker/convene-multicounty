(() => {
  const state = {
    stack: [],
    suppressNextNavRecord: false
  };

  document.addEventListener('DOMContentLoaded', () => {
    installBackButton();
    installNavigationTracker();
    loadStartHereHelper();
    loadOrgTypeHelper();
    loadFocusTagHelper();
    loadReportsHelper();
    updateBackButton();
  });

  function installBackButton() {
    if (document.getElementById('conveneBackButton')) return;
    const actions = document.querySelector('.topbar-actions');
    if (!actions) return;

    const button = document.createElement('button');
    button.id = 'conveneBackButton';
    button.type = 'button';
    button.className = 'back-button';
    button.textContent = 'Back';
    button.title = 'Return to the previously visited CONVENE page';
    button.disabled = true;
    button.addEventListener('click', goBackOneView);
    actions.insertBefore(button, actions.firstChild);

    installBackButtonStyles();
  }

  function installBackButtonStyles() {
    if (document.getElementById('conveneBackButtonStyles')) return;
    const style = document.createElement('style');
    style.id = 'conveneBackButtonStyles';
    style.textContent = `
      .back-button {
        border: 1px solid rgba(197, 5, 12, .28);
        background: #fff;
        color: var(--uw-red, #c5050c);
        border-radius: 999px;
        padding: 8px 13px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,.06);
      }
      .back-button:hover:not(:disabled) { background: #fff5f5; }
      .back-button:disabled {
        opacity: .42;
        cursor: not-allowed;
        box-shadow: none;
      }
      .topbar-actions { gap: 10px; align-items: center; }
    `;
    document.head.appendChild(style);
  }

  function loadScriptOnce(src, attr, flagName) {
    if (document.querySelector(`script[${attr}]`) || (flagName && window[flagName])) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, 'true');
    document.body.appendChild(script);
  }

  function loadStartHereHelper() {
    loadScriptOnce('js/start-here-card.js', 'data-convene-start-here', '__conveneStartHereLoaded');
  }

  function loadOrgTypeHelper() {
    loadScriptOnce('js/org-type-control.js', 'data-convene-org-type-control', '__conveneOrgTypeControlLoaded');
  }

  function loadFocusTagHelper() {
    loadScriptOnce('js/org-focus-tags.js', 'data-convene-focus-tags', '__conveneOrgFocusTagsLoaded');
    loadScriptOnce('js/org-tag-clickfix.js', 'data-convene-focus-clickfix', '__conveneOrgTagClickFixLoaded');
    loadScriptOnce('js/focus-tag-cleanup.js', 'data-convene-focus-cleanup', '__conveneFocusTagCleanupLoaded');
  }

  function loadReportsHelper() {
    loadScriptOnce('js/reports-v2.js', 'data-convene-reports', '__conveneReportsV2Loaded');
    loadScriptOnce('js/reports-filter-repair.js', 'data-convene-reports-filter-repair', '__conveneReportsFilterRepairLoaded');
    loadScriptOnce('js/reports-gap-action-priority.js', 'data-convene-gap-action-priority', '__conveneGapActionPriorityLoaded');
    loadScriptOnce('js/reports-gap-sort-fix.js', 'data-convene-gap-sort-fix', '__conveneGapSortFixLoaded');
    loadScriptOnce('js/reports-chart-sort.js', 'data-convene-reports-chart-sort', '__conveneReportsChartSortLoaded');
    loadScriptOnce('js/reports-need-layer.js', 'data-convene-reports-need-layer', '__conveneReportsNeedLayerLoaded');
  }

  function installNavigationTracker() {
    document.addEventListener('click', event => {
      const navButton = event.target.closest('.nav-btn[data-view]');
      if (!navButton) return;

      const current = currentViewId();
      const next = navButton.dataset.view;
      if (!current || !next || current === next) {
        setTimeout(updateBackButton, 0);
        return;
      }

      if (!state.suppressNextNavRecord) {
        pushView(current);
      }

      setTimeout(updateBackButton, 0);
    }, true);

    document.getElementById('countySelect')?.addEventListener('change', () => {
      state.stack = [];
      setTimeout(updateBackButton, 0);
    });
  }

  function goBackOneView() {
    const current = currentViewId();
    let previous = state.stack.pop();

    while (previous && previous === current) {
      previous = state.stack.pop();
    }

    if (!previous) {
      updateBackButton();
      return;
    }

    const button = document.querySelector(`.nav-btn[data-view="${cssEscape(previous)}"]`);
    if (!button) {
      updateBackButton();
      return;
    }

    state.suppressNextNavRecord = true;
    button.click();
    setTimeout(() => {
      state.suppressNextNavRecord = false;
      updateBackButton();
    }, 0);
  }

  function pushView(viewId) {
    if (!viewId) return;
    const last = state.stack[state.stack.length - 1];
    if (last !== viewId) state.stack.push(viewId);
    if (state.stack.length > 30) state.stack.shift();
  }

  function currentViewId() {
    return document.querySelector('.view.active')?.id || '';
  }

  function updateBackButton() {
    const button = document.getElementById('conveneBackButton');
    if (!button) return;
    const current = currentViewId();
    const hasPrevious = state.stack.some(viewId => viewId && viewId !== current && document.getElementById(viewId));
    button.disabled = !hasPrevious;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
})();