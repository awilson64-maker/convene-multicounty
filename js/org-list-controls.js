(function () {
  if (window.__conveneOrgListControlsLoaded) return;
  window.__conveneOrgListControlsLoaded = true;

  function init() {
    installStyles();
    installControls();
    bindRefreshEvents();
    setInterval(function () {
      installControls();
      refreshStatusOptions();
      applyStatusFilter();
    }, 1200);
  }

  function bindRefreshEvents() {
    document.addEventListener('click', function () {
      setTimeout(function () { installControls(); refreshStatusOptions(); applyStatusFilter(); }, 80);
      setTimeout(function () { installControls(); refreshStatusOptions(); applyStatusFilter(); }, 350);
    }, true);

    document.addEventListener('input', function () {
      setTimeout(function () { applyStatusFilter(); }, 80);
      setTimeout(function () { applyStatusFilter(); }, 250);
    }, true);

    document.addEventListener('change', function () {
      setTimeout(function () { refreshStatusOptions(); applyStatusFilter(); }, 80);
      setTimeout(function () { refreshStatusOptions(); applyStatusFilter(); }, 250);
    }, true);
  }

  function installControls() {
    installAddContactButton();
    installStatusFilter();
  }

  function installAddContactButton() {
    if (document.getElementById('orgViewAddContactBtn')) return;

    var addOrgBtn = document.getElementById('addOrgBtn');
    if (!addOrgBtn || !addOrgBtn.parentNode) return;

    var button = document.createElement('button');
    button.id = 'orgViewAddContactBtn';
    button.type = 'button';
    button.className = 'secondary org-view-add-contact';
    button.textContent = 'Add Contact';
    button.addEventListener('click', function () {
      var contactButton = document.getElementById('addContactBtn');
      if (contactButton) contactButton.click();
    });

    addOrgBtn.parentNode.insertBefore(button, addOrgBtn.nextSibling);
  }

  function installStatusFilter() {
    var typeFilter = document.getElementById('orgTypeFilter');
    if (!typeFilter || !typeFilter.parentNode) return;

    var statusFilter = document.getElementById('orgStatusFilter');
    if (!statusFilter) {
      statusFilter = document.createElement('select');
      statusFilter.id = 'orgStatusFilter';
      statusFilter.setAttribute('aria-label', 'Filter organizations by status');
      statusFilter.addEventListener('change', applyStatusFilter);
      typeFilter.parentNode.insertBefore(statusFilter, typeFilter.nextSibling);
    }

    refreshStatusOptions();
    applyStatusFilter();
  }

  function refreshStatusOptions() {
    var select = document.getElementById('orgStatusFilter');
    if (!select) return;

    var previous = select.value || '';
    var statuses = getOrganizationStatuses();
    var options = ['<option value="">All statuses</option>'];
    for (var i = 0; i < statuses.length; i += 1) {
      options.push('<option value="' + escapeAttr(statuses[i]) + '">' + escapeHtml(statuses[i]) + '</option>');
    }
    select.innerHTML = options.join('');

    if (previous && statuses.indexOf(previous) !== -1) {
      select.value = previous;
    } else {
      select.value = '';
    }
  }

  function getOrganizationStatuses() {
    var values = [];
    var orgs = loadOrganizations();
    for (var i = 0; i < orgs.length; i += 1) {
      var value = clean(orgs[i] && orgs[i].status);
      if (value) values.push(value);
    }
    values = values.concat(['Active', 'active collaboration', 'research only', 'inactive']);
    return unique(values).sort(function (a, b) { return a.localeCompare(b); });
  }

  function loadOrganizations() {
    try {
      var county = activeCounty();
      if (county && window.ConveneStorage) {
        var loaded = window.ConveneStorage.loadStore(county, 'organizations');
        if (Array.isArray(loaded)) return loaded;
      }
    } catch (err) {}
    return [];
  }

  function activeCounty() {
    var select = document.getElementById('countySelect');
    var countyId = select && select.value ? select.value : '';
    if (!countyId && window.ConveneAccess && window.ConveneAccess.activeCountyId) {
      countyId = window.ConveneAccess.activeCountyId();
    }
    if (window.CONVENE_COUNTIES && countyId && window.CONVENE_COUNTIES[countyId]) {
      return window.CONVENE_COUNTIES[countyId];
    }
    return null;
  }

  function applyStatusFilter() {
    var select = document.getElementById('orgStatusFilter');
    var list = document.getElementById('orgList');
    if (!select || !list) return;

    var selected = clean(select.value);
    var rows = list.querySelectorAll('.record-item');
    for (var i = 0; i < rows.length; i += 1) {
      var rowStatus = getRowStatus(rows[i]);
      rows[i].style.display = (!selected || rowStatus === selected) ? '' : 'none';
    }
  }

  function getRowStatus(row) {
    var metas = row.querySelectorAll('.record-meta');
    if (!metas.length) return '';
    var parts = String(metas[0].textContent || '').split('|');
    if (parts.length < 2) return '';
    return clean(parts[1]);
  }

  function unique(values) {
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i += 1) {
      var value = clean(values[i]);
      var key = value.toLowerCase();
      if (!value || seen[key]) continue;
      seen[key] = true;
      out.push(value);
    }
    return out;
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function installStyles() {
    if (document.getElementById('conveneOrgListControlsStyles')) return;
    var style = document.createElement('style');
    style.id = 'conveneOrgListControlsStyles';
    style.textContent = '\n\
      #orgView .section-header { align-items: flex-start; }\n\
      #orgView .section-header > button,\n\
      #orgView .section-header .org-view-add-contact { margin-left: 8px; }\n\
      #orgView .filters { grid-template-columns: minmax(220px, 1fr) minmax(170px, 240px) minmax(170px, 240px); }\n\
      #orgStatusFilter { min-width: 170px; }\n\
      @media (max-width: 900px) { #orgView .filters { grid-template-columns: 1fr; } }\n\
    ';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
