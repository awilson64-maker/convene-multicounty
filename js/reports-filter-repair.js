(function () {
  if (window.__conveneReportsFilterRepairLoaded) return;
  window.__conveneReportsFilterRepairLoaded = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportsFilterRepair);
  } else {
    initReportsFilterRepair();
  }

  function initReportsFilterRepair() {
    setTimeout(populateReportFiltersFromStorage, 300);
    setTimeout(populateReportFiltersFromStorage, 900);
    setInterval(function () {
      var reportsView = document.getElementById('reportsView');
      if (reportsView && reportsView.classList.contains('active')) populateReportFiltersFromStorage();
    }, 1500);

    document.addEventListener('click', function (event) {
      var nav = event.target && event.target.closest ? event.target.closest('.nav-btn[data-view="reportsView"]') : null;
      if (nav) setTimeout(populateReportFiltersFromStorage, 180);
    }, true);

    var countySelect = document.getElementById('countySelect');
    if (countySelect) {
      countySelect.addEventListener('change', function () {
        setTimeout(populateReportFiltersFromStorage, 220);
      });
    }
  }

  function populateReportFiltersFromStorage() {
    var serviceSelect = document.getElementById('reportService');
    var focusSelect = document.getElementById('reportFocus');
    if (!serviceSelect && !focusSelect) return;

    var organizations = loadActiveOrganizations();
    if (!organizations.length) return;

    if (serviceSelect) {
      var serviceTypes = unique(flatten([organizations.map(getOrgType), getTypeDropdownOptions(), getExistingOptions(serviceSelect)]));
      setSelectOptions(serviceSelect, serviceTypes, 'All service types');
    }
    if (focusSelect) {
      setSelectOptions(focusSelect, unique(flatten(organizations.map(getOrgFocusTags))), 'All focus tags');
    }
  }

  function loadActiveOrganizations() {
    var county = activeCounty();
    var orgs = [];

    if (county && window.ConveneStorage && typeof ConveneStorage.loadStore === 'function') {
      orgs = arr(ConveneStorage.loadStore(county, 'organizations'));
    }
    if (!orgs.length && county && window.ConveneStorage && typeof ConveneStorage.loadWorkspace === 'function') {
      orgs = arr(ConveneStorage.loadWorkspace(county).organizations);
    }
    if (!orgs.length && county && county.storagePrefix) {
      orgs = arr(readJson(county.storagePrefix + ':organizations'));
    }
    if (!orgs.length && county && county.id) {
      orgs = arr(readJson('convene:' + county.id + ':organizations'));
    }

    if (!orgs.length) {
      orgs = scanLocalStorageForOrganizations(county ? county.id : '');
    }

    return orgs;
  }

  function activeCounty() {
    var selected = document.getElementById('countySelect') ? document.getElementById('countySelect').value : '';
    var id = selected || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    if (window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[id]) return window.CONVENE_COUNTIES[id];
    if (window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[window.CONVENE_DEFAULT_COUNTY]) return window.CONVENE_COUNTIES[window.CONVENE_DEFAULT_COUNTY];
    return { id: id, storagePrefix: 'convene:' + id };
  }

  function scanLocalStorageForOrganizations(countyId) {
    var preferred = [];
    var fallback = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf(':organizations') === -1) continue;
      var records = arr(readJson(key));
      if (!records.length || typeof records[0] !== 'object') continue;
      if (countyId && key.indexOf('convene:' + countyId + ':') === 0) preferred = records;
      if (!fallback.length) fallback = records;
    }
    return preferred.length ? preferred : fallback;
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (err) {
      return [];
    }
  }

  function getOrgType(org) {
    return clean(org.type || org.category || org.orgType || org.organizationType || org.serviceType || '');
  }

  function getOrgFocusTags(org) {
    var raw = org.focus;
    if (raw == null || raw === '') raw = org.tags;
    if (raw == null || raw === '') raw = org.focusTags;
    if (raw == null || raw === '') raw = org.services;
    if (Array.isArray(raw)) return raw.map(clean).filter(Boolean);
    return String(raw || '').split(',').map(clean).filter(Boolean);
  }

  function getTypeDropdownOptions() {
    var select = document.getElementById('type');
    if (!select || !select.options) return [];
    return Array.prototype.slice.call(select.options).map(function (option) { return clean(option.value || option.textContent); }).filter(Boolean).filter(function (value) { return value !== 'Select type...'; });
  }

  function getExistingOptions(select) {
    if (!select || !select.options) return [];
    return Array.prototype.slice.call(select.options).map(function (option) { return clean(option.value || option.textContent); }).filter(Boolean).filter(function (value) { return value !== 'All service types'; });
  }

  function setSelectOptions(select, values, blankLabel) {
    var current = select.value || '';
    var html = '<option value="">' + escapeHtml(blankLabel) + '</option>';
    values.forEach(function (value) {
      html += '<option value="' + escapeAttr(value) + '">' + escapeHtml(value) + '</option>';
    });
    select.innerHTML = html;
    select.value = values.indexOf(current) >= 0 ? current : '';
  }

  function unique(values) {
    var seen = {};
    var out = [];
    values.forEach(function (value) {
      value = clean(value);
      if (!value || seen[value]) return;
      seen[value] = true;
      out.push(value);
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  function flatten(list) {
    var out = [];
    list.forEach(function (item) {
      if (Array.isArray(item)) item.forEach(function (v) { out.push(v); });
      else out.push(item);
    });
    return out;
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }
})();