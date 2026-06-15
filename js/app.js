(() => {
  let activeCounty;
  let workspace = emptyWorkspace();
  let map;
  let markers = [];
  let heatLayer = null;

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

    $('mapTypeFilter').addEventListener('change', renderMap);
    $('mapHeatToggle').addEventListener('change', renderMap);

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
    renderMapTypeFilter();
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
          <button data-edit-org="${org.id}">Edit</button>
          <button class="danger" data-delete-org="${org.id}">Delete</button>
        </div>
      </article>`).join('');
    list.querySelectorAll('[data-edit-org]').forEach(btn => btn.addEventListener('click', () => openOrgDialog(btn.dataset.editOrg)));
    list.querySelectorAll('[data-delete-org]').forEach(btn => btn.addEventListener('click', () => deleteOrg(btn.dataset.deleteOrg)));
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

  function renderMapTypeFilter() {
    setSelectOptions($('mapTypeFilter'), unique(workspace.organizations.map(o => o.type)), 'All service types');
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
    map.setView(activeCounty.mapCenter, activeCounty.mapZoom);
    markers.forEach(marker => marker.remove());
    markers = [];
    if (heatLayer) { heatLayer.remove(); heatLayer = null; }

    const type = $('mapTypeFilter')?.value || '';
    const mapped = workspace.organizations.filter(org => {
      const lat = Number(org.lat), lng = Number(org.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) && (!type || org.type === type);
    });

    mapped.forEach(org => {
      const marker = L.marker([Number(org.lat), Number(org.lng)]).addTo(map).bindPopup(`<strong>${escapeHtml(org.name)}</strong><br>${escapeHtml(org.type || '')}<br>${escapeHtml(org.address || '')}`);
      markers.push(marker);
    });

    if ($('mapHeatToggle')?.checked && window.L.heatLayer && mapped.length) {
      heatLayer = L.heatLayer(mapped.map(org => [Number(org.lat), Number(org.lng), 0.65]), { radius: 28 }).addTo(map);
    }

    $('mapStatus').textContent = `${mapped.length} mapped organization${mapped.length === 1 ? '' : 's'} shown.`;
    setTimeout(() => map.invalidateSize(), 100);
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
    select.value = current;
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
