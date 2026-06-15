(() => {
  const ACCESS_KEY_STORAGE = 'convene:activeAccessKey';
  const enhancementState = {
    bulkRows: [],
    bulkPreview: null,
    observerStarted: false
  };

  document.addEventListener('DOMContentLoaded', () => {
    installEnhancementStyles();
    installDetailDialog();
    applyUrlAccessKey();
    setTimeout(() => {
      enforceAccessKeyCountyScope();
      installBackupTools();
      enhanceRecordLists();
      observeRecordLists();
    }, 350);

    document.getElementById('countySelect')?.addEventListener('change', () => {
      setTimeout(() => {
        enforceAccessKeyCountyScope();
        installBackupTools();
        enhanceRecordLists();
      }, 200);
    });

    document.body.addEventListener('click', handleEnhancementClicks);
  });

  function installEnhancementStyles() {
    if (document.getElementById('conveneParityEnhancementStyles')) return;
    const style = document.createElement('style');
    style.id = 'conveneParityEnhancementStyles';
    style.textContent = `
      .convene-detail-dialog { width: min(1020px, 94vw); max-height: 88vh; border: 0; border-radius: 18px; padding: 0; box-shadow: 0 24px 80px rgba(0,0,0,.28); }
      .convene-detail-dialog::backdrop { background: rgba(15, 23, 42, .46); }
      .detail-shell { display: grid; grid-template-rows: auto 1fr auto; max-height: 88vh; }
      .detail-header { padding: 18px 22px; border-bottom: 1px solid var(--line); background: linear-gradient(135deg, #fff, #f7f7f7); }
      .detail-header h3 { margin: 0 0 4px; font-size: 1.35rem; }
      .detail-header p { margin: 0; color: var(--muted); }
      .detail-body { overflow-y: auto; padding: 18px 22px; display: grid; gap: 14px; }
      .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
      .detail-card { border: 1px solid var(--line); border-radius: 14px; padding: 13px; background: #fff; }
      .detail-card h4 { margin: 0 0 8px; font-size: .96rem; }
      .detail-row { display: grid; grid-template-columns: 125px 1fr; gap: 9px; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
      .detail-row:last-child { border-bottom: 0; }
      .detail-row span:first-child { color: var(--muted); font-weight: 700; }
      .detail-notes { white-space: pre-wrap; line-height: 1.45; }
      .detail-list { display: grid; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 5px; }
      .detail-list-item { border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #fafafa; }
      .detail-list-item strong, .detail-list-item span, .detail-list-item small { display: block; }
      .detail-list-item small { color: var(--muted); margin-top: 3px; line-height: 1.35; }
      .detail-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 22px; border-top: 1px solid var(--line); background: #fff; }
      .bulk-tool-card textarea, .access-tool-card textarea { width: 100%; min-height: 86px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .85rem; }
      .bulk-preview-box { margin-top: 12px; max-height: 330px; overflow-y: auto; border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: #fff; }
      .bulk-preview-box table { width: 100%; border-collapse: collapse; }
      .bulk-preview-box th, .bulk-preview-box td { border-bottom: 1px solid var(--line); padding: 7px; text-align: left; vertical-align: top; }
      .pill { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: .76rem; font-weight: 800; background: #eee; }
      .pill-ready { background: #dcfce7; color: #166534; }
      .pill-update { background: #dbeafe; color: #1d4ed8; }
      .pill-skip { background: #f3f4f6; color: #4b5563; }
      .pill-warn { background: #fef3c7; color: #92400e; }
      .access-lock-note { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: #fff7ed; color: #9a3412; font-weight: 700; }
      .record-item .small-actions button[data-detail-org],
      .record-item .small-actions button[data-detail-contact],
      .record-item .small-actions button[data-detail-activity],
      .record-item .small-actions button[data-detail-relationship] { font-weight: 700; }
    `;
    document.head.appendChild(style);
  }

  function installDetailDialog() {
    if (document.getElementById('conveneDetailDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'conveneDetailDialog';
    dialog.className = 'convene-detail-dialog';
    dialog.innerHTML = `
      <div class="detail-shell">
        <header class="detail-header"><h3 id="detailTitle">Record detail</h3><p id="detailSubtitle"></p></header>
        <div id="detailBody" class="detail-body"></div>
        <footer class="detail-actions">
          <button type="button" id="detailMapBtn">Show on map</button>
          <button type="button" id="detailEditBtn" class="primary">Edit</button>
          <button type="button" id="detailCloseBtn">Close</button>
        </footer>
      </div>`;
    document.body.appendChild(dialog);
    document.getElementById('detailCloseBtn')?.addEventListener('click', () => dialog.close());
  }

  function handleEnhancementClicks(event) {
    const detailOrg = event.target.closest('[data-detail-org]');
    const detailContact = event.target.closest('[data-detail-contact]');
    const detailActivity = event.target.closest('[data-detail-activity]');
    const detailRelationship = event.target.closest('[data-detail-relationship]');

    if (detailOrg) return openOrgDetail(detailOrg.dataset.detailOrg);
    if (detailContact) return openContactDetail(detailContact.dataset.detailContact);
    if (detailActivity) return openActivityDetail(detailActivity.dataset.detailActivity);
    if (detailRelationship) return openRelationshipDetail(detailRelationship.dataset.detailRelationship);
  }

  function enhanceRecordLists() {
    addViewButtons('orgList', '[data-edit-org]', 'detailOrg');
    addViewButtons('contactList', '[data-edit-contact]', 'detailContact');
    addViewButtons('activityList', '[data-edit-activity]', 'detailActivity');
    addViewButtons('relationshipList', '[data-edit-relationship]', 'detailRelationship');
  }

  function addViewButtons(listId, editSelector, datasetName) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.querySelectorAll('.record-item').forEach(item => {
      const editButton = item.querySelector(editSelector);
      if (!editButton) return;
      const id = Object.values(editButton.dataset)[0];
      const actions = editButton.closest('.small-actions');
      if (!actions || actions.querySelector(`[data-${kebab(datasetName)}="${cssEscape(id)}"]`)) return;
      const view = document.createElement('button');
      view.type = 'button';
      view.textContent = 'View';
      view.dataset[datasetName] = id;
      actions.insertBefore(view, editButton);
    });
  }

  function observeRecordLists() {
    if (enhancementState.observerStarted) return;
    enhancementState.observerStarted = true;
    const observer = new MutationObserver(() => setTimeout(enhanceRecordLists, 80));
    ['orgList', 'contactList', 'activityList', 'relationshipList'].forEach(id => {
      const target = document.getElementById(id);
      if (target) observer.observe(target, { childList: true, subtree: true });
    });
  }

  function openOrgDetail(id) {
    const data = workspace();
    const org = (data.organizations || []).find(o => o.id === id);
    if (!org) return;
    const contacts = (data.contacts || []).filter(c => c.organizationId === id);
    const activities = (data.activities || []).filter(a => toArray(a.organizationIds || a.orgIds || a.organizations).includes(id)).sort(dateDesc);
    const relationships = (data.relationships || []).filter(r => relationFrom(r) === id || relationTo(r) === id);
    const website = normalizeUrl(org.website);

    showDetail({
      title: org.name || 'Unnamed organization',
      subtitle: `${org.type || 'No type'} | ${org.status || 'No status'}`,
      edit: () => clickMainEdit('org', id),
      map: hasCoordinates(org) ? () => mapSearch(org.name || '') : null,
      html: `
        <div class="detail-grid">
          <section class="detail-card"><h4>Profile</h4>${rows([
            ['Type', org.type], ['Status', org.status], ['Reach', org.reach || org.geographicReach], ['Confidence', org.confidence || org.reachConfidence], ['Address', org.address], ['City', org.city], ['County', org.county]
          ])}</section>
          <section class="detail-card"><h4>Contact info</h4>${rows([
            ['Primary contact', org.primaryContact], ['Phone', org.phone], ['Email', mailLink(org.email)], ['Website', website ? `<a href="${escapeAttr(website)}" target="_blank" rel="noopener">${escapeHtml(org.website || website)}</a>` : '']
          ], true)}</section>
          <section class="detail-card"><h4>Map / reach</h4>${rows([
            ['Latitude', org.lat ?? org.latitude], ['Longitude', org.lng ?? org.longitude], ['Communities served', org.communitiesServed], ['Reach basis', org.reachBasis], ['Reach source', org.reachSourceUrl ? `<a href="${escapeAttr(normalizeUrl(org.reachSourceUrl))}" target="_blank" rel="noopener">Open source</a>` : '']
          ], true)}</section>
        </div>
        <section class="detail-card"><h4>Focus / mission</h4>${org.focus || org.tags ? `<p class="detail-notes"><b>Focus:</b> ${escapeHtml(org.focus || org.tags)}</p>` : ''}${org.mission || org.description ? `<p class="detail-notes">${escapeHtml(org.mission || org.description)}</p>` : '<p class="muted">No mission/description recorded.</p>'}</section>
        <section class="detail-card"><h4>Notes</h4><p class="detail-notes">${escapeHtml(org.notes || 'No notes recorded.')}</p></section>
        <div class="detail-grid">
          <section class="detail-card"><h4>Linked contacts (${contacts.length})</h4>${listHtml(contacts, c => `<strong>${escapeHtml(c.name || 'Unnamed contact')}</strong><span>${escapeHtml(c.role || 'No role')}</span><small>${escapeHtml([c.email, c.phone].filter(Boolean).join(' | ') || 'No email/phone')}</small>`)}</section>
          <section class="detail-card"><h4>Recent activities (${activities.length})</h4>${listHtml(activities.slice(0, 8), a => `<strong>${escapeHtml(formatDate(a.date))} | ${escapeHtml(a.type || 'Activity')}</strong><span>${escapeHtml(a.summary || 'Untitled activity')}</span><small>${escapeHtml(followUpLabel(a))}</small>`)}</section>
          <section class="detail-card"><h4>Relationships (${relationships.length})</h4>${listHtml(relationships, r => `<strong>${escapeHtml(otherOrgName(r, id, data.organizations))}</strong><span>${escapeHtml(r.status || 'No status')} | ${escapeHtml(r.strength || 'No strength')}</span><small>${escapeHtml(r.summary || r.notes || 'No summary')}</small>`)}</section>
        </div>`
    });
  }

  function openContactDetail(id) {
    const data = workspace();
    const contact = (data.contacts || []).find(c => c.id === id);
    if (!contact) return;
    const org = (data.organizations || []).find(o => o.id === contact.organizationId);
    const activities = (data.activities || []).filter(a => toArray(a.contactIds || a.contacts).includes(id)).sort(dateDesc);
    showDetail({
      title: contact.name || 'Unnamed contact',
      subtitle: `${contact.role || 'No role'} | ${org?.name || 'No organization linked'}`,
      edit: () => clickMainEdit('contact', id),
      map: org && hasCoordinates(org) ? () => mapSearch(org.name || '') : null,
      html: `
        <div class="detail-grid">
          <section class="detail-card"><h4>Contact</h4>${rows([
            ['Organization', org?.name], ['Role', contact.role], ['Email', mailLink(contact.email)], ['Phone', contact.phone], ['Strength', contact.strength]
          ], true)}</section>
          <section class="detail-card"><h4>Notes</h4><p class="detail-notes">${escapeHtml(contact.notes || 'No notes recorded.')}</p></section>
        </div>
        <section class="detail-card"><h4>Linked activities (${activities.length})</h4>${listHtml(activities, a => `<strong>${escapeHtml(formatDate(a.date))} | ${escapeHtml(a.type || 'Activity')}</strong><span>${escapeHtml(a.summary || 'Untitled activity')}</span><small>${escapeHtml(toArray(a.organizationIds).map(orgId => orgName(orgId, data.organizations)).join(', ') || 'No organization linked')}</small>`)}</section>`
    });
  }

  function openActivityDetail(id) {
    const data = workspace();
    const activity = (data.activities || []).find(a => a.id === id);
    if (!activity) return;
    const orgs = toArray(activity.organizationIds || activity.orgIds || activity.organizations).map(orgId => data.organizations.find(o => o.id === orgId)).filter(Boolean);
    const contacts = toArray(activity.contactIds || activity.contacts).map(contactId => data.contacts.find(c => c.id === contactId)).filter(Boolean);
    showDetail({
      title: activity.summary || 'Untitled activity',
      subtitle: `${formatDate(activity.date)} | ${activity.type || 'Activity'}`,
      edit: () => clickMainEdit('activity', id),
      map: orgs.find(hasCoordinates) ? () => mapSearch(orgs.find(hasCoordinates).name || '') : null,
      html: `
        <div class="detail-grid">
          <section class="detail-card"><h4>Activity</h4>${rows([
            ['Date', formatDate(activity.date)], ['Type', activity.type], ['Follow-up date', activity.followUpDate ? formatDate(activity.followUpDate) : ''], ['Follow-up status', activity.followUpDate ? (activity.followUpCompleted ? 'Completed' : 'Open') : 'No follow-up']
          ])}</section>
          <section class="detail-card"><h4>Organizations</h4>${listHtml(orgs, o => `<strong>${escapeHtml(o.name || 'Unnamed organization')}</strong><span>${escapeHtml(o.type || 'No type')}</span><small>${escapeHtml(o.address || 'No address')}</small>`)}</section>
          <section class="detail-card"><h4>Contacts</h4>${listHtml(contacts, c => `<strong>${escapeHtml(c.name || 'Unnamed contact')}</strong><span>${escapeHtml(c.role || 'No role')}</span><small>${escapeHtml([c.email, c.phone].filter(Boolean).join(' | ') || 'No email/phone')}</small>`)}</section>
        </div>
        <section class="detail-card"><h4>Notes</h4><p class="detail-notes">${escapeHtml(activity.notes || 'No notes recorded.')}</p></section>`
    });
  }

  function openRelationshipDetail(id) {
    const data = workspace();
    const rel = (data.relationships || []).find(r => r.id === id);
    if (!rel) return;
    const from = data.organizations.find(o => o.id === relationFrom(rel));
    const to = data.organizations.find(o => o.id === relationTo(rel));
    showDetail({
      title: `${from?.name || 'Unknown organization'} ↔ ${to?.name || 'Unknown organization'}`,
      subtitle: `${rel.status || 'No status'} | ${rel.strength || 'No strength'}`,
      edit: () => clickMainEdit('relationship', id),
      map: from?.name ? () => mapSearch(from.name) : null,
      html: `
        <div class="detail-grid">
          <section class="detail-card"><h4>Relationship</h4>${rows([
            ['Organization A', from?.name], ['Organization B', to?.name], ['Status', rel.status], ['Strength', rel.strength], ['Summary', rel.summary]
          ])}</section>
          <section class="detail-card"><h4>Notes</h4><p class="detail-notes">${escapeHtml(rel.notes || 'No notes recorded.')}</p></section>
        </div>`
    });
  }

  function showDetail({ title, subtitle, html, edit, map }) {
    const dialog = document.getElementById('conveneDetailDialog');
    document.getElementById('detailTitle').textContent = title || 'Record detail';
    document.getElementById('detailSubtitle').textContent = subtitle || '';
    document.getElementById('detailBody').innerHTML = html || '';
    const editBtn = document.getElementById('detailEditBtn');
    const mapBtn = document.getElementById('detailMapBtn');
    editBtn.onclick = () => { dialog.close(); edit?.(); };
    mapBtn.onclick = () => { dialog.close(); map?.(); };
    mapBtn.style.display = map ? '' : 'none';
    dialog.showModal();
  }

  function installBackupTools() {
    const backupView = document.getElementById('backupView');
    if (!backupView) return;
    installBulkUpdateCard(backupView);
    installAccessKeyCard(backupView);
  }

  function installBulkUpdateCard(backupView) {
    if (document.getElementById('bulkUpdateCard')) return;
    const card = document.createElement('div');
    card.id = 'bulkUpdateCard';
    card.className = 'card bulk-tool-card';
    card.innerHTML = `
      <h3>Bulk organization update</h3>
      <p>Upload a CSV to update existing organizations by ID, name + address, or name. New rows can also be appended after preview.</p>
      <div class="grid two-col">
        <label>CSV file<input id="bulkUpdateCsvFile" type="file" accept=".csv,text/csv" /></label>
        <div>
          <label class="checkline"><input id="bulkAppendNew" type="checkbox" checked /> Append rows that do not match existing organizations</label>
          <label class="checkline"><input id="bulkClearBlank" type="checkbox" /> Allow blank CSV cells to clear existing values</label>
        </div>
      </div>
      <div class="small-actions" style="margin-top:10px"><button id="exportOrgCsvBtn">Export Organizations CSV</button></div>
      <div id="bulkUpdatePreview" class="bulk-preview-box"><p class="muted">No bulk update file selected yet.</p></div>`;
    backupView.appendChild(card);

    document.getElementById('bulkUpdateCsvFile')?.addEventListener('change', handleBulkCsvFile);
    document.getElementById('bulkAppendNew')?.addEventListener('change', renderBulkPreview);
    document.getElementById('bulkClearBlank')?.addEventListener('change', renderBulkPreview);
    document.getElementById('exportOrgCsvBtn')?.addEventListener('click', exportOrganizationsCsv);
  }

  function installAccessKeyCard(backupView) {
    if (document.getElementById('accessKeyCard')) return;
    const card = document.createElement('div');
    card.id = 'accessKeyCard';
    card.className = 'card access-tool-card';
    card.innerHTML = `
      <h3>County access key / launch link</h3>
      <p>Create a county-specific key or launch link. County users can be locked to their county without changing the shared app.</p>
      <div class="grid two-col">
        <label>County<select id="accessCountySelect"></select></label>
        <label>Role<select id="accessRoleSelect"><option value="county_user">County user</option><option value="admin">Admin / all counties</option></select></label>
      </div>
      <div class="small-actions" style="margin-top:10px">
        <button id="generateAccessKeyBtn" class="primary">Generate Key</button>
        <button id="downloadAccessKeyBtn">Download Key</button>
        <button id="clearAccessLockBtn">Clear Local Access Lock</button>
      </div>
      <textarea id="accessKeyOutput" readonly placeholder="Generated key JSON will appear here."></textarea>
      <label>Import access key<input id="importAccessKeyFile" type="file" accept="application/json" /></label>
      <div id="accessLinkOutput" class="access-lock-note"></div>`;
    backupView.appendChild(card);
    populateAccessCountySelect();
    renderAccessLockNote();

    document.getElementById('generateAccessKeyBtn')?.addEventListener('click', generateAccessKey);
    document.getElementById('downloadAccessKeyBtn')?.addEventListener('click', downloadAccessKey);
    document.getElementById('clearAccessLockBtn')?.addEventListener('click', clearAccessLock);
    document.getElementById('importAccessKeyFile')?.addEventListener('change', importAccessKeyFile);
  }

  function populateAccessCountySelect() {
    const select = document.getElementById('accessCountySelect');
    if (!select || !window.CONVENE_COUNTIES) return;
    select.innerHTML = Object.values(window.CONVENE_COUNTIES).map(county => `<option value="${escapeAttr(county.id)}">${escapeHtml(county.name)}</option>`).join('');
    select.value = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
  }

  async function handleBulkCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    enhancementState.bulkRows = parseCsv(await file.text()).map(normalizeOrgRow).filter(row => row.name || row.id);
    renderBulkPreview();
  }

  function renderBulkPreview() {
    const container = document.getElementById('bulkUpdatePreview');
    if (!container) return;
    const rows = enhancementState.bulkRows || [];
    if (!rows.length) {
      container.innerHTML = '<p class="muted">No valid rows loaded. The CSV needs at least a name or id column.</p>';
      return;
    }
    const preview = buildBulkPreview(rows);
    enhancementState.bulkPreview = preview;
    const sample = preview.items.slice(0, 18);
    container.innerHTML = `
      <p><b>${rows.length}</b> valid CSV rows parsed. <b>${preview.updateCount}</b> update existing records, <b>${preview.appendCount}</b> append as new, <b>${preview.skipCount}</b> skipped/unchanged.</p>
      <table><thead><tr><th>Status</th><th>Name</th><th>Match</th><th>Changed fields</th></tr></thead><tbody>
        ${sample.map(item => `<tr><td>${bulkPill(item.status)}</td><td>${escapeHtml(item.row.name || item.match?.name || 'Unnamed')}</td><td>${escapeHtml(item.match?.name || item.reason || 'New record')}</td><td>${escapeHtml(item.changedFields.join(', ') || item.reason || 'None')}</td></tr>`).join('')}
      </tbody></table>
      ${preview.items.length > sample.length ? `<p class="muted">Showing first ${sample.length} rows.</p>` : ''}
      <div class="small-actions" style="margin-top:10px"><button id="commitBulkUpdateBtn" class="primary">Apply Bulk Update</button></div>`;
    document.getElementById('commitBulkUpdateBtn')?.addEventListener('click', commitBulkUpdate);
  }

  function buildBulkPreview(rows) {
    const data = workspace();
    const organizations = data.organizations || [];
    const appendNew = document.getElementById('bulkAppendNew')?.checked !== false;
    const clearBlank = Boolean(document.getElementById('bulkClearBlank')?.checked);
    const items = rows.map(row => {
      const match = findOrgMatch(row, organizations);
      if (match.ambiguous) return { row, status: 'warn', reason: 'Ambiguous name match', match: null, changedFields: [] };
      if (match.org) {
        const changedFields = changedOrgFields(match.org, row, clearBlank);
        return { row, status: changedFields.length ? 'update' : 'skip', match: match.org, changedFields, reason: changedFields.length ? '' : 'No changes' };
      }
      return { row, status: appendNew ? 'append' : 'skip', match: null, changedFields: Object.keys(row).filter(key => row[key]), reason: appendNew ? '' : 'Append disabled' };
    });
    return {
      items,
      updateCount: items.filter(i => i.status === 'update').length,
      appendCount: items.filter(i => i.status === 'append').length,
      skipCount: items.filter(i => i.status === 'skip' || i.status === 'warn').length,
      clearBlank
    };
  }

  function commitBulkUpdate() {
    const preview = enhancementState.bulkPreview;
    if (!preview) return;
    const county = activeCounty();
    const data = workspace();
    const organizations = (data.organizations || []).slice();
    preview.items.forEach(item => {
      if (item.status === 'update' && item.match) {
        const index = organizations.findIndex(org => org.id === item.match.id);
        if (index >= 0) organizations[index] = mergeOrg(organizations[index], item.row, preview.clearBlank);
      }
      if (item.status === 'append') organizations.push(normalizeNewOrg(item.row));
    });
    data.organizations = organizations;
    window.ConveneStorage.saveWorkspace(county, data);
    document.getElementById('bulkUpdatePreview').innerHTML = `<p>${preview.updateCount} records updated and ${preview.appendCount} records appended for ${escapeHtml(county.name)}. Refreshing the workspace...</p>`;
    setTimeout(() => window.location.reload(), 650);
  }

  function exportOrganizationsCsv() {
    const data = workspace();
    const columns = ['id','name','type','status','address','city','county','phone','email','website','primaryContact','lat','lng','reach','confidence','focus','mission','notes','communitiesServed','reachNotes','reachBasis','reachSourceUrl'];
    const csv = [columns.join(',')].concat((data.organizations || []).map(org => columns.map(col => csvCell(org[col] ?? org[legacyField(col)] ?? '')).join(','))).join('\n');
    downloadText(`convene-${activeCounty().id}-organizations.csv`, csv, 'text/csv');
  }

  function generateAccessKey() {
    const countyId = document.getElementById('accessCountySelect')?.value || activeCounty().id;
    const county = window.CONVENE_COUNTIES?.[countyId] || activeCounty();
    const role = document.getElementById('accessRoleSelect')?.value || 'county_user';
    const key = {
      system: 'CONVENE',
      edition: 'multi-county',
      role,
      countyId: county.id,
      countyName: county.name,
      allowedCounties: role === 'admin' ? Object.keys(window.CONVENE_COUNTIES || {}) : [county.id],
      canGenerateKeys: role === 'admin',
      createdAt: new Date().toISOString()
    };
    const output = document.getElementById('accessKeyOutput');
    output.value = JSON.stringify(key, null, 2);
    const token = encodeAccessKey(key);
    const url = `${window.location.origin}${window.location.pathname}?accessKey=${encodeURIComponent(token)}`;
    document.getElementById('accessLinkOutput').innerHTML = `Launch link:<br><a href="${escapeAttr(url)}">${escapeHtml(url)}</a>`;
  }

  function downloadAccessKey() {
    const raw = document.getElementById('accessKeyOutput')?.value.trim();
    if (!raw) generateAccessKey();
    const payload = document.getElementById('accessKeyOutput')?.value.trim();
    if (!payload) return;
    const data = JSON.parse(payload);
    downloadText(`convene-access-key-${data.countyId || 'admin'}.json`, payload, 'application/json');
  }

  async function importAccessKeyFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const key = JSON.parse(await file.text());
      saveAccessKey(key);
      enforceAccessKeyCountyScope();
      renderAccessLockNote();
      alert(`Access key applied for ${key.countyName || key.countyId || 'CONVENE'}.`);
    } catch (err) {
      alert('Could not read that access key file.');
    } finally {
      event.target.value = '';
    }
  }

  function applyUrlAccessKey() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('accessKey');
    if (!encoded) return;
    const key = decodeAccessKey(encoded);
    if (!key) return;
    saveAccessKey(key);
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  function saveAccessKey(key) {
    localStorage.setItem(ACCESS_KEY_STORAGE, JSON.stringify(key));
    const countyId = key.countyId || key.allowedCounties?.[0];
    if (countyId && window.CONVENE_COUNTIES?.[countyId]) localStorage.setItem('convene:lastCounty', countyId);
  }

  function currentAccessKey() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY_STORAGE) || 'null'); } catch { return null; }
  }

  function enforceAccessKeyCountyScope() {
    const key = currentAccessKey();
    const countySelect = document.getElementById('countySelect');
    if (!key || !countySelect || key.role === 'admin') return;
    const allowed = new Set(key.allowedCounties || [key.countyId].filter(Boolean));
    [...countySelect.options].forEach(option => { option.hidden = !allowed.has(option.value); option.disabled = !allowed.has(option.value); });
    if (!allowed.has(countySelect.value)) {
      const first = [...allowed][0];
      if (first && window.CONVENE_COUNTIES?.[first]) {
        countySelect.value = first;
        countySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    renderAccessLockNote();
  }

  function clearAccessLock() {
    localStorage.removeItem(ACCESS_KEY_STORAGE);
    [...(document.getElementById('countySelect')?.options || [])].forEach(option => { option.hidden = false; option.disabled = false; });
    renderAccessLockNote();
  }

  function renderAccessLockNote() {
    const key = currentAccessKey();
    const output = document.getElementById('accessLinkOutput');
    if (!output) return;
    if (!key) {
      output.textContent = 'No local access lock is currently applied in this browser.';
      return;
    }
    output.textContent = key.role === 'admin'
      ? 'Admin key is applied locally. All configured counties remain available.'
      : `County key is applied locally. This browser is limited to ${key.countyName || key.countyId}.`;
  }

  function clickMainEdit(type, id) {
    const viewMap = { org: 'orgView', contact: 'contactView', activity: 'activityView', relationship: 'relationshipView' };
    const editSelector = { org: `[data-edit-org="${cssEscape(id)}"]`, contact: `[data-edit-contact="${cssEscape(id)}"]`, activity: `[data-edit-activity="${cssEscape(id)}"]`, relationship: `[data-edit-relationship="${cssEscape(id)}"]` }[type];
    showView(viewMap[type]);
    clearListFilters(type);
    setTimeout(() => {
      enhanceRecordLists();
      document.querySelector(editSelector)?.click();
    }, 170);
  }

  function mapSearch(name) {
    showView('mapView');
    setTimeout(() => {
      const search = document.getElementById('mapSearchBox');
      if (search) {
        search.value = name || '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 180);
  }

  function showView(viewId) {
    document.querySelector(`[data-view="${viewId}"]`)?.click();
  }

  function clearListFilters(type) {
    const ids = {
      org: ['orgSearchBox', 'orgTypeFilter'],
      contact: ['contactSearchBox', 'contactOrgFilter'],
      activity: ['activitySearchBox', 'activityTypeFilter', 'activityTaskFilter'],
      relationship: ['relationshipSearchBox', 'relationshipStatusFilter']
    }[type] || [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = '';
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  }

  function workspace() {
    const county = activeCounty();
    return window.ConveneStorage?.loadWorkspace(county) || { organizations: [], contacts: [], activities: [], relationships: [] };
  }

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.ConveneAccess?.activeCountyId?.() || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }

  function normalizeOrgRow(row) {
    const pick = (...keys) => keys.map(k => row[k]).find(v => v != null && String(v).trim() !== '') || '';
    return {
      id: pick('id', 'ID'),
      name: pick('name', 'organization', 'Organization', 'orgName'),
      type: pick('type', 'category', 'serviceType'),
      status: pick('status'),
      address: pick('address'),
      city: pick('city'),
      county: pick('county'),
      phone: pick('phone'),
      email: pick('email'),
      website: pick('website', 'url'),
      primaryContact: pick('primaryContact', 'contact', 'contactName'),
      lat: cleanLng(pick('lat', 'latitude')),
      lng: cleanLng(pick('lng', 'lon', 'long', 'longitude')),
      reach: pick('reach', 'geographicReach'),
      confidence: pick('confidence', 'reachConfidence'),
      focus: pick('focus', 'tags'),
      mission: pick('mission', 'description'),
      notes: pick('notes'),
      communitiesServed: pick('communitiesServed'),
      reachNotes: pick('reachNotes'),
      reachBasis: pick('reachBasis'),
      reachSourceUrl: pick('reachSourceUrl')
    };
  }

  function normalizeNewOrg(row) {
    return { ...row, id: row.id || `org_${Date.now()}_${Math.random().toString(16).slice(2)}` };
  }

  function findOrgMatch(row, organizations) {
    if (row.id) {
      const byId = organizations.find(org => org.id === row.id);
      if (byId) return { org: byId };
    }
    const name = norm(row.name);
    const address = norm(row.address);
    if (!name) return { org: null };
    if (address) {
      const exact = organizations.find(org => norm(org.name) === name && norm(org.address) === address);
      if (exact) return { org: exact };
    }
    const nameMatches = organizations.filter(org => norm(org.name) === name);
    if (nameMatches.length === 1) return { org: nameMatches[0] };
    if (nameMatches.length > 1) return { ambiguous: true };
    return { org: null };
  }

  function changedOrgFields(existing, row, clearBlank) {
    return Object.keys(row).filter(field => field !== 'id' && (clearBlank || String(row[field] || '').trim()) && String(existing[field] ?? legacyValue(existing, field) ?? '') !== String(row[field] ?? ''));
  }

  function mergeOrg(existing, row, clearBlank) {
    const merged = { ...existing };
    Object.entries(row).forEach(([field, value]) => {
      if (field === 'id') return;
      if (!clearBlank && String(value || '').trim() === '') return;
      merged[field] = value;
    });
    return merged;
  }

  function legacyValue(org, field) {
    const map = { reach: 'geographicReach', confidence: 'reachConfidence', focus: 'tags', mission: 'description', lat: 'latitude', lng: 'longitude' };
    return org[map[field]];
  }

  function legacyField(field) {
    return { reach: 'geographicReach', confidence: 'reachConfidence', focus: 'tags', mission: 'description', lat: 'latitude', lng: 'longitude' }[field] || field;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = ''; continue;
      }
      cell += char;
    }
    row.push(cell); rows.push(row);
    const headers = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(v => String(v || '').trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
  }

  function rows(items, htmlValues = false) {
    const rendered = items.filter(([, value]) => value != null && String(value).trim() !== '').map(([label, value]) => `<div class="detail-row"><span>${escapeHtml(label)}</span><span>${htmlValues ? value : escapeHtml(value)}</span></div>`).join('');
    return rendered || '<p class="muted">No data recorded.</p>';
  }

  function listHtml(items, renderer) {
    return items.length ? `<div class="detail-list">${items.map(item => `<article class="detail-list-item">${renderer(item)}</article>`).join('')}</div>` : '<p class="muted">No linked records.</p>';
  }

  function relationFrom(rel) { return rel.fromOrgId || rel.sourceOrgId || ''; }
  function relationTo(rel) { return rel.toOrgId || rel.targetOrgId || ''; }

  function otherOrgName(rel, currentId, orgs) {
    const otherId = relationFrom(rel) === currentId ? relationTo(rel) : relationFrom(rel);
    return orgName(otherId, orgs);
  }

  function orgName(id, orgs) {
    return (orgs || workspace().organizations || []).find(o => o.id === id)?.name || 'Unknown organization';
  }

  function followUpLabel(activity) {
    if (!activity.followUpDate) return 'No follow-up task';
    return `Follow-up: ${formatDate(activity.followUpDate)} ${activity.followUpCompleted ? '(completed)' : '(open)'}`;
  }

  function dateDesc(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }
  function toArray(value) { return Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(/[,;|]/).map(v => v.trim()).filter(Boolean); }
  function hasCoordinates(org) { return Number.isFinite(Number(org?.lat ?? org?.latitude)) && Number.isFinite(Number(org?.lng ?? org?.longitude)); }
  function cleanLng(value) { const text = String(value ?? '').trim(); return text.startsWith('--') ? `-${text.slice(2)}` : text; }
  function norm(value) { return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function normalizeUrl(value) { const url = String(value || '').trim(); return !url ? '' : /^https?:\/\//i.test(url) ? url : `https://${url}`; }
  function mailLink(value) { const email = String(value || '').trim(); return email ? `<a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>` : ''; }
  function formatDate(value) { if (!value) return 'No date'; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function bulkPill(status) { return `<span class="pill pill-${status === 'append' ? 'ready' : status}">${status === 'append' ? 'append' : status}</span>`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
  function cssEscape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
  function kebab(value) { return value.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`); }
  function downloadText(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
  function encodeAccessKey(key) { return btoa(unescape(encodeURIComponent(JSON.stringify(key)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function decodeAccessKey(token) { try { const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '='); return JSON.parse(decodeURIComponent(escape(atob(padded)))); } catch { return null; } }
})();
