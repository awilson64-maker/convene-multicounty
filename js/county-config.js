window.CONVENE_COUNTIES = {
  fdl: {
    id: 'fdl',
    name: 'Fond du Lac County',
    state: 'Wisconsin',
    stateCode: '55',
    countyCode: '039',
    mapCenter: [43.773, -88.447],
    mapZoom: 10,
    storagePrefix: 'convene:fdl',
    censusFile: 'data/fdl/census-tracts.json',
    boundaryFile: 'data/fdl/boundary.geojson',
    description: 'Fond du Lac County profile for testing the multi-county framework without touching the working FDL CRM.'
  },
  waupaca: {
    id: 'waupaca',
    name: 'Waupaca County',
    state: 'Wisconsin',
    stateCode: '55',
    countyCode: '135',
    mapCenter: [44.47, -88.96],
    mapZoom: 10,
    storagePrefix: 'convene:waupaca',
    censusFile: 'data/waupaca/census-tracts.json',
    boundaryFile: 'data/waupaca/boundary.geojson',
    description: 'Waupaca County profile for the first external educator/county test case.'
  }
};

window.CONVENE_DEFAULT_COUNTY = 'fdl';

(() => {
  if (!window.L || window.__conveneBoundaryHelperLoaded) return;
  window.__conveneBoundaryHelperLoaded = true;

  const originalMapFactory = L.map;
  const geoCache = new Map();
  let boundaryLayer = null;
  let boundaryCountyId = '';

  L.map = function patchedConveneMap() {
    const map = originalMapFactory.apply(this, arguments);
    const rawTarget = arguments[0];
    const targetId = typeof rawTarget === 'string' ? rawTarget : rawTarget?.id;
    if (targetId === 'map') {
      window.__conveneRegularMap = map;
      setTimeout(drawCountyBoundary, 150);
    }
    return map;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const countySelect = document.getElementById('countySelect');
    countySelect?.addEventListener('change', () => setTimeout(drawCountyBoundary, 250));

    document.querySelectorAll('[data-view="mapView"], #mapTypeFilter, #mapHeatToggle').forEach(el => {
      const eventName = el.matches('button') ? 'click' : 'change';
      el.addEventListener(eventName, () => setTimeout(drawCountyBoundary, 250));
    });

    setTimeout(drawCountyBoundary, 500);
  });

  async function drawCountyBoundary() {
    const map = window.__conveneRegularMap;
    const county = activeCounty();
    if (!map || !county || !county.censusFile) return;

    if (boundaryLayer) {
      boundaryLayer.remove();
      boundaryLayer = null;
      boundaryCountyId = '';
    }

    try {
      const featureCollection = await loadFeatureCollection(county);
      const exteriorSegments = countyExteriorSegments(featureCollection);
      if (!exteriorSegments.length) return;

      boundaryLayer = L.layerGroup(
        exteriorSegments.map(segment => L.polyline(segment, {
          color: '#c5050c',
          weight: 3,
          opacity: 0.95,
          interactive: false
        }))
      ).addTo(map);
      boundaryCountyId = county.id;
      updateMapStatus(county);
    } catch (err) {
      console.warn('CONVENE county boundary overlay could not load.', err);
    }
  }

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }

  async function loadFeatureCollection(county) {
    if (geoCache.has(county.id)) return geoCache.get(county.id);
    const response = await fetch(county.censusFile, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${county.censusFile}: HTTP ${response.status}`);
    const payload = await response.json();
    const featureCollection = payload.geojson?.features
      ? payload.geojson
      : payload.features
        ? { type: 'FeatureCollection', features: payload.features }
        : { type: 'FeatureCollection', features: [] };
    geoCache.set(county.id, featureCollection);
    return featureCollection;
  }

  function countyExteriorSegments(featureCollection) {
    const counts = new Map();
    const originals = new Map();

    (featureCollection.features || []).forEach(feature => {
      geometryRings(feature.geometry).forEach(ring => {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i];
          const b = ring[i + 1];
          if (!validCoord(a) || !validCoord(b)) continue;
          const key = segmentKey(a, b);
          counts.set(key, (counts.get(key) || 0) + 1);
          if (!originals.has(key)) originals.set(key, [toLatLng(a), toLatLng(b)]);
        }
      });
    });

    return [...counts.entries()]
      .filter(([, count]) => count === 1)
      .map(([key]) => originals.get(key))
      .filter(Boolean);
  }

  function geometryRings(geometry = {}) {
    if (geometry.type === 'Polygon') return geometry.coordinates || [];
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
    return [];
  }

  function segmentKey(a, b) {
    const pa = coordKey(a);
    const pb = coordKey(b);
    return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`;
  }

  function coordKey(coord) {
    return `${Number(coord[0]).toFixed(6)},${Number(coord[1]).toFixed(6)}`;
  }

  function toLatLng(coord) {
    return [Number(coord[1]), Number(coord[0])];
  }

  function validCoord(coord) {
    return Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]));
  }

  function updateMapStatus(county) {
    const status = document.getElementById('mapStatus');
    if (!status || boundaryCountyId !== county.id) return;
    const base = status.textContent.replace(/ County border shown\.?$/, '').trim();
    status.textContent = `${base}${base ? ' ' : ''}County border shown.`;
  }

  window.ConveneCountyBoundary = { draw: drawCountyBoundary };
})();

