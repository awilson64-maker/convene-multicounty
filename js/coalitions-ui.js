(function () {
  if (window.__conveneCoalitionsUiLoaded) return;
  window.__conveneCoalitionsUiLoaded = true;

  var $ = function (id) { return document.getElementById(id); };

  function boot() {
    installCoalitionView();
    renderCoalitions();

    var countySelect = $('countySelect');
    if (countySelect) countySelect.addEventListener('change', function () { setTimeout(renderCoalitions, 80); });
  }

  function installCoalitionView() {
    installNavButton();
    installView();
    installDialog();
  }

  function installNavButton() {
    if ($('coalitionNavBtn')) return;
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var button = document.createElement('button');
    button.id = 'coalitionNavBtn';
    button.className = 'nav-btn';
    button.dataset.view = 'coalitionView';
    button.textContent = 'Coalitions';
    button.addEventListener('click', function () {
      showCoalitionView();
      renderCoalitions();
    });
    var mapButton = sidebar.querySelector('[data-view="mapView"]');
    sidebar.insertBefore(button, mapButton || sidebar.querySelector('.sidebar-note'));
  }

  function installView() {
    if ($('coalitionView')) return;
    var main = document.querySelector('main');
    if (!main) return;
    var section = document.createElement('section');
    section.id = 'coalitionView';
    section.className = 'view';
    section.innerHTML = '' +
      '<div class="section-header">' +
        '<div><h2>Coalitions</h2><p>Track coalitions, convening groups, member organizations, cadence, scope, and notes.</p></div>' +
        '<button id="addCoalitionBtn" class="primary" type="button">Add Coalition</button>' +
      '</div>' +
      '<div class="card filters three-filter">' +
        '<input id="coalitionSearchBox" type="search" placeholder="Search by name, type, focus, organization, notes..." />' +
        '<select id="coalitionStatusFilter"><option value="">All statuses</option></select>' +
        '<select id="coalitionScopeFilter"><option value="">All scopes</option></select>' +
      '</div>' +
      '<div id="coalitionList" class="record-list"></div>';
    var mapView = $('mapView');
    main.insertBefore(section, mapView || null);

    $('addCoalitionBtn').addEventListener('click', function () { openCoalitionDialog(); });
    $('coalitionSearchBox').addEventListener('input', renderCoalitions);
    $('coalitionStatusFilter').addEventListener('change', renderCoalitions);
    $('coalitionScopeFilter').addEventListener('change', renderCoalitions);
  }

  function installDialog() {
    if ($('coalitionDialog')) return;
    var dialog = document.createElement('dialog');
    dialog.id = 'coalitionDialog';
    dialog.innerHTML = '' +
      '<form method="dialog" id="coalitionForm">' +
        '<h3 id="coalitionDialogTitle">Coalition</h3>' +
        '<input type="hidden" id="coalitionId" />' +
        '<div class="form-grid">' +
          '<label>Name<input id="coalitionName" required /></label>' +
          '<label>Status<select id="coalitionStatus"><option>Active</option><option>Emerging</option><option>Paused</option><option>Inactive</option><option>Historical</option></select></label>' +
          '<label>Type / Issue Area<input id="coalitionType" placeholder="Housing, food security, youth, etc." /></label>' +
          '<label>Geographic Scope<select id="coalitionGeographicScope"><option>Countywide</option><option>Municipal</option><option>Neighborhood</option><option>Regional</option><option>Multi-county</option><option>Unknown</option></select></label>' +
          '<label class="full">Focus / Tags<input id="coalitionFocus" /></label>' +
          '<label>Lead Organization<select id="coalitionLeadOrganizationId"></select></label>' +
          '<label>Meeting Cadence<input id="coalitionMeetingCadence" placeholder="Monthly, quarterly, ad hoc..." /></label>' +
          '<label>Last Met Date<input id="coalitionLastMetDate" type="date" /></label>' +
          '<label>Next Meeting Date<input id="coalitionNextMeetingDate" type="date" /></label>' +
          '<label class="full">Member Organizations<select id="coalitionOrganizationIds" multiple size="5"></select></label>' +
          '<label class="full">Linked Contacts<select id="coalitionContactIds" multiple size="5"></select></label>' +
          '<label class="full">Description<textarea id="coalitionDescription"></textarea></label>' +
          '<label class="full">Notes<textarea id="coalitionNotes"></textarea></label>' +
        '</div>' +
        '<menu>' +
          '<button value="cancel">Cancel</button>' +
          '<button id="saveCoalitionBtn" value="default" class="primary">Save</button>' +
        '</menu>' +
      '</form>';
    document.body.appendChild(dialog);
    $('saveCoalitionBtn').addEventListener('click', function (event) {
      event.preventDefault();
      saveCoalitionFromForm();
    });
  }

  function showCoalitionView() {
    document.querySelectorAll('.nav-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.view === 'coalitionView');
    });
    document.querySelectorAll('.view').forEach(function (view) {
      view.classList.toggle('active', view.id === 'coalitionView');
    });
  }

  function activeCounty() {
    var selected = $('countySelect') && $('countySelect').value;
    if (window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[selected]) return window.CONVENE_COUNTIES[selected];
    if (window.CONVENE_COUNTIES && window.CONVENE_DEFAULT_COUNTY) return window.CONVENE_COUNTIES[window.CONVENE_DEFAULT_COUNTY];
    return null;
  }

  function workspace() {
    var county = activeCounty();
    if (!county || !window.ConveneStorage) return emptyWorkspace();
    var loaded = window.ConveneStorage.loadWorkspace(county) || {};
    return {
      organizations: loaded.organizations || [],
      contacts: loaded.contacts || [],
      activities: loaded.activities || [],
      relationships: loaded.relationships || [],
      coalitions: (loaded.coalitions || []).map(normalizeCoalition)
    };
  }

  function emptyWorkspace() {
    return { organizations: [], contacts: [], activities: [], relationships: [], coalitions: [] };
  }

  function persistCoalitions(coalitions) {
    var county = activeCounty();
    if (!county || !window.ConveneStorage) return;
    var data = workspace();
    data.coalitions = coalitions;
    window.ConveneStorage.saveWorkspace(county, data);
  }

  function renderCoalitions() {
    if (!$('coalitionList')) return;
    var data = workspace();
    renderCoalitionFilters(data.coalitions);
    var rows = filteredCoalitions(data);
    var list = $('coalitionList');
    if (!rows.length) {
      list.innerHTML = '<div class="card">No coalitions found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(function (coalition) {
      var members = namesFromIds(coalition.organizationIds, data.organizations, 'No member organizations listed');
      var lead = nameFromId(coalition.leadOrganizationId, data.organizations, 'No lead organization');
      var dates = [coalition.meetingCadence, coalition.nextMeetingDate ? 'Next: ' + formatDate(coalition.nextMeetingDate) : ''].filter(Boolean).join(' | ');
      return '' +
        '<article class="record-item">' +
          '<div>' +
            '<h3>' + escapeHtml(coalition.name || 'Unnamed coalition') + '</h3>' +
            '<div class="record-meta">' + escapeHtml(coalition.status || 'No status') + ' | ' + escapeHtml(coalition.type || 'No type') + ' | ' + escapeHtml(coalition.geographicScope || 'No scope') + '</div>' +
            '<div class="record-meta">Lead: ' + escapeHtml(lead) + '</div>' +
            '<div class="record-meta">Members: ' + escapeHtml(members) + '</div>' +
            '<div class="record-meta">' + escapeHtml(dates || coalition.description || coalition.notes || 'No cadence or notes') + '</div>' +
          '</div>' +
          '<div class="small-actions">' +
            '<button data-edit-coalition="' + escapeHtml(coalition.id) + '">Edit</button>' +
            '<button class="danger" data-delete-coalition="' + escapeHtml(coalition.id) + '">Delete</button>' +
          '</div>' +
        '</article>';
    }).join('');
    list.querySelectorAll('[data-edit-coalition]').forEach(function (button) {
      button.addEventListener('click', function () { openCoalitionDialog(button.dataset.editCoalition); });
    });
    list.querySelectorAll('[data-delete-coalition]').forEach(function (button) {
      button.addEventListener('click', function () { deleteCoalition(button.dataset.deleteCoalition); });
    });
  }

  function renderCoalitionFilters(coalitions) {
    setSelectOptions($('coalitionStatusFilter'), unique(coalitions.map(function (c) { return c.status; })), 'All statuses');
    setSelectOptions($('coalitionScopeFilter'), unique(coalitions.map(function (c) { return c.geographicScope; })), 'All scopes');
  }

  function filteredCoalitions(data) {
    var term = (($('coalitionSearchBox') && $('coalitionSearchBox').value) || '').toLowerCase().trim();
    var status = ($('coalitionStatusFilter') && $('coalitionStatusFilter').value) || '';
    var scope = ($('coalitionScopeFilter') && $('coalitionScopeFilter').value) || '';
    return data.coalitions.filter(function (coalition) {
      var orgNames = namesFromIds(coalition.organizationIds, data.organizations, '');
      var contactNames = namesFromIds(coalition.contactIds, data.contacts, '');
      var text = haystack(coalition) + ' ' + orgNames + ' ' + contactNames;
      return (!status || coalition.status === status) && (!scope || coalition.geographicScope === scope) && (!term || text.toLowerCase().includes(term));
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }

  function openCoalitionDialog(id) {
    var data = workspace();
    var coalition = id ? data.coalitions.find(function (c) { return c.id === id; }) : normalizeCoalition({ status: 'Active', geographicScope: 'Countywide' });
    if (!coalition) return;
    $('coalitionDialogTitle').textContent = id ? 'Edit Coalition' : 'Add Coalition';
    $('coalitionId').value = coalition.id || '';
    $('coalitionName').value = coalition.name || '';
    $('coalitionStatus').value = coalition.status || 'Active';
    $('coalitionType').value = coalition.type || '';
    $('coalitionGeographicScope').value = coalition.geographicScope || 'Countywide';
    $('coalitionFocus').value = coalition.focus || '';
    $('coalitionMeetingCadence').value = coalition.meetingCadence || '';
    $('coalitionLastMetDate').value = coalition.lastMetDate || '';
    $('coalitionNextMeetingDate').value = coalition.nextMeetingDate || '';
    $('coalitionDescription').value = coalition.description || '';
    $('coalitionNotes').value = coalition.notes || '';
    populateOrgSelect($('coalitionLeadOrganizationId'), data.organizations, coalition.leadOrganizationId, true);
    populateMultiSelect($('coalitionOrganizationIds'), data.organizations, coalition.organizationIds);
    populateMultiSelect($('coalitionContactIds'), data.contacts.map(function (contact) {
      return Object.assign({}, contact, { name: contact.organizationId ? (contact.name || 'Unnamed contact') + ' (' + nameFromId(contact.organizationId, data.organizations, 'Unknown org') + ')' : contact.name });
    }), coalition.contactIds);
    $('coalitionDialog').showModal();
  }

  function saveCoalitionFromForm() {
    var data = workspace();
    var saved = normalizeCoalition({
      id: $('coalitionId').value || undefined,
      name: $('coalitionName').value.trim(),
      status: $('coalitionStatus').value,
      type: $('coalitionType').value.trim(),
      focus: $('coalitionFocus').value.trim(),
      organizationIds: selectedValues($('coalitionOrganizationIds')),
      leadOrganizationId: $('coalitionLeadOrganizationId').value,
      contactIds: selectedValues($('coalitionContactIds')),
      geographicScope: $('coalitionGeographicScope').value,
      meetingCadence: $('coalitionMeetingCadence').value.trim(),
      lastMetDate: $('coalitionLastMetDate').value,
      nextMeetingDate: $('coalitionNextMeetingDate').value,
      description: $('coalitionDescription').value.trim(),
      notes: $('coalitionNotes').value.trim()
    });
    if (!saved.name) {
      alert('Coalition name is required. Annoying, but fair.');
      return;
    }
    upsert(data.coalitions, saved);
    persistCoalitions(data.coalitions);
    $('coalitionDialog').close();
    renderCoalitions();
  }

  function deleteCoalition(id) {
    var data = workspace();
    var coalition = data.coalitions.find(function (c) { return c.id === id; });
    if (!coalition || !confirm('Delete ' + (coalition.name || 'this coalition') + '?')) return;
    persistCoalitions(data.coalitions.filter(function (c) { return c.id !== id; }));
    renderCoalitions();
  }

  function normalizeCoalition(raw) {
    raw = raw || {};
    return Object.assign({}, raw, {
      id: raw.id || newId('coalition'),
      name: raw.name || raw.coalitionName || '',
      status: raw.status || 'Active',
      type: raw.type || raw.issueArea || '',
      focus: raw.focus || raw.tags || '',
      organizationIds: toArray(raw.organizationIds || raw.memberOrganizationIds || raw.members),
      leadOrganizationId: raw.leadOrganizationId || raw.leadOrgId || '',
      contactIds: toArray(raw.contactIds || raw.contacts),
      geographicScope: raw.geographicScope || raw.scope || 'Countywide',
      meetingCadence: raw.meetingCadence || '',
      lastMetDate: raw.lastMetDate || '',
      nextMeetingDate: raw.nextMeetingDate || '',
      description: raw.description || '',
      notes: raw.notes || ''
    });
  }

  function populateOrgSelect(select, organizations, selected, includeBlank) {
    select.innerHTML = includeBlank ? '<option value=""></option>' : '';
    organizations.slice().sort(byName).forEach(function (org) {
      var option = document.createElement('option');
      option.value = org.id;
      option.textContent = org.name || 'Unnamed organization';
      option.selected = org.id === selected;
      select.appendChild(option);
    });
  }

  function populateMultiSelect(select, rows, selected) {
    select.innerHTML = '';
    var selectedSet = new Set(selected || []);
    rows.slice().sort(byName).forEach(function (row) {
      var option = document.createElement('option');
      option.value = row.id;
      option.textContent = row.name || 'Unnamed record';
      option.selected = selectedSet.has(row.id);
      select.appendChild(option);
    });
  }

  function setSelectOptions(select, values, blankLabel) {
    if (!select) return;
    var current = select.value;
    select.innerHTML = '<option value="">' + escapeHtml(blankLabel || '') + '</option>';
    values.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = Array.prototype.some.call(select.options, function (option) { return option.value === current; }) ? current : '';
  }

  function selectedValues(select) {
    return Array.prototype.slice.call(select.selectedOptions || []).map(function (option) { return option.value; }).filter(Boolean);
  }

  function namesFromIds(ids, rows, fallback) {
    var names = toArray(ids).map(function (id) { return nameFromId(id, rows, ''); }).filter(Boolean);
    return names.length ? names.join(', ') : fallback;
  }

  function nameFromId(id, rows, fallback) {
    var row = (rows || []).find(function (item) { return item.id === id; });
    return row && row.name ? row.name : fallback;
  }

  function upsert(collection, record) {
    var index = collection.findIndex(function (item) { return item.id === record.id; });
    if (index >= 0) collection[index] = record;
    else collection.push(record);
  }

  function unique(values) {
    return Array.from(new Set((values || []).map(function (value) { return String(value || '').trim(); }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(/[;,]/).map(function (part) { return part.trim(); }).filter(Boolean);
  }

  function haystack(record) {
    return Object.values(record || {}).flat().join(' ').toLowerCase();
  }

  function newId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  }

  function byName(a, b) {
    return String(a.name || '').localeCompare(String(b.name || ''));
  }

  function formatDate(value) {
    if (!value) return '';
    var parts = String(value).split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return value;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
