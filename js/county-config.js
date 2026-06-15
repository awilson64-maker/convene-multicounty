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