(() => {
  if (window.__conveneUiPolishLoaded) return;
  window.__conveneUiPolishLoaded = true;

  const trackedMarkers = new Set();
  let originalMarkerAddTo = null;
  let originalMarkerBindPopup = null;

  installStylePolish();
  patchLeafletMarkers();

  document.addEventListener('DOMContentLoaded', () => {
    const refresh = () => setTimeout(() => {
      renderRecentActivityCard();
      applyRelationshipOnlyMode();
    }, 80);

    refresh();
    setInterval(refresh, 1200);

    document.getElementById('countySelect')?.addEventListener('change', refresh);
    document.getElementById('mapRelationshipToggle')?.addEventListener('change', () => setTimeout(applyRelationshipOnlyMode, 120));
    document.querySelector('[data-view="dashboardView"]')?.addEventListener('click', refresh);
    document.querySelector('[data-view="mapView"]')?.addEventListener('click', () => setTimeout(applyRelationshipOnlyMode, 300));
  });

  function installStylePolish() {
    const style = document.createElement('style');
    style.textContent = `
      #orgList.record-list, #contactList.record-list, #activityList.record-list {
        max-height: calc(100vh - 245px);
        overflow-y: auto;
        padding-right: 8px;
      }
      #orgList.record-list .record-item, #contactList.record-list .record-item, #activityList.record-list .record-item {
        box-shadow: 0 4px 13px rgba(40, 39, 40, 0.05);
      }
      .recent-activity-list { display: grid; gap: 10px; max-height: 335px; overflow-y: auto; padding-right: 6px; }
      .recent-activity-item { border: 1px solid var(--line); border-left: 5px solid var(--brand); border-radius: 12px; padding: 10px 12px; background: #fff; }
      .recent-activity-item strong, .recent-activity-item span, .recent-activity-item small { display: block; }
      .recent-activity-item span { margin-top: 3px; }
      .recent-activity-item small { color: var(--muted); margin-top: 3px; line-height: 1.35; }
      .relationship-filter-hidden { display: none !important; }
      .relationship-filter-note { margin-top: 8px; color: var(--brand-dark); font-weight: 700; }
    `;
    document.head.appendChild(style);
  }

  function patchLeafletMarkers() {
    if (!window.L || !L.Marker || originalMarkerBindPopup) return;
    originalMarkerAddTo = L.Marker.prototype.addTo;
    originalMarkerBindPopup = L.Marker.prototype.bindPopup;

    L.Marker.prototype.addTo = function convenePolishedAddTo(targetMap) {
      const result = originalMarkerAddTo.apply(this, arguments);
      const targetId = targetMap?._container?.id;
      if (targetId === 'map') {
        this.__conveneRegularMapMarker = true;
        trackedMarkers.add(this);
      }
      setTimeout(applyRelationshipOnlyMode, 40);
      return result;
    };

    L.Marker.prototype.bindPopup = function convenePolishedBindPopup(content) {
      if (this.__conveneRegularMapMarker) {
        const raw = typeof content === 'string' ? content : String(content || '');
        this.__convenePopupHtml = raw;
        this.__conveneHasRelationship = !/No mapped relationships/i.test(raw);
      }
      const result = originalMarkerBindPopup.apply(this, arguments);
      setTimeout(applyRelationshipOnlyMode, 40);
      return result;
    };
  }

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }

  function workspace() {
    const county = activeCounty();
    if (!county || !window.ConveneStorage) return { organizations: [], contacts: [], activities: [], relationships: [] };
    return window.ConveneStorage.loadWorkspace(county);
  }

  function renderRecentActivityCard() {
    const summary = document.getElementById('countySummary');
    if (!summary) return;
    const card = summary.closest('.card');
    if (!card) return;
    const heading = card.querySelector('h3');
    if (heading) heading.textContent = 'Recent activity';

    const data = workspace();
    const orgById = new Map((data.organizations || []).map(org => [org.id, org.name || 'Unnamed organization']));
    const rows = (data.activities || [])
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10);

    summary.outerHTML = `<div id="countySummary" class="recent-activity-list">${rows.length ? rows.map(activity => {
      const names = toArray(activity.organizationIds || activity.orgIds || activity.organizations).map(id => orgById.get(id)).filter(Boolean).join(', ');
      return `<article class="recent-activity-item"><strong>${escapeHtml(formatDate(activity.date || ''))} | ${escapeHtml(activity.type || 'Activity')}</strong><span>${escapeHtml(activity.summary || 'Untitled activity')}</span><small>${escapeHtml(names || 'No organization linked')}</small></article>`;
    }).join('') : '<p class="muted">No recent activity yet.</p>'}</div>`;
  }

  function applyRelationshipOnlyMode() {
    const toggle = document.getElementById('mapRelationshipToggle');
    const enabled = Boolean(toggle?.checked);

    trackedMarkers.forEach(marker => {
      if (!marker.__conveneRegularMapMarker) return;
      const visible = !enabled || Boolean(marker.__conveneHasRelationship);
      marker.getElement?.()?.classList.toggle('relationship-filter-hidden', !visible);
      if (marker._shadow) marker._shadow.classList.toggle('relationship-filter-hidden', !visible);
      if (!visible) marker.closePopup?.();
    });

    filterMapSideList(enabled);
    updateRelationshipFilterStatus(enabled);
  }

  function filterMapSideList(enabled) {
    const data = workspace();
    const relatedIds = relatedOrganizationIds(data.relationships || []);
    const orgByName = new Map((data.organizations || []).map(org => [String(org.name || '').trim().toLowerCase(), org.id]));
    const list = document.getElementById('mapOrgList');
    if (!list) return;
    list.querySelectorAll('.map-list-item').forEach(item => {
      const name = item.querySelector('strong')?.textContent.trim().toLowerCase() || '';
      const orgId = orgByName.get(name);
      item.classList.toggle('relationship-filter-hidden', enabled && !relatedIds.has(orgId));
    });
  }

  function updateRelationshipFilterStatus(enabled) {
    const status = document.getElementById('mapStatus');
    if (!status) return;
    status.querySelector?.('.relationship-filter-note')?.remove();
    const existing = status.textContent.replace(/ Relationship mode: showing only organizations with at least one CRM relationship\./g, '');
    status.textContent = existing;
    if (enabled) {
      const data = workspace();
      const relatedCount = relatedOrganizationIds(data.relationships || []).size;
      status.textContent = `${status.textContent} Relationship mode: showing only organizations with at least one CRM relationship.`;
      status.title = `${relatedCount} organization records currently participate in at least one relationship.`;
    } else {
      status.title = '';
    }
  }

  function relatedOrganizationIds(relationships) {
    const ids = new Set();
    (relationships || []).forEach(rel => {
      if (rel.fromOrgId || rel.sourceOrgId) ids.add(rel.fromOrgId || rel.sourceOrgId);
      if (rel.toOrgId || rel.targetOrgId) ids.add(rel.toOrgId || rel.targetOrgId);
    });
    return ids;
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value).split(/[,;]+/).map(v => v.trim()).filter(Boolean);
  }

  function formatDate(value) {
    if (!value) return 'No date';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[ch]));
  }
})();
