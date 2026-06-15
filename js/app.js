(() => {
  let activeCounty;
  let workspace = emptyWorkspace();
  let map;
  let markers = [];
  let relationshipLayers = [];
  let heatLayer = null;
  let markerByOrgId = new Map();
  let lastMapCountyId = '';

  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    populateCountySelect();
    bindNavigation();
    bindActions();
    setCounty(ConveneAccess.activeCountyId());
  }

  function emptyWorkspace() {
    return { organizations: [], contacts: [], activities: [], relationships: [] };
  }

  function populateCountySelect() {
    const select = $('countySelect');
    select.innerHTML = '';
    Object.values(CONVENE_COUNTIES).forEach(county => {
      const opt = document.createElement('option');
      opt.value = county.id;
      opt.textContent = county.name;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => setCounty(select.value));
  }

  function setCounty(countyId) {
    activeCounty = CONVENE_COUNTIES[ConveneAccess.allowedCountyId(countyId)];
    ConveneAccess.setActiveCountyId(activeCounty.id);
    $('countySelect').value = activeCounty.id;
    $('activeCountyLabel').textContent = `${activeCounty.name} | Multi-county community asset mapping`;
    workspace = normalizeWorkspace(ConveneStorage.loadWorkspace(activeCounty));
    lastMapCountyId = '';
    renderAll();
  }

  function normalizeWorkspace(raw = {}) {
    return {
      organizations: (raw.organizations || []).map(ConveneCRM.normalizeOrg),
      contacts: (raw.contacts || []).map(normalizeContact),
      activities: (raw.activities || []).map(normalizeActivity),
      relationships: (raw.relationships || []).map(normalizeRelationship)
    };
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });
  }

  function showView(viewId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
    if (viewId === 'mapView') setTimeout(renderMap, 50);
    if (viewId === 'censusView') ConveneCensus.renderCountyCensus(activeCounty, $('censusPanel'));
  }

  function bindActions() {
    $('addOrgBtn').addEventListener('click', () => openOrgDialog());
    $('saveOrgBtn').addEventListener('click', event => { event.preventDefault(); saveOrgFromForm(); });
    $('orgSearchBox').addEventListener('input', renderOrgList);
    $('orgTypeFilter').addEventListener('change', renderOrgList);

    $('addContactBtn').addEventListener('click', () => openContactDialog());
    $('saveContactBtn').addEventListener('click', event => { event.preventDefault(); saveContactFromForm(); });
    $('contactSearchBox').addEventListener('input', renderContactList);
    $('contactOrgFilter').addEventListener('change', renderContactList);

    $('addActivityBtn').addEventListener('click', () => openActivityDialog());
    $('saveActivityBtn').addEventListener('click', event => { event.preventDefault(); saveActivityFromForm(); });
    $('activitySearchBox').addEventListener('input', renderActivityList);
    $('activityTypeFilter').addEventListener('change', renderActivityList);
    $('activityTaskFilter').addEventListener('change', renderActivityList);

    $('addRelationshipBtn').addEventListener('click', () => openRelationshipDialog());
    $('saveRelationshipBtn').addEventListener('click', event => { event.preventDefault(); saveRelationshipFromForm(); });
    $('relationshipSearchBox').addEventListener('input', renderRelationshipList);
    $('relationshipStatusFilter').addEventListener('change', renderRelationshipList);

    ['mapTypeFilter', 'mapReachFilter', 'mapConfidenceFilter', 'mapStatusFilter'].forEach(id => $(id)?.addEventListener('change', renderMap));
    ['mapHeatToggle', 'mapRelationshipToggle', 'mapMissingOnlyToggle'].forEach(id => $(id)?.addEventListener('change', renderMap));
    $('mapSearchBox')?.addEventListener('input', renderMap);
    $('mapResetBtn')?.addEventListener('click', resetMapFilters);
    $('mapFitBtn')?.addEventListener('click', fitVisibleMapFeatures);

    $('exportBtn').addEventListener('click', exportBackup);
    $('restoreFile').addEventListener('change', restoreBackup);
    $('csvFile').addEventListener('change', previewCsv);
  }

  function renderAll() {
    renderDashboard();
    renderOrgTypeFilter();
    renderOrgList();
    renderContactOrgFilter();
    renderContactList();
    renderActivityTypeFilter();
    renderActivityList();
    renderRelationshipStatusFilter();
    renderRelationshipList();
    renderMapFilters();
    renderMap();
    ConveneCensus.renderCountyCensus(activeCounty, $('censusPanel'));
  }

  function persistAndRender() {
    ConveneStorage.saveWorkspace(activeCounty, workspace);
    renderAll();
  }

  function renderDashboard() {
    const openTasks = getOpenFollowUps();
    $('orgCount').textContent = workspace.organizations.length;
    $('contactCount').textContent = workspace.contacts.length;
    $('activityCount').textContent = workspace.activities.length;
    $('taskCount').textContent = openTasks.length;
    $('countySummary').textContent = `${activeCounty.description} Storage namespace: ${activeCounty.storagePrefix}. Census source: ${activeCounty.censusFile}.`;
    $('taskList').innerHTML = openTasks.length ? openTasks.slice(0, 8).map(activity => `
      <button class="task-item ${isOverdue(activity.followUpDate) ? 'overdue' : ''}" data-edit-activity="${activity.id}">
        <strong>${escapeHtml(formatDate(activity.followUpDate))}</strong>
        <span>${escapeHtml(activity.summary || 'Follow-up')}</span>
        <small>${escapeHtml(activity.organizationIds.map(orgName).join(', ') || 'No organization linked')}</small>
      </button>`).join('') : '<p class="muted">No open follow-ups. Suspiciously peaceful.</p>';
    $('taskList').querySelectorAll('[data-edit-activity]').forEach(btn => btn.addEventListener('click', () => { showView('activityView'); openActivityDialog(btn.dataset.editActivity); }));
  }

  function renderOrgTypeFilter() {
    setSelectOptions($('orgTypeFilter'), unique(workspace.organizations.map(o => o.type)), 'All types');
  }

  function filteredOrgs() {
    const term = $('orgSearchBox').value.toLowerCase().trim();
    const type = $('orgTypeFilter').value;
    return workspace.organizations
      .filter(org => (!type || org.type === type) && (!term || haystack(org).includes(term)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function renderOrgList() {
    const rows = filteredOrgs();
    const list = $('orgList');
    if (!rows.length) {
      list.innerHTML = '<div class="card">No organization records found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(org => `
      <article class="record-item">
        <div>
          <h3>${escapeHtml(org.name || 'Unnamed organization')}</h3>
          <div class="record-meta">${escapeHtml(org.type || 'No type')} | ${escapeHtml(org.status || 'No status')} | ${escapeHtml(org.address || 'No address')}</div>
          <div class="record-meta">${escapeHtml(org.reach || 'No reach')} | Confidence: ${escapeHtml(org.confidence || 'Not set')}</div>
        </div>
        <div class="small-actions">
          ${hasCoordinates(org) ? `<button data-map-org="${org.id}">Map</button>` : ''}
          <button data-edit-org="${org.id}">Edit</button>
          <button class="danger" data-delete-org="${org.id}">Delete</button>
        </div>
      </article>`).join('');
    list.querySelectorAll('[data-edit-org]').forEach(btn => btn.addEventListener('click', () => openOrgDialog(btn.dataset.editOrg)));
    list.querySelectorAll('[data-delete-org]').forEach(btn => btn.addEventListener('click', () => deleteOrg(btn.dataset.deleteOrg)));
    list.querySelectorAll('[data-map-org]').forEach(btn => btn.addEventListener('click', () => { showView('mapView'); setTimeout(() => zoomToOrg(btn.dataset.mapOrg), 80); }));
  }

  function openOrgDialog(id) {
    const org = id ? workspace.organizations.find(o => o.id === id) : ConveneCRM.normalizeOrg({ status: 'Active', reach: 'Countywide', confidence: 'Medium' });
    if (!org) return;
    $('orgDialogTitle').textContent = id ? 'Edit Organization' : 'Add Organization';
    $('orgId').value = org.id || '';
    ConveneCRM.fields.forEach(field => { if ($(field)) $(field).value = org[field] ?? ''; });
    $('orgDialog').showModal();
  }

  function saveOrgFromForm() {
    const data = { id: $('orgId').value || undefined };
    ConveneCRM.fields.forEach(field => { if ($(field)) data[field] = $(field).value.trim(); });
    const saved = ConveneCRM.normalizeOrg(data);
    upsert(workspace.organizations, saved);
    persistAndRender();
    $('orgDialog').close();
  }

  function deleteOrg(id) {
    const org = workspace.organizations.find(o => o.id === id);
    if (!org || !confirm(`Delete ${org.name || 'this organization'}? Contacts, activities, and relationships will remain but may lose context.`)) return;
    workspace.organizations = workspace.organizations.filter(o => o.id !== id);
    workspace.contacts.forEach(c => { if (c.organizationId === id) c.organizationId = ''; });
    workspace.activities.forEach(a => { a.organizationIds = a.organizationIds.filter(orgId => orgId !== id); });
    workspace.relationships = workspace.relationships.filter(r => r.fromOrgId !== id && r.toOrgId !== id);
    persistAndRender();
  }

  function normalizeContact(raw = {}) {
    return {
      id: raw.id || newId('contact'),
      name: raw.name || '',
      organizationId: raw.organizationId || '',
      role: raw.role || raw.title || '',
      email: raw.email || '',
      phone: raw.phone || '',
      strength: raw.strength || '',
      notes: raw.notes || ''
    };
  }

  function renderContactOrgFilter() {
    setSelectOptions($('contactOrgFilter'), workspace.organizations.map(o => [o.id, o.name || 'Unnamed organization']), 'All organizations');
  }

  function filteredContacts() {
    const term = $('contactSearchBox').value.toLowerCase().trim();
    const orgId = $('contactOrgFilter').value;
    return workspace.contacts
      .filter(contact => (!orgId || contact.organizationId === orgId) && (!term || `${haystack(contact)} ${orgName(contact.organizationId)}`.toLowerCase().includes(term)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function renderContactList() {
    const rows = filteredContacts();
    const list = $('contactList');
    if (!rows.length) {
      list.innerHTML = '<div class="card">No contacts found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(contact => `
      <article class="record-item">
        <div>
          <h3>${escapeHtml(contact.name || 'Unnamed contact')}</h3>
          <div class="record-meta">${escapeHtml(contact.role || 'No role')} | ${escapeHtml(orgName(contact.organizationId))}</div>
          <div class="record-meta">${escapeHtml(contact.email || 'No email')} | ${escapeHtml(contact.phone || 'No phone')}</div>
        </div>
        <div class="small-actions">
          <button data-edit-contact="${contact.id}">Edit</button>
          <button class="danger" data-delete-contact="${contact.id}">Delete</button>
        </div>
      </article>`).join('');
    list.querySelectorAll('[data-edit-contact]').forEach(btn => btn.addEventListener('click', () => openContactDialog(btn.dataset.editContact)));
    list.querySelectorAll('[data-delete-contact]').forEach(btn => btn.addEventListener('click', () => deleteContact(btn.dataset.deleteContact)));
  }

  function openContactDialog(id) {
    const contact = id ? workspace.contacts.find(c => c.id === id) : normalizeContact({});
    if (!contact) return;
    $('contactDialogTitle').textContent = id ? 'Edit Contact' : 'Add Contact';
    populateOrgSelect($('contactOrganizationId'), contact.organizationId, true);
    $('contactId').value = contact.id || '';
    $('contactName').value = contact.name || '';
    $('contactRole').value = contact.role || '';
    $('contactEmail').value = contact.email || '';
    $('contactPhone').value = contact.phone || '';
    $('contactStrength').value = contact.strength || '';
    $('contactNotes').value = contact.notes || '';
    $('contactDialog').showModal();
  }

  function saveContactFromForm() {
    const saved = normalizeContact({
      id: $('contactId').value || undefined,
      name: $('contactName').value.trim(),
      organizationId: $('contactOrganizationId').value,
      role: $('contactRole').value.trim(),
      email: $('contactEmail').value.trim(),
      phone: $('contactPhone').value.trim(),
      strength: $('contactStrength').value,
      notes: $('contactNotes').value.trim()
    });
    upsert(workspace.contacts, saved);
    persistAndRender();
    $('contactDialog').close();
  }

  function deleteContact(id) {
    const contact = workspace.contacts.find(c => c.id === id);
    if (!contact || !confirm(`Delete ${contact.name || 'this contact'}?`)) return;
    workspace.contacts = workspace.contacts.filter(c => c.id !== id);
    workspace.activities.forEach(a => { a.contactIds = a.contactIds.filter(contactId => contactId !== id); });
    persistAndRender();
  }

  function normalizeActivity(raw = {}) {
    return {
      id: raw.id || newId('activity'),
      date: raw.date || today(),
      type: raw.type || 'Meeting',
      organizationIds: toArray(raw.organizationIds || raw.orgIds || raw.organizations),
      contactIds: toArray(raw.contactIds || raw.contacts),
      summary: raw.summary || '',
      followUpDate: raw.followUpDate || '',
      followUpCompleted: Boolean(raw.followUpCompleted),
      notes: raw.notes || ''
    };
  }

  function renderActivityTypeFilter() {
    setSelectOptions($('activityTypeFilter'), unique(workspace.activities.map(a => a.type)), 'All activity types');
  }

  function filteredActivities() {
    const term = $('activitySearchBox').value.toLowerCase().trim();
    const type = $('activityTypeFilter').value;
    const task = $('activityTaskFilter').value;
    return workspace.activities
      .filter(activity => {
        const matchesType = !type || activity.type === type;
        const matchesTask = !task || (task === 'open' && activity.followUpDate && !activity.followUpCompleted) || (task === 'completed' && activity.followUpDate && activity.followUpCompleted);
        const linkedNames = `${activity.organizationIds.map(orgName).join(' ')} ${activity.contactIds.map(contactName).join(' ')}`.toLowerCase();
        return matchesType && matchesTask && (!term || `${haystack(activity)} ${linkedNames}`.includes(term));
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function renderActivityList() {
    const rows = filteredActivities();
    const list = $('activityList');
    if (!rows.length) {
      list.innerHTML = '<div class="card">No activities found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(activity => `
      <article class="record-item ${activity.followUpDate && !activity.followUpCompleted && isOverdue(activity.followUpDate) ? 'overdue-row' : ''}">
        <div>
          <h3>${escapeHtml(activity.summary || 'Untitled activity')}</h3>
          <div class="record-meta">${escapeHtml(formatDate(activity.date))} | ${escapeHtml(activity.type || 'Activity')} | ${escapeHtml(activity.organizationIds.map(orgName).join(', ') || 'No organization linked')}</div>
          <div class="record-meta">${activity.followUpDate ? `Follow-up: ${escapeHtml(formatDate(activity.followUpDate))} ${activity.followUpCompleted ? '(completed)' : '(open)'}` : 'No follow-up task'}</div>
        </div>
        <div class="small-actions">
          <button data-edit-activity="${activity.id}">Edit</button>
          <button class="danger" data-delete-activity="${activity.id}">Delete</button>
        </div>
      </article>`).join('');
    list.querySelectorAll('[data-edit-activity]').forEach(btn => btn.addEventListener('click', () => openActivityDialog(btn.dataset.editActivity)));
    list.querySelectorAll('[data-delete-activity]').forEach(btn => btn.addEventListener('click', () => deleteActivity(btn.dataset.deleteActivity)));
  }

  function openActivityDialog(id) {
    const activity = id ? workspace.activities.find(a => a.id === id) : normalizeActivity({});
    if (!activity) return;
    $('activityDialogTitle').textContent = id ? 'Edit Activity' : 'Add Activity';
    populateOrgMultiSelect($('activityOrganizationIds'), activity.organizationIds);
    populateContactMultiSelect($('activityContactIds'), activity.contactIds);
    $('activityId').value = activity.id || '';
    $('activityDate').value = activity.date || today();
    $('activityType').value = activity.type || 'Meeting';
    $('activitySummary').value = activity.summary || '';
    $('activityFollowUpDate').value = activity.followUpDate || '';
    $('activityFollowUpCompleted').checked = Boolean(activity.followUpCompleted);
    $('activityNotes').value = activity.notes || '';
    $('activityDialog').showModal();
  }

  function saveActivityFromForm() {
    const saved = normalizeActivity({
      id: $('activityId').value || undefined,
      date: $('activityDate').value,
      type: $('activityType').value,
      organizationIds: selectedValues($('activityOrganizationIds')),
      contactIds: selectedValues($('activityContactIds')),
      summary: $('activitySummary').value.trim(),
      followUpDate: $('activityFollowUpDate').value,
      followUpCompleted: $('activityFollowUpCompleted').checked,
      notes: $('activityNotes').value.trim()
    });
    upsert(workspace.activities, saved);
    persistAndRender();
    $('activityDialog').close();
  }

  function deleteActivity(id) {
    const activity = workspace.activities.find(a => a.id === id);
    if (!activity || !confirm(`Delete ${activity.summary || 'this activity'}?`)) return;
    workspace.activities = workspace.activities.filter(a => a.id !== id);
    persistAndRender();
  }

  function normalizeRelationship(raw = {}) {
    return {
      id: raw.id || newId('relationship'),
      fromOrgId: raw.fromOrgId || raw.sourceOrgId || '',
      toOrgId: raw.toOrgId || raw.targetOrgId || '',
      strength: raw.strength || 'Moderate',
      status: raw.status || 'Potential',
      summary: raw.summary || '',
      notes: raw.notes || ''
    };
  }

  function renderRelationshipStatusFilter() {
    setSelectOptions($('relationshipStatusFilter'), unique(workspace.relationships.map(r => r.status)), 'All statuses');
  }

  function filteredRelationships() {
    const term = $('relationshipSearchBox').value.toLowerCase().trim();
    const status = $('relationshipStatusFilter').value;
    return workspace.relationships
      .filter(rel => {
        const linkedNames = `${orgName(rel.fromOrgId)} ${orgName(rel.toOrgId)}`.toLowerCase();
        return (!status || rel.status === status) && (!term || `${haystack(rel)} ${linkedNames}`.includes(term));
      })
      .sort((a, b) => `${orgName(a.fromOrgId)} ${orgName(a.toOrgId)}`.localeCompare(`${orgName(b.fromOrgId)} ${orgName(b.toOrgId)}`));
  }

  function renderRelationshipList() {
    const rows = filteredRelationships();
    const list = $('relationshipList');
    if (!rows.length) {
      list.innerHTML = '<div class="card">No relationships found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(rel => `
      <article class="record-item">
        <div>
          <h3>${escapeHtml(orgName(rel.fromOrgId))} ↔ ${escapeHtml(orgName(rel.toOrgId))}</h3>
          <div class="record-meta">${escapeHtml(rel.status || 'No status')} | Strength: ${escapeHtml(rel.strength || 'Not set')}</div>
          <div class="record-meta">${escapeHtml(rel.summary || rel.notes || 'No summary')}</div>
        </div>
        <div class="small-actions">
          <button data-edit-relationship="${rel.id}">Edit</button>
          <button class="danger" data-delete-relationship="${rel.id}">Delete</button>
        </div>
      </article>`).join('');
    list.querySelectorAll('[data-edit-relationship]').forEach(btn => btn.addEventListener('click', () => openRelationshipDialog(btn.dataset.editRelationship)));
    list.querySelectorAll('[data-delete-relationship]').forEach(btn => btn.addEventListener('click', () => deleteRelationship(btn.dataset.deleteRelationship)));
  }

  function openRelationshipDialog(id) {
    const rel = id ? workspace.relationships.find(r => r.id === id) : normalizeRelationship({});
    if (!rel) return;
    $('relationshipDialogTitle').textContent = id ? 'Edit Relationship' : 'Add Relationship';
    populateOrgSelect($('relationshipFromOrgId'), rel.fromOrgId, false);
    populateOrgSelect($('relationshipToOrgId'), rel.toOrgId, false);
    $('relationshipId').value = rel.id || '';
    $('relationshipStrength').value = rel.strength || 'Moderate';
    $('relationshipStatus').value = rel.status || 'Potential';
    $('relationshipSummary').value = rel.summary || '';
    $('relationshipNotes').value = rel.notes || '';
    $('relationshipDialog').showModal();
  }

  function saveRelationshipFromForm() {
    const saved = normalizeRelationship({
      id: $('relationshipId').value || undefined,
      fromOrgId: $('relationshipFromOrgId').value,
      toOrgId: $('relationshipToOrgId').value,
      strength: $('relationshipStrength').value,
      status: $('relationshipStatus').value,
      summary: $('relationshipSummary').value.trim(),
      notes: $('relationshipNotes').value.trim()
    });
    if (!saved.fromOrgId || !saved.toOrgId || saved.fromOrgId === saved.toOrgId) {
      alert('Choose two different organizations for a relationship. Software being needy, but fair.');
      return;
    }
    upsert(workspace.relationships, saved);
    persistAndRender();
    $('relationshipDialog').close();
  }

  function deleteRelationship(id) {
    const rel = workspace.relationships.find(r => r.id === id);
    if (!rel || !confirm(`Delete the relationship between ${orgName(rel.fromOrgId)} and ${orgName(rel.toOrgId)}?`)) return;
    workspace.relationships = workspace.relationships.filter(r => r.id !== id);
    persistAndRender();
  }

  function renderMapFilters() {
    setSelectOptions($('mapTypeFilter'), unique(workspace.organizations.map(o => o.type)), 'All service types');
    setSelectOptions($('mapReachFilter'), unique(workspace.organizations.map(o => o.reach)), 'All reach levels');
    setSelectOptions($('mapConfidenceFilter'), unique(workspace.organizations.map(o => o.confidence)), 'All confidence levels');
    setSelectOptions($('mapStatusFilter'), unique(workspace.organizations.map(o => o.status)), 'All statuses');
  }

  function filteredMapOrgs() {
    const type = $('mapTypeFilter')?.value || '';
    const reach = $('mapReachFilter')?.value || '';
    const confidence = $('mapConfidenceFilter')?.value || '';
    const status = $('mapStatusFilter')?.value || '';
    const term = ($('mapSearchBox')?.value || '').toLowerCase().trim();
    const missingOnly = Boolean($('mapMissingOnlyToggle')?.checked);
    return workspace.organizations
      .filter(org => {
        const matches = (!type || org.type === type)
          && (!reach || org.reach === reach)
          && (!confidence || org.confidence === confidence)
          && (!status || org.status === status)
          && (!term || haystack(org).includes(term))
          && (!missingOnly || !hasCoordinates(org));
        return matches;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function renderMap() {
    const el = $('map');
    if (!el) return;
    if (!window.L) {
      el.innerHTML = '<div class="card">Map library did not load. The CRM still works, but the map needs Leaflet available.</div>';
      return;
    }
    if (!map) {
      map = L.map('map');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    }
    if (lastMapCountyId !== activeCounty.id) {
      map.setView(activeCounty.mapCenter, activeCounty.mapZoom);
      lastMapCountyId = activeCounty.id;
    }

    clearMapLayers();

    const filtered = filteredMapOrgs();
    const mapped = filtered.filter(hasCoordinates);
    const missing = filtered.filter(org => !hasCoordinates(org));
    markerByOrgId = new Map();

    if (!$('mapMissingOnlyToggle')?.checked) {
      mapped.forEach(org => {
        const marker = L.marker([Number(org.lat), Number(org.lng)])
          .addTo(map)
          .bindPopup(orgPopupHtml(org));
        markers.push(marker);
        markerByOrgId.set(org.id, marker);
      });
    }

    if ($('mapHeatToggle')?.checked && window.L.heatLayer && mapped.length) {
      heatLayer = L.heatLayer(mapped.map(org => [Number(org.lat), Number(org.lng), 0.65]), { radius: 30, blur: 22, maxZoom: 13 }).addTo(map);
    }

    if ($('mapRelationshipToggle')?.checked) drawRelationshipLines(mapped);

    renderMapInsights(filtered, mapped, missing);
    renderMapOrgList(filtered, mapped, missing);
    renderMapBreakdowns(filtered);

    const typeLabel = $('mapTypeFilter')?.value ? ` for ${$('mapTypeFilter').value}` : '';
    $('mapStatus').textContent = `${mapped.length} mapped organization${mapped.length === 1 ? '' : 's'} shown${typeLabel}. ${missing.length} filtered record${missing.length === 1 ? '' : 's'} missing coordinates.`;

    setTimeout(() => {
      map.invalidateSize();
      window.ConveneCountyBoundary?.draw?.();
    }, 100);
  }

  function clearMapLayers() {
    markers.forEach(marker => marker.remove());
    markers = [];
    relationshipLayers.forEach(layer => layer.remove());
    relationshipLayers = [];
    if (heatLayer) { heatLayer.remove(); heatLayer = null; }
  }

  function drawRelationshipLines(mappedOrgs) {
    const visibleIds = new Set(mappedOrgs.map(org => org.id));
    const byId = new Map(workspace.organizations.map(org => [org.id, org]));
    workspace.relationships.forEach(rel => {
      if (!visibleIds.has(rel.fromOrgId) || !visibleIds.has(rel.toOrgId)) return;
      const a = byId.get(rel.fromOrgId);
      const b = byId.get(rel.toOrgId);
      if (!hasCoordinates(a) || !hasCoordinates(b)) return;
      const line = L.polyline([[Number(a.lat), Number(a.lng)], [Number(b.lat), Number(b.lng)]], {
        color: relationshipColor(rel.strength),
        weight: rel.strength === 'Strong' ? 4 : rel.strength === 'Weak' ? 2 : 3,
        opacity: 0.75,
        dashArray: rel.status === 'Potential' ? '6 6' : null
      }).addTo(map).bindPopup(`<strong>${escapeHtml(orgName(rel.fromOrgId))} ↔ ${escapeHtml(orgName(rel.toOrgId))}</strong><br>${escapeHtml(rel.status)} | ${escapeHtml(rel.strength)}<br>${escapeHtml(rel.summary || rel.notes || '')}`);
      relationshipLayers.push(line);
    });
  }

  function relationshipColor(strength) {
    if (strength === 'Strong') return '#166534';
    if (strength === 'Weak') return '#92400e';
    return '#111827';
  }

  function renderMapInsights(filtered, mapped, missing) {
    const all = workspace.organizations;
    const researchOnly = filtered.filter(org => /research/i.test(org.status || '')).length;
    const active = filtered.filter(org => /active|met|collaboration/i.test(org.status || '')).length;
    const relationshipCount = visibleRelationshipCount(mapped);
    const panel = $('mapSummaryPanel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="mini-metric-grid map-metrics">
        <div class="mini-metric"><span>Total county records</span><b>${all.length}</b></div>
        <div class="mini-metric"><span>Filtered records</span><b>${filtered.length}</b></div>
        <div class="mini-metric"><span>Mapped records</span><b>${mapped.length}</b></div>
        <div class="mini-metric"><span>Missing coordinates</span><b>${missing.length}</b></div>
        <div class="mini-metric"><span>Research-only</span><b>${researchOnly}</b></div>
        <div class="mini-metric"><span>Visible relationships</span><b>${relationshipCount}</b></div>
      </div>
      <p class="muted small">${active} filtered records are active, met, or active collaboration. Use this panel to clean the dataset before presenting the ecosystem publicly.</p>`;
  }

  function visibleRelationshipCount(mapped) {
    const ids = new Set(mapped.map(org => org.id));
    return workspace.relationships.filter(rel => ids.has(rel.fromOrgId) && ids.has(rel.toOrgId)).length;
  }

  function renderMapBreakdowns(filtered) {
    const panel = $('mapBreakdownPanel');
    if (!panel) return;
    const typeCounts = countBy(filtered, org => org.type || 'No type');
    const reachCounts = countBy(filtered, org => org.reach || 'No reach');
    const confidenceCounts = countBy(filtered, org => org.confidence || 'No confidence');
    panel.innerHTML = `
      <div class="breakdown-grid">
        ${breakdownHtml('By service type', typeCounts)}
        ${breakdownHtml('By reach', reachCounts)}
        ${breakdownHtml('By confidence', confidenceCounts)}
      </div>`;
  }

  function breakdownHtml(title, entries) {
    const rows = entries.slice(0, 8).map(([label, count]) => `
      <div class="breakdown-row"><span>${escapeHtml(label)}</span><b>${count}</b></div>`).join('');
    return `<section><h4>${escapeHtml(title)}</h4>${rows || '<p class="muted small">No records in current filter.</p>'}</section>`;
  }

  function countBy(items, getter) {
    const map = new Map();
    items.forEach(item => {
      const key = String(getter(item) || '').trim() || 'Blank';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function renderMapOrgList(filtered, mapped, missing) {
    const list = $('mapOrgList');
    const missingList = $('mapMissingList');
    if (!list || !missingList) return;

    const mappedIds = new Set(mapped.map(org => org.id));
    const mappedRows = filtered.filter(org => mappedIds.has(org.id));
    list.innerHTML = mappedRows.length ? mappedRows.map(org => `
      <article class="map-list-item">
        <div>
          <strong>${escapeHtml(org.name || 'Unnamed organization')}</strong>
          <span>${escapeHtml(org.type || 'No type')} | ${escapeHtml(org.status || 'No status')}</span>
          <small>${escapeHtml(org.address || 'No address')}</small>
        </div>
        <div class="small-actions">
          <button data-zoom-org="${org.id}">Zoom</button>
          <button data-edit-org="${org.id}">Edit</button>
        </div>
      </article>`).join('') : '<p class="muted">No mapped organizations match the current filters.</p>';

    missingList.innerHTML = missing.length ? missing.map(org => `
      <article class="map-list-item missing-coords">
        <div>
          <strong>${escapeHtml(org.name || 'Unnamed organization')}</strong>
          <span>${escapeHtml(org.type || 'No type')} | ${escapeHtml(org.address || 'No address')}</span>
        </div>
        <div class="small-actions"><button data-edit-org="${org.id}">Add lat/lng</button></div>
      </article>`).join('') : '<p class="muted">No missing coordinates in the current filters.</p>';

    [list, missingList].forEach(container => {
      container.querySelectorAll('[data-zoom-org]').forEach(btn => btn.addEventListener('click', () => zoomToOrg(btn.dataset.zoomOrg)));
      container.querySelectorAll('[data-edit-org]').forEach(btn => btn.addEventListener('click', () => openOrgDialog(btn.dataset.editOrg)));
    });
  }

  function orgPopupHtml(org) {
    const contacts = workspace.contacts.filter(contact => contact.organizationId === org.id).slice(0, 3);
    const activities = workspace.activities.filter(activity => activity.organizationIds.includes(org.id)).slice(0, 3);
    const relationships = workspace.relationships.filter(rel => rel.fromOrgId === org.id || rel.toOrgId === org.id).slice(0, 3);
    const contactHtml = contacts.length ? contacts.map(c => `${escapeHtml(c.name || 'Unnamed contact')}${c.role ? `, ${escapeHtml(c.role)}` : ''}`).join('<br>') : 'No linked contacts';
    const activityHtml = activities.length ? activities.map(a => `${escapeHtml(formatDate(a.date))}: ${escapeHtml(a.summary || a.type)}`).join('<br>') : 'No logged activities';
    const relationshipHtml = relationships.length ? relationships.map(r => `${escapeHtml(orgName(r.fromOrgId === org.id ? r.toOrgId : r.fromOrgId))} (${escapeHtml(r.status)})`).join('<br>') : 'No mapped relationships';
    const website = normalizeUrl(org.website);
    return `
      <div class="popup-card">
        <strong>${escapeHtml(org.name || 'Unnamed organization')}</strong>
        <div>${escapeHtml(org.type || 'No type')} | ${escapeHtml(org.status || 'No status')}</div>
        <div>Reach: ${escapeHtml(org.reach || 'Not set')} | Confidence: ${escapeHtml(org.confidence || 'Not set')}</div>
        <hr>
        <div>${escapeHtml(org.address || 'No address')}</div>
        ${org.phone ? `<div>Phone: ${escapeHtml(org.phone)}</div>` : ''}
        ${org.email ? `<div>Email: ${escapeHtml(org.email)}</div>` : ''}
        ${website ? `<div><a href="${escapeHtml(website)}" target="_blank" rel="noopener">Website</a></div>` : ''}
        ${org.focus ? `<div><b>Focus:</b> ${escapeHtml(org.focus)}</div>` : ''}
        <hr>
        <div><b>Contacts</b><br>${contactHtml}</div>
        <div><b>Recent activity</b><br>${activityHtml}</div>
        <div><b>Relationships</b><br>${relationshipHtml}</div>
      </div>`;
  }

  function zoomToOrg(id) {
    const org = workspace.organizations.find(o => o.id === id);
    if (!org || !hasCoordinates(org) || !map) return;
    map.setView([Number(org.lat), Number(org.lng)], Math.max(map.getZoom(), 14));
    const marker = markerByOrgId.get(id);
    if (marker) marker.openPopup();
  }

  function fitVisibleMapFeatures() {
    if (!map) return;
    const mapped = filteredMapOrgs().filter(hasCoordinates);
    if (!mapped.length) {
      map.setView(activeCounty.mapCenter, activeCounty.mapZoom);
      return;
    }
    const bounds = L.latLngBounds(mapped.map(org => [Number(org.lat), Number(org.lng)]));
    map.fitBounds(bounds.pad(0.2));
  }

  function resetMapFilters() {
    ['mapTypeFilter', 'mapReachFilter', 'mapConfidenceFilter', 'mapStatusFilter'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('mapSearchBox')) $('mapSearchBox').value = '';
    if ($('mapMissingOnlyToggle')) $('mapMissingOnlyToggle').checked = false;
    renderMap();
  }

  function hasCoordinates(org) {
    return Number.isFinite(Number(org?.lat)) && Number.isFinite(Number(org?.lng));
  }

  function exportBackup() {
    const payload = ConveneStorage.exportBackup(activeCounty, workspace);
    const date = new Date().toISOString().slice(0, 10);
    ConveneStorage.downloadJson(`convene-${activeCounty.id}-workspace-${date}.json`, payload);
  }

  async function restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.countyId && data.countyId !== activeCounty.id) {
        const ok = confirm(`This backup appears to be for ${data.countyName || data.countyId}, but the active county is ${activeCounty.name}. Continue anyway?`);
        if (!ok) return;
      }
      workspace = normalizeWorkspace(ConveneStorage.workspaceFromBackup(data));
      persistAndRender();
    } catch (err) {
      alert('Could not restore that backup file.');
      console.error(err);
    } finally {
      event.target.value = '';
    }
  }

  async function previewCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    const parsed = ConveneCRM.parseCsv(await file.text());
    if (!parsed.length) {
      $('csvPreview').innerHTML = '<p>No valid rows found. Make sure the CSV has a name or organization column.</p>';
      return;
    }
    const duplicates = parsed.filter(isDuplicateOrg);
    const importable = parsed.filter(org => !isDuplicateOrg(org));
    const sample = parsed.slice(0, 10);
    $('csvPreview').innerHTML = `<p>${parsed.length} rows parsed. ${duplicates.length} possible duplicate${duplicates.length === 1 ? '' : 's'} will be skipped by default. Showing first ${sample.length}.</p><table><thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Status</th></tr></thead><tbody>${sample.map(o => `<tr><td>${escapeHtml(o.name)}</td><td>${escapeHtml(o.type)}</td><td>${escapeHtml(o.address)}</td><td>${isDuplicateOrg(o) ? 'Possible duplicate' : 'Ready'}</td></tr>`).join('')}</tbody></table><p><button id="commitCsvBtn" class="primary">Append ${importable.length} New Records</button></p>`;
    $('commitCsvBtn').addEventListener('click', () => {
      workspace.organizations = workspace.organizations.concat(importable);
      persistAndRender();
      $('csvPreview').innerHTML = `<p>${importable.length} records appended to ${activeCounty.name}.</p>`;
      event.target.value = '';
    });
  }

  function isDuplicateOrg(org) {
    const name = normalizeKey(org.name);
    const address = normalizeKey(org.address);
    return workspace.organizations.some(existing => normalizeKey(existing.name) === name && (!address || normalizeKey(existing.address) === address));
  }

  function getOpenFollowUps() {
    return workspace.activities
      .filter(activity => activity.followUpDate && !activity.followUpCompleted)
      .sort((a, b) => String(a.followUpDate || '').localeCompare(String(b.followUpDate || '')));
  }

  function upsert(collection, record) {
    const index = collection.findIndex(item => item.id === record.id);
    if (index >= 0) collection[index] = record;
    else collection.push(record);
  }

  function newId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function unique(values) {
    return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function setSelectOptions(select, values, blankLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(blankLabel || '')}</option>`;
    values.forEach(value => {
      const opt = document.createElement('option');
      if (Array.isArray(value)) {
        opt.value = value[0];
        opt.textContent = value[1];
      } else {
        opt.value = value;
        opt.textContent = value;
      }
      select.appendChild(opt);
    });
    select.value = [...select.options].some(option => option.value === current) ? current : '';
  }

  function populateOrgSelect(select, selected = '', includeBlank = true) {
    select.innerHTML = includeBlank ? '<option value=""></option>' : '';
    workspace.organizations
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach(org => {
        const opt = document.createElement('option');
        opt.value = org.id;
        opt.textContent = org.name || 'Unnamed organization';
        opt.selected = org.id === selected;
        select.appendChild(opt);
      });
  }

  function populateOrgMultiSelect(select, selected = []) {
    select.innerHTML = '';
    const selectedSet = new Set(selected || []);
    workspace.organizations
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach(org => {
        const opt = document.createElement('option');
        opt.value = org.id;
        opt.textContent = org.name || 'Unnamed organization';
        opt.selected = selectedSet.has(org.id);
        select.appendChild(opt);
      });
  }

  function populateContactMultiSelect(select, selected = []) {
    select.innerHTML = '';
    const selectedSet = new Set(selected || []);
    workspace.contacts
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach(contact => {
        const opt = document.createElement('option');
        opt.value = contact.id;
        opt.textContent = `${contact.name || 'Unnamed contact'}${contact.organizationId ? ` (${orgName(contact.organizationId)})` : ''}`;
        opt.selected = selectedSet.has(contact.id);
        select.appendChild(opt);
      });
  }

  function selectedValues(select) {
    return [...select.selectedOptions].map(option => option.value).filter(Boolean);
  }

  function orgName(id) {
    return workspace.organizations.find(o => o.id === id)?.name || 'Unknown organization';
  }

  function contactName(id) {
    return workspace.contacts.find(c => c.id === id)?.name || 'Unknown contact';
  }

  function haystack(record) {
    return Object.values(record || {}).flat().join(' ').toLowerCase();
  }

  function normalizeKey(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function normalizeUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(/[;,]/).map(v => v.trim()).filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isOverdue(value) {
    if (!value) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return false;
    const due = new Date(year, month - 1, day);
    const now = new Date(new Date().toDateString());
    return due < now;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
})();
