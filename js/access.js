window.ConveneAccess = (() => {
  function readCountyFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('county');
  }

  function allowedCountyId(requestedId) {
    const counties = window.CONVENE_COUNTIES || {};
    return counties[requestedId] ? requestedId : window.CONVENE_DEFAULT_COUNTY;
  }

  function activeCountyId() {
    const urlCounty = readCountyFromUrl();
    const savedCounty = localStorage.getItem('convene:lastCounty');
    return allowedCountyId(urlCounty || savedCounty || window.CONVENE_DEFAULT_COUNTY);
  }

  function setActiveCountyId(countyId) {
    localStorage.setItem('convene:lastCounty', allowedCountyId(countyId));
  }

  return { activeCountyId, setActiveCountyId, allowedCountyId };
})();

(() => {
  if (!window.L || window.__conveneCensusFitPatchLoaded) return;
  window.__conveneCensusFitPatchLoaded = true;

  const originalMapFactory = L.map;

  L.map = function conveneCensusFitMapFactory() {
    const map = originalMapFactory.apply(this, arguments);
    const rawTarget = arguments[0];
    const targetId = typeof rawTarget === 'string' ? rawTarget : rawTarget?.id;

    if (targetId === 'censusMap' && !map.__conveneCensusFitPatched) {
      map.__conveneCensusFitPatched = true;
      const originalFitBounds = map.fitBounds;

      map.fitBounds = function conveneCensusFitBounds(bounds, options = {}) {
        const nextOptions = { ...(options || {}) };
        if (nextOptions.maxZoom == null) {
          const county = activeCounty();
          nextOptions.maxZoom = Number(county?.censusFitMaxZoom ?? county?.mapZoom ?? 10);
        }
        return originalFitBounds.call(this, bounds, nextOptions);
      };
    }

    return map;
  };

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }
})();

