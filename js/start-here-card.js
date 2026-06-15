(function () {
  if (window.__conveneStartHereLoaded) return;
  window.__conveneStartHereLoaded = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStartHereCard);
  } else {
    initStartHereCard();
  }

  function initStartHereCard() {
    installStyles();
    insertCard();
    document.addEventListener('click', handleStartHereClick);
    var countySelect = document.getElementById('countySelect');
    if (countySelect) countySelect.addEventListener('change', function () { setTimeout(updateCountyName, 150); });
    setTimeout(updateCountyName, 250);
  }

  function insertCard() {
    if (document.getElementById('startHereCard')) return;
    var dashboard = document.getElementById('dashboardView');
    if (!dashboard) return;

    var card = document.createElement('article');
    card.id = 'startHereCard';
    card.className = 'card start-here-card';
    card.innerHTML = '' +
      '<div class="start-here-header">' +
        '<div>' +
          '<h3>Start Here</h3>' +
          '<p class="muted">Use this workspace to build, map, and report on the active county community ecosystem.</p>' +
        '</div>' +
        '<span id="startHereCounty" class="start-here-county">Active county</span>' +
      '</div>' +
      '<div class="start-here-steps">' +
        '<div><b>1</b><span>Add or import organizations.</span></div>' +
        '<div><b>2</b><span>Add contacts and activities as you meet partners.</span></div>' +
        '<div><b>3</b><span>Use the Ecosystem Map to check geographic coverage.</span></div>' +
        '<div><b>4</b><span>Use the Census Gap Lens to compare need and mapped access.</span></div>' +
        '<div><b>5</b><span>Generate reports and export backups regularly.</span></div>' +
      '</div>' +
      '<div class="start-here-actions">' +
        '<button type="button" data-start-view="orgView">Organizations</button>' +
        '<button type="button" data-start-view="mapView">Map</button>' +
        '<button type="button" data-start-view="censusView">Census Gap Lens</button>' +
        '<button type="button" data-start-view="reportsView">Reports</button>' +
        '<button type="button" data-start-view="backupView">Backup / Restore</button>' +
      '</div>';

    var header = dashboard.querySelector('.section-header');
    if (header && header.nextSibling) dashboard.insertBefore(card, header.nextSibling);
    else dashboard.insertBefore(card, dashboard.firstChild);
  }

  function handleStartHereClick(event) {
    var button = event.target.closest('[data-start-view]');
    if (!button) return;
    var viewId = button.getAttribute('data-start-view');
    var navButton = document.querySelector('.nav-btn[data-view="' + cssSafe(viewId) + '"]');
    if (navButton) navButton.click();
  }

  function updateCountyName() {
    var label = document.getElementById('startHereCounty');
    if (!label) return;
    var countySelect = document.getElementById('countySelect');
    var selectedOption = countySelect && countySelect.options ? countySelect.options[countySelect.selectedIndex] : null;
    label.textContent = selectedOption && selectedOption.text ? selectedOption.text : 'Active county';
  }

  function installStyles() {
    if (document.getElementById('startHereStyles')) return;
    var style = document.createElement('style');
    style.id = 'startHereStyles';
    style.textContent = '' +
      '.start-here-card { margin-bottom: 16px; border-left: 6px solid var(--brand); }' +
      '.start-here-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }' +
      '.start-here-header h3 { margin: 0 0 4px; }' +
      '.start-here-header p { margin: 0; }' +
      '.start-here-county { background: #f3f4f6; border-radius: 999px; padding: 5px 10px; font-weight: 800; font-size: .8rem; white-space: nowrap; }' +
      '.start-here-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; margin: 12px 0; }' +
      '.start-here-steps div { display: flex; gap: 9px; align-items: flex-start; border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #fff; }' +
      '.start-here-steps b { background: var(--brand); color: #fff; min-width: 24px; height: 24px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: .78rem; }' +
      '.start-here-steps span { line-height: 1.35; }' +
      '.start-here-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }' +
      '.start-here-actions button { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 11px; cursor: pointer; font-weight: 700; }' +
      '.start-here-actions button:hover { background: #fff5f5; border-color: rgba(197, 5, 12, .35); }';
    document.head.appendChild(style);
  }

  function cssSafe(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
})();