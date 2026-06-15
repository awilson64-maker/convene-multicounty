(() => {
  let activeCounty;
  let orgs = [];
  let map;
  let markers = [];

  const $ = id => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    populateCountySelect();
    bindNavigation();
    bindCrmActions();
    setCounty(ConveneAccess.activeCountyId());
  }

  function populateCountySelect() {
    const select = $('countySelect');
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
    orgs = ConveneStorage.loadOrgs(activeCounty).map(ConveneCRM.normalizeOrg);
    renderAll();
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        $(btn.dataset.view).classList.add('active');
        if (btn.dataset.view === 'mapView') setTimeout(renderMap, 50);
        if (btn.dataset.view === 'censusView') ConveneCensus.renderCountyCensus(activeCounty, $('censusPanel'));
      });
    });
  }

  function bindCrmActions() {
    $('addOrgBtn').addEventListener('click', () => openOrgDialog());
    $('saveOrgBtn').addEventListener('click', event => { event.preventDefault(); saveOrgFromForm(); });
    $('searchBox').addEventListener('input', renderOrgList);
    $('typeFilter').addEventListener('change', renderOrgList);
    $('exportBtn').addEventListener('click', exportBackup);
    $('restoreFile').addEventListener('change', restoreBackup);
    $('csvFile').addEventListener('change', previewCsv);
  }

  function renderAll() {
    renderDashboard();
    renderTypeFilter();
    renderOrgList();
    renderMap();
    ConveneCensus.renderCountyCensus(activeCounty, $('censusPanel'));
  }

  function renderDashboard() {
    const mapped = orgs.filter(o => Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng))).length;
    const types = new Set(orgs.map(o => o.type).filter(Boolean));
    $('orgCount').textContent = orgs.length;
    $('typeCount').textContent = types.size;
    $('mappedCount').textContent = mapped;
    $('activeCountyId').textContent = activeCounty.id;
    $('countySummary').textContent = `${activeCounty.description} Storage namespace: ${activeCounty.storagePrefix}. Census source: ${activeCounty.censusFile}.`;
  }

  function renderTypeFilter() {
    const select = $('typeFilter');
    const current = select.value;
    select.innerHTML = '<option value="">All types</option>';
    [...new Set(orgs.map(o => o.type).filter(Boolean))].sort().forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      select.appendChild(opt);
    });
    select.value = current;
  }

  function filteredOrgs() {
    const term = $('searchBox').value.toLowerCase().trim();
    const type = $('typeFilter').value;
    return orgs.filter(org => {
      const matchesType = !type || org.type === type;
      const haystack = Object.values(org).join(' ').toLowerCase();
      return matchesType && (!term || haystack.includes(term));
    });
  }

  function renderOrgList() {
    const list = $('orgList');
    const rows = filteredOrgs();
    if (!rows.length) {
      list.innerHTML = '<div class="card">No organization records found for this county yet.</div>';
      return;
    }
    list.innerHTML = rows.map(org => `
      <article class="org-item">
        <div>
          <h3>${escapeHtml(org.name || 'Unnamed organization')}</h3>
          <div class="org-meta">${escapeHtml(org.type || 'No type')} | ${escapeHtml(org.status || 'No status')} | ${escapeHtml(org.address || 'No address')}</div>
        </div>
        <button data-edit="${org.id}">Edit</button>
      </article>`).join('');
    list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openOrgDialog(btn.dataset.edit)));
  }

  function openOrgDialog(id) {
    const org = id ? orgs.find(o => o.id === id) : ConveneCRM.normalizeOrg({ status: 'Active', reach: 'Countywide', confidence: 'Medium' });
    $('dialogTitle').textContent = id ? 'Edit Organization' : 'Add Organization';
    $('orgId').value = org.id || '';
    ConveneCRM.fields.forEach(field => { if ($(field)) $(field).value = org[field] || ''; });
    $('orgDialog').showModal();
  }

  function saveOrgFromForm() {
    const data = { id: $('orgId').value || undefined };
    ConveneCRM.fields.forEach(field => { if ($(field)) data[field] = $(field).value.trim(); });
    const saved = ConveneCRM.normalizeOrg(data);
    const index = orgs.findIndex(o => o.id === saved.id);
    if (index >= 0) orgs[index] = saved; else orgs.push(saved);
    persistAndRender();
    $('orgDialog').close();
  }

  function persistAndRender() {
    ConveneStorage.saveOrgs(activeCounty, orgs);
    renderAll();
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
    orgs.forEach(org => {
      const lat = Number(org.lat), lng = Number(org.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${escapeHtml(org.name)}</strong><br>${escapeHtml(org.type || '')}<br>${escapeHtml(org.address || '')}`);
      markers.push(marker);
    });
    setTimeout(() => map.invalidateSize(), 100);
  }

  function exportBackup() {
    const payload = ConveneStorage.exportBackup(activeCounty, orgs);
    const date = new Date().toISOString().slice(0, 10);
    ConveneStorage.downloadJson(`convene-${activeCounty.id}-backup-${date}.json`, payload);
  }

  async function restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (data.countyId && data.countyId !== activeCounty.id) {
      const ok = confirm(`This backup appears to be for ${data.countyName || data.countyId}, but the active county is ${activeCounty.name}. Continue anyway?`);
      if (!ok) return;
    }
    orgs = (data.organizations || []).map(ConveneCRM.normalizeOrg);
    persistAndRender();
    event.target.value = '';
  }

  async function previewCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    const parsed = ConveneCRM.parseCsv(await file.text());
    if (!parsed.length) {
      $('csvPreview').innerHTML = '<p>No valid rows found. Make sure the CSV has a name or organization column.</p>';
      return;
    }
    const sample = parsed.slice(0, 10);
    $('csvPreview').innerHTML = `<p>${parsed.length} rows parsed. Showing first ${sample.length}.</p><table><thead><tr><th>Name</th><th>Type</th><th>Address</th></tr></thead><tbody>${sample.map(o => `<tr><td>${escapeHtml(o.name)}</td><td>${escapeHtml(o.type)}</td><td>${escapeHtml(o.address)}</td></tr>`).join('')}</tbody></table><p><button id="commitCsvBtn" class="primary">Append ${parsed.length} Records</button></p>`;
    $('commitCsvBtn').addEventListener('click', () => {
      orgs = orgs.concat(parsed);
      persistAndRender();
      $('csvPreview').innerHTML = `<p>${parsed.length} records appended to ${activeCounty.name}.</p>`;
      event.target.value = '';
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
})();