(() => {
  if (!window.L || window.__conveneEcosystemUiFixesLoaded) return;
  window.__conveneEcosystemUiFixesLoaded = true;

  const state = {
    map: null,
    markers: new Set(),
    timer: null,
    observing: false,
    lastSummaryHtml: '',
    lastBreakdownHtml: '',
    lastStatusText: ''
  };

  const currentMapFactory = L.map;
  L.map = function conveneEcosystemMapCapture() {
    const map = currentMapFactory.apply(this, arguments);
    const rawTarget = arguments[0];
    const targetId = typeof rawTarget === 'string' ? rawTarget : rawTarget?.id;
    if (targetId === 'map') state.map = map;
    return map;
  };

  const originalBindPopup = L.Marker.prototype.bindPopup;
  L.Marker.prototype.bindPopup = function convenePopupActivityLimit(content) {
    let nextContent = content;
    if (typeof content === 'string' && content.includes('<b>Recent activity</b>')) {
      const orgName = popupOrgName(content);
      if (orgName) this.__conveneOrgName = orgName;
      nextContent = limitRecentActivity(content, orgName);
      state.markers.add(this);
      scheduleRefresh();
    }
    const rest = Array.prototype.slice.call(arguments, 1);
    return originalBindPopup.call(this, nextContent, ...rest);
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      bindUiEvents();
      observeMapStatus();
      refreshRelationshipAwareUi();
    }, 250);
  });

  function bindUiEvents() {
    const ids = ['mapRelationshipToggle', 'mapHeatToggle', 'mapMissingOnlyToggle', 'mapTypeFilter', 'mapReachFilter', 'mapConfidenceFilter', 'mapStatusFilter', 'countySelect'];
    ids.forEach(id => document.getElementById(id)?.addEventListener('change', scheduleRefresh));
    document.getElementById('mapSearchBox')?.addEventListener('input', scheduleRefresh);
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', scheduleRefresh));
  }

  function observeMapStatus() {
    const targets = ['mapStatus', 'mapSummaryPanel', 'mapBreakdownPanel']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (!targets.length || state.observing) return;
    state.observing = true;
    const observer = new MutationObserver(() => scheduleRefresh());
    targets.forEach(target => observer.observe(target, { childList: true, subtree: true, characterData: true }));
  }

  function scheduleRefresh() {
    clearTimeout(state.timer);
    state.timer = setTimeout(refreshRelationshipAwareUi, 80);
  }

  function refreshRelationshipAwareUi() {
    const data = filteredMapData();
    if (!data) return;
    applyRelationshipMarkerVisibility(data);
    updateMapSummary(data);
    updateMapBreakdowns(data.filtered);
    updateMapStatus(data);
  }

  function filteredMapData() {
    const county = activeCounty();
    if (!county || !window.ConveneStorage) return null;
    const workspace = window.ConveneStorage.loadWorkspace(county) || {};
    const organizations = (workspace.organizations || []).map(normalizeOrg);
    const relationships = workspace.relationships || [];
    const relatedIds = relatedOrgIds(relationships);
    const relationshipOnly = Boolean(document.getElementById('mapRelationshipToggle')?.checked);

    const type = document.getElementById('mapTypeFilter')?.value || '';
    const reach = document.getElementById('mapReachFilter')?.value || '';
    const confidence = document.getElementById('mapConfidenceFilter')?.value || '';
    const status = document.getElementById('mapStatusFilter')?.value || '';
    const term = (document.getElementById('mapSearchBox')?.value || '').toLowerCase().trim();
    const missingOnly = Boolean(document.getElementById('mapMissingOnlyToggle')?.checked);

    const filtered = organizations
      .filter(org => (!type || org.type === type)
        && (!reach || org.reach === reach)
        && (!confidence || org.confidence === confidence)
        && (!status || org.status === status)
        && (!term || haystack(org).includes(term))
        && (!relationshipOnly || relatedIds.has(org.id))
        && (!missingOnly || !hasCoordinates(org)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const mapped = filtered.filter(hasCoordinates);
    const missing = filtered.filter(org => !hasCoordinates(org));
    const visibleRelationshipCount = countVisibleRelationships(relationships, mapped);

    return { county, organizations, relationships, relatedIds, relationshipOnly, filtered, mapped, missing, visibleRelationshipCount };
  }

  function updateMapSummary(data) {
    const panel = document.getElementById('mapSummaryPanel');
    if (!panel) return;
    const researchOnly = data.filtered.filter(org => /research/i.test(org.status || '')).length;
    const active = data.filtered.filter(org => /active|met|collaboration/i.test(org.status || '')).length;
    const html = `
      <div class="mini-metric-grid map-metrics">
        <div class="mini-metric"><span>Total county records</span><b>${data.organizations.length}</b></div>
        <div class="mini-metric"><span>Filtered records</span><b>${data.filtered.length}</b></div>
        <div class="mini-metric"><span>Mapped records</span><b>${data.mapped.length}</b></div>
        <div class="mini-metric"><span>Missing coordinates</span><b>${data.missing.length}</b></div>
        <div class="mini-metric"><span>Research-only</span><b>${researchOnly}</b></div>
        <div class="mini-metric"><span>Visible relationships</span><b>${data.visibleRelationshipCount}</b></div>
      </div>
      <p class="muted small">${active} filtered records are active, met, or active collaboration.${data.relationshipOnly ? ' Relationship mode is limiting this view to organizations with at least one CRM relationship.' : ' Use this panel to clean the dataset before presenting the ecosystem publicly.'}</p>`;
    if (html !== state.lastSummaryHtml) {
      state.lastSummaryHtml = html;
      panel.innerHTML = html;
    }
  }

  function updateMapBreakdowns(filtered) {
    const panel = document.getElementById('mapBreakdownPanel');
    if (!panel) return;
    const html = `
      <div class="breakdown-grid">
        ${breakdownHtml('By service type', countBy(filtered, org => org.type || 'No type'))}
        ${breakdownHtml('By reach', countBy(filtered, org => org.reach || 'No reach'))}
        ${breakdownHtml('By confidence', countBy(filtered, org => org.confidence || 'No confidence'))}
      </div>`;
    if (html !== state.lastBreakdownHtml) {
      state.lastBreakdownHtml = html;
      panel.innerHTML = html;
    }
  }

  function updateMapStatus(data) {
    const status = document.getElementById('mapStatus');
    if (!status) return;
    const typeLabel = document.getElementById('mapTypeFilter')?.value ? ` for ${document.getElementById('mapTypeFilter').value}` : '';
    const relLabel = data.relationshipOnly ? ' Relationship mode: only organizations with CRM relationships are included.' : '';
    const text = `${data.mapped.length} mapped organization${data.mapped.length === 1 ? '' : 's'} shown${typeLabel}. ${data.missing.length} filtered record${data.missing.length === 1 ? '' : 's'} missing coordinates.${relLabel}`;
    if (text !== state.lastStatusText) {
      state.lastStatusText = text;
      status.textContent = text;
    }
  }

  function applyRelationshipMarkerVisibility(data) {
    if (!data.relationshipOnly || !state.map) return;
    const relatedNames = new Set(data.organizations.filter(org => data.relatedIds.has(org.id)).map(org => String(org.name || '').trim()).filter(Boolean));
    state.markers.forEach(marker => {
      if (!marker || !marker.__conveneOrgName) return;
      if (!relatedNames.has(marker.__conveneOrgName) && marker._map) marker.remove();
    });
    if (state.markers.size > 1000) {
      state.markers = new Set([...state.markers].filter(marker => marker && marker._map));
    }
  }

  function limitRecentActivity(html, orgName) {
    const replacement = latestActivityHtml(orgName) || firstActivityLine(html) || 'No logged activities';
    return html.replace(/(<div><b>Recent activity<\/b><br>)([\s\S]*?)(<\/div>\s*<div><b>Relationships<\/b>)/, `$1${replacement}$3`);
  }

  function latestActivityHtml(orgName) {
    if (!orgName || !window.ConveneStorage) return '';
    const county = activeCounty();
    const workspace = window.ConveneStorage.loadWorkspace(county) || {};
    const org = (workspace.organizations || []).find(item => String(item.name || '').trim() === orgName);
    if (!org) return '';
    const latest = (workspace.activities || [])
      .filter(activity => toArray(activity.organizationIds || activity.orgIds || activity.organizations).includes(org.id))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!latest) return 'No logged activities';
    return `${escapeHtml(formatDate(latest.date))}: ${escapeHtml(latest.summary || latest.type || 'Activity')}`;
  }

  function firstActivityLine(html) {
    const match = html.match(/<div><b>Recent activity<\/b><br>([\s\S]*?)<\/div>\s*<div><b>Relationships<\/b>/);
    if (!match) return '';
    return match[1].split('<br>')[0] || '';
  }

  function popupOrgName(html) {
    const match = html.match(/<strong>([\s\S]*?)<\/strong>/);
    return match ? decodeHtml(match[1]).trim() : '';
  }

  function activeCounty() {
    const id = document.getElementById('countySelect')?.value || window.ConveneAccess?.activeCountyId?.() || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[id] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }

  function normalizeOrg(raw = {}) {
    return {
      ...raw,
      id: raw.id || '',
      name: raw.name || '',
      type: raw.type || '',
      status: raw.status || '',
      reach: raw.reach || raw.geographicReach || '',
      confidence: raw.confidence || raw.reachConfidence || '',
      focus: raw.focus || raw.tags || '',
      mission: raw.mission || raw.description || '',
      lat: raw.lat ?? raw.latitude ?? '',
      lng: cleanLng(raw.lng ?? raw.longitude ?? '')
    };
  }

  function cleanLng(value) {
    const text = String(value ?? '').trim();
    if (text.startsWith('--')) return `-${text.slice(2)}`;
    return text;
  }

  function relatedOrgIds(relationships) {
    const ids = new Set();
    relationships.forEach(rel => {
      if (rel.fromOrgId) ids.add(rel.fromOrgId);
      if (rel.toOrgId) ids.add(rel.toOrgId);
      if (rel.sourceOrgId) ids.add(rel.sourceOrgId);
      if (rel.targetOrgId) ids.add(rel.targetOrgId);
    });
    return ids;
  }

  function countVisibleRelationships(relationships, mapped) {
    const ids = new Set(mapped.map(org => org.id));
    return relationships.filter(rel => ids.has(rel.fromOrgId || rel.sourceOrgId) && ids.has(rel.toOrgId || rel.targetOrgId)).length;
  }

  function hasCoordinates(org) {
    return Number.isFinite(Number(org?.lat)) && Number.isFinite(Number(org?.lng));
  }

  function haystack(record) {
    return Object.values(record || {}).join(' ').toLowerCase();
  }

  function countBy(items, getter) {
    const map = new Map();
    items.forEach(item => {
      const key = String(getter(item) || '').trim() || 'Blank';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function breakdownHtml(title, entries) {
    const rows = entries.slice(0, 8).map(([label, count]) => `<div class="breakdown-row"><span>${escapeHtml(label)}</span><b>${count}</b></div>`).join('');
    return `<section><h4>${escapeHtml(title)}</h4>${rows || '<p class="muted small">No records in current filter.</p>'}</section>`;
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(/[,;|]/).map(v => v.trim()).filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function decodeHtml(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }
})();
