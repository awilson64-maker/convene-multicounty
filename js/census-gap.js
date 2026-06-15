window.ConveneCensus = (() => {
  const metrics = {
    poverty: { label: 'Poverty rate', suffix: '%', inverse: false },
    childPoverty: { label: 'Child poverty rate', suffix: '%', inverse: false },
    familiesPovertyChildren: { label: 'Families in poverty with children', suffix: '%', inverse: false },
    income: { label: 'Median household income', prefix: '$', inverse: true },
    noVehicle: { label: 'No-vehicle households', suffix: '%', inverse: false },
    senior: { label: 'Age 65+', suffix: '%', inverse: false },
    children: { label: 'Children under 18', suffix: '%', inverse: false },
    unemployment: { label: 'Unemployment rate', suffix: '%', inverse: false },
    rentBurden: { label: 'Rent-burdened renters', suffix: '%', inverse: false },
    snap: { label: 'SNAP households', suffix: '%', inverse: false },
    noInternet: { label: 'No internet access', suffix: '%', inverse: false },
    limitedEnglish: { label: 'Limited-English households', suffix: '%', inverse: false },
    compositePovertyChildren: { label: 'Poverty + children score', suffix: ' / 100', inverse: false },
    compositePovertyNoVehicle: { label: 'Poverty + no vehicle score', suffix: ' / 100', inverse: false },
    compositeSeniorAccess: { label: 'Senior access score', suffix: ' / 100', inverse: false },
    compositeHousingPressure: { label: 'Housing pressure score', suffix: ' / 100', inverse: false },
    compositeDigitalAccess: { label: 'Digital access score', suffix: ' / 100', inverse: false },
    compositeLanguagePoverty: { label: 'Language + poverty score', suffix: ' / 100', inverse: false }
  };

  const lenses = {
    all: { label: 'All mapped assets', terms: [] },
    basicNeeds: { label: 'Food / Basic Needs', terms: ['food', 'basic need', 'basic needs', 'pantry', 'meal', 'nutrition', 'hunger', 'shelter', 'clothing', 'crisis assistance'] },
    housing: { label: 'Housing / Homelessness', terms: ['housing', 'homeless', 'shelter', 'rent', 'tenant', 'eviction'] },
    behavioral: { label: 'Behavioral Health / Recovery', terms: ['behavioral', 'mental health', 'recovery', 'substance', 'addiction', 'crisis', 'counseling', 'peer support', 'suicide'] },
    transportation: { label: 'Transportation', terms: ['transportation', 'transit', 'ride', 'mobility'] },
    youthFamily: { label: 'Youth / Family', terms: ['youth', 'family', 'families', 'child', 'children', 'school', '4-h', 'parent', 'teen', 'early childhood'] },
    agingDisability: { label: 'Aging / Disability', terms: ['aging', 'senior', 'older adult', 'elder', 'disability', 'disabled', 'independent living', 'adrc'] },
    workforce: { label: 'Workforce / Economic Development', terms: ['workforce', 'employment', 'job', 'economic', 'business', 'career', 'training'] },
    publicHealth: { label: 'Public Health / Healthcare', terms: ['public health', 'healthcare', 'hospital', 'clinic', 'medical', 'dental', 'health'] },
    education: { label: 'Education / Learning', terms: ['education', 'school', 'literacy', 'library', 'learning', 'college', 'extension'] },
    government: { label: 'Government / Civic Infrastructure', terms: ['government', 'municipal', 'city', 'village', 'town', 'county', 'public safety', 'library', 'parks'] }
  };

  const thresholdHelp = {
    top25: 'Shows the highest-need quarter of county tracts by rank.',
    top50: 'Shows the highest-need half of county tracts by rank.',
    abs30: 'Shows tracts with a relative need score of 30 or higher.',
    abs40: 'Shows tracts with a relative need score of 40 or higher.',
    abs50: 'Shows tracts with a relative need score of 50 or higher.',
    any: 'Shows tracts with few matching assets, regardless of need score.',
    zeroAssets: 'Shows only tracts with zero matching assets inside the selected radius.'
  };

  const cache = new Map();
  const state = {
    county: null,
    panel: null,
    payload: null,
    tractShapes: null,
    map: null,
    tractLayer: null,
    orgLayer: null,
    labelLayer: null,
    selectedLayer: null,
    legendControl: null,
    tractLayersById: new Map(),
    priorityGaps: []
  };

  async function loadCountyCensus(county) {
    if (cache.has(county.id)) return cache.get(county.id);
    try {
      const response = await fetch(county.censusFile, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      cache.set(county.id, payload);
      return payload;
    } catch (err) {
      return { configured: false, error: err.message, features: [] };
    }
  }

  async function renderCountyCensus(county, panel) {
    if (!panel || !county) return;

    if (state.county?.id === county.id && state.payload && panel.dataset.censusReady === 'true') {
      renderMap();
      return;
    }

    destroyMap();
    state.county = county;
    state.panel = panel;
    state.payload = null;
    state.tractShapes = null;
    state.tractLayersById = new Map();
    state.priorityGaps = [];
    panel.dataset.censusReady = 'false';
    panel.innerHTML = `<div class="notice"><strong>Loading ${esc(county.name)} census gap lens...</strong><p class="muted">Pulling county-specific tract data from <code>${esc(county.censusFile)}</code>.</p></div>`;

    const payload = await loadCountyCensus(county);
    const tractShapes = normalizeFeatureCollection(payload);
    const features = tractShapes.features || [];

    if (!features.length) {
      panel.innerHTML = `<div class="notice"><strong>${esc(county.name)} census data is not configured yet.</strong><p>The multi-county shell is ready, but this county needs a tract-level census JSON file before the gap lens can calculate priority signals.</p><p>Expected file: <code>${esc(county.censusFile)}</code></p><p class="muted">Use the GitHub Action named <strong>Build Multi-County Census Data</strong> to generate this file.</p></div>`;
      return;
    }

    state.payload = payload;
    state.tractShapes = tractShapes;
    panel.dataset.censusReady = 'true';
    panel.innerHTML = censusHtml(county, payload, features.length);
    bindControls();
    populateTypeSelect(true);
    renderMap();
  }

  function censusHtml(county, payload, tractCount) {
    return `
      <div class="census-note"><b>Planning use:</b> This lens combines browser-stored organization records for ${esc(county.name)} with county-specific ACS tract indicators. It flags suspected access gaps for deeper partner validation.</div>
      <div class="census-toolbar">
        <label>Census need layer
          <select id="censusMetricSelect">
            <optgroup label="Direct ACS indicators">
              <option value="poverty">Poverty rate</option>
              <option value="childPoverty">Child poverty rate</option>
              <option value="familiesPovertyChildren">Families in poverty with children</option>
              <option value="income">Median household income</option>
              <option value="noVehicle">No-vehicle households</option>
              <option value="senior">Age 65+</option>
              <option value="children">Children under 18</option>
              <option value="unemployment">Unemployment rate</option>
              <option value="rentBurden">Rent-burdened renters</option>
              <option value="snap">SNAP households</option>
              <option value="noInternet">No internet access</option>
              <option value="limitedEnglish">Limited-English households</option>
            </optgroup>
            <optgroup label="Composite need scores">
              <option value="compositePovertyChildren">Poverty + children score</option>
              <option value="compositePovertyNoVehicle">Poverty + no vehicle score</option>
              <option value="compositeSeniorAccess">Senior access score</option>
              <option value="compositeHousingPressure">Housing pressure score</option>
              <option value="compositeDigitalAccess">Digital access score</option>
              <option value="compositeLanguagePoverty">Language + poverty score</option>
            </optgroup>
          </select>
        </label>
        <label>Need threshold
          <small id="needThresholdHelp">${esc(thresholdHelp.top25)}</small>
          <select id="censusNeedThresholdSelect">
            <optgroup label="County ranking">
              <option value="top25">Top 25% highest-need tracts</option>
              <option value="top50">Top 50% highest-need tracts</option>
            </optgroup>
            <optgroup label="Relative need score cutoff">
              <option value="abs30">Need score 30+</option>
              <option value="abs40">Need score 40+</option>
              <option value="abs50">Need score 50+</option>
            </optgroup>
            <optgroup label="Asset scarcity">
              <option value="any">Any tract with few matching assets</option>
              <option value="zeroAssets">Any tract with zero matching assets</option>
            </optgroup>
          </select>
        </label>
        <label>Service lens
          <select id="censusLensSelect">
            ${Object.entries(lenses).map(([key, lens]) => `<option value="${esc(key)}">${esc(lens.label)}</option>`).join('')}
          </select>
        </label>
        <label>Narrow by org type
          <select id="censusTypeSelect"><option value="">All relevant organization types</option></select>
        </label>
        <label>Access radius
          <select id="censusRadiusSelect"><option value="5">5 miles</option><option value="10" selected>10 miles</option><option value="15">15 miles</option></select>
        </label>
        <label>Gap threshold
          <select id="censusGapThresholdSelect"><option value="2">0 to 2 nearby assets</option><option value="4">0 to 4 nearby assets</option><option value="6">0 to 6 nearby assets</option></select>
        </label>
      </div>
      <div class="census-layout">
        <div id="censusMap" class="census-map"></div>
        <aside class="census-sidepanel">
          <div class="card"><h3>Lens Summary</h3><div id="censusSummary" class="muted">${tractCount} tracts loaded. ACS ${esc(payload.acsYear || '')}.</div></div>
          <div class="card"><h3>Priority Signals</h3><div id="censusGapList" class="muted">Loading...</div></div>
          <div class="card"><h3>Questions to Validate</h3><ul class="question-list"><li>Do residents in flagged tracts actually know about nearby services?</li><li>Are countywide providers accessible without reliable transportation?</li><li>Are eligibility rules, hours, waitlists, language access, or stigma limiting access?</li><li>Which partner is best positioned to confirm whether this suspected gap is real?</li></ul></div>
          <div class="card"><h3>How to read this</h3><p class="muted">Darker tracts indicate higher suspected need for the selected Census metric. Red dots are mapped organizations matching the current service lens and optional org type filter.</p><p class="muted">Priority signals combine relative need score and mapped asset scarcity. Click a card to zoom to that tract.</p></div>
        </aside>
      </div>`;
  }

  function bindControls() {
    ['censusMetricSelect', 'censusNeedThresholdSelect', 'censusTypeSelect', 'censusRadiusSelect', 'censusGapThresholdSelect'].forEach(id => {
      byId(id)?.addEventListener('change', () => {
        updateNeedThresholdHelp();
        renderMap();
      });
    });
    byId('censusLensSelect')?.addEventListener('change', () => {
      populateTypeSelect(true);
      renderMap();
    });
    updateNeedThresholdHelp();
  }

  function renderMap() {
    if (!state.payload || !state.tractShapes || !state.panel || !window.L) return;

    const mapEl = byId('censusMap');
    if (!mapEl) return;

    const key = selectedValue('censusMetricSelect', 'poverty');
    const radius = Number(selectedValue('censusRadiusSelect', '10'));
    const threshold = Number(selectedValue('censusGapThresholdSelect', '2'));
    const orgs = filteredOrgs();
    const values = state.tractShapes.features.map(f => valueForMetric(f, key)).filter(v => Number.isFinite(Number(v))).map(Number);

    if (!values.length) {
      byId('censusGapList').innerHTML = '<p>No usable Census values found for this metric.</p>';
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sorted = values.slice().sort((a, b) => a - b);
    const stats = new Map();
    const gaps = [];

    if (!state.map) {
      state.map = L.map('censusMap').setView(state.county.mapCenter, state.county.mapZoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(state.map);
    }

    removeLayer('tractLayer');
    removeLayer('orgLayer');
    removeLayer('labelLayer');
    removeLayer('selectedLayer');
    state.tractLayersById = new Map();

    state.tractLayer = L.geoJSON(state.tractShapes, {
      style: feature => {
        const id = featureId(feature);
        const row = stats.get(id);
        const value = valueForMetric(feature, key);
        const isGap = Boolean(row?.isGap);
        return {
          color: isGap ? '#111827' : '#ffffff',
          weight: isGap ? 3 : 1,
          opacity: isGap ? 1 : 0.85,
          dashArray: isGap ? '5 4' : '',
          fillColor: colorForValue(value, min, max, key),
          fillOpacity: 0.72
        };
      },
      onEachFeature: (feature, layer) => {
        const id = featureId(feature);
        state.tractLayersById.set(id, layer);
      }
    });

    state.tractLayer.eachLayer(layer => {
      const feature = layer.feature;
      const value = valueForMetric(feature, key);
      const near = nearbyOrgs(layer, orgs, radius);
      const row = {
        id: featureId(feature),
        label: tractLabel(feature.properties || {}),
        feature,
        layer,
        value,
        count: near.length,
        closest: near,
        needScore: Math.round(needScore(value, key, min, max))
      };
      row.score = priorityScore(row, key, min, max, radius);
      row.isGap = meetsNeedThreshold(value, key, sorted, min, max) && meetsAssetThreshold(row.count, threshold);
      stats.set(row.id, row);
      if (row.isGap) gaps.push(row);
    });

    state.tractLayer.setStyle(feature => {
      const row = stats.get(featureId(feature));
      const value = valueForMetric(feature, key);
      const isGap = Boolean(row?.isGap);
      return {
        color: isGap ? '#111827' : '#ffffff',
        weight: isGap ? 3 : 1,
        opacity: isGap ? 1 : 0.85,
        dashArray: isGap ? '5 4' : '',
        fillColor: colorForValue(value, min, max, key),
        fillOpacity: 0.72
      };
    });

    state.tractLayer.eachLayer(layer => {
      const feature = layer.feature;
      const row = stats.get(featureId(feature));
      layer.bindPopup(popupHtml(row, key, radius));
      layer.on('click', () => focusTract(row.id));
    });

    state.tractLayer.addTo(state.map);

    const labelMarkers = [];
    state.tractLayer.eachLayer(layer => {
      const center = layer.getBounds().getCenter();
      labelMarkers.push(L.marker(center, {
        interactive: false,
        icon: L.divIcon({ className: 'tract-label', html: esc(tractLabel(layer.feature.properties || {})), iconSize: null })
      }));
    });
    state.labelLayer = L.layerGroup(labelMarkers).addTo(state.map);

    state.orgLayer = L.layerGroup(orgs.map(org => {
      const marker = L.marker([orgLat(org), orgLng(org)], { icon: L.divIcon({ className: 'org-marker', iconSize: [16, 16] }) });
      marker.bindPopup(`<strong>${esc(org.name || 'Unnamed organization')}</strong><br>${esc(org.type || '')}<br>${esc(org.address || '')}`);
      return marker;
    })).addTo(state.map);

    addLegend();
    state.priorityGaps = gaps.sort((a, b) => b.score - a.score).map((row, index) => ({ ...row, rank: index + 1 }));
    renderSummary(state.priorityGaps, values.length, orgs, key, radius, threshold);

    if (state.tractLayer.getLayers().length) {
      try { state.map.fitBounds(state.tractLayer.getBounds(), { padding: [20, 20] }); } catch (err) { state.map.setView(state.county.mapCenter, state.county.mapZoom); }
    }
    setTimeout(() => state.map?.invalidateSize(), 100);
  }

  function renderSummary(gaps, tractCount, orgs, key, radius, threshold) {
    const lensKey = selectedValue('censusLensSelect', 'all');
    const type = selectedValue('censusTypeSelect', '');
    const typeLabel = type || 'All relevant organization types';
    const source = state.payload?.source || '';
    const acsYear = state.payload?.acsYear || '';
    const warning = orgs.length ? '' : `<div class="warning">No mapped organizations match the current service lens${type ? ` and org type &quot;${esc(type)}&quot;` : ''}. Results may reflect filter setup more than a confirmed service gap.</div>`;

    byId('censusSummary').innerHTML = `
      <div class="mini-metric-grid">
        <div class="mini-metric"><span>Assets matching filters</span><b>${orgs.length}</b></div>
        <div class="mini-metric"><span>Census tracts</span><b>${tractCount}</b></div>
        <div class="mini-metric"><span>Priority signals</span><b>${gaps.length}</b></div>
        <div class="mini-metric"><span>ACS year</span><b>${esc(acsYear)}</b></div>
      </div>
      ${warning}
      <p class="muted"><b>Need layer:</b> ${esc(metrics[key].label)}<br><b>Need threshold:</b> ${esc(needThresholdLabel())}<br><b>Service lens:</b> ${esc((lenses[lensKey] || lenses.all).label)}<br><b>Org type:</b> ${esc(typeLabel)}<br><b>Signal rule:</b> ${esc(signalRuleText(radius, threshold))}<br><b>Ranking:</b> relative need score plus mapped asset scarcity, with extra weight when zero matching assets are found.</p>
      <p class="muted small">Data source: ${esc(source)}</p>`;

    const list = byId('censusGapList');
    if (!gaps.length) {
      list.innerHTML = '<p>No tracts meet both the selected need threshold and asset gap rule. Try a lower need threshold, broader service lens, larger radius, or higher asset gap threshold.</p>';
      return;
    }

    list.innerHTML = gaps.slice(0, 10).map(row => `
      <button class="gap-row" data-tract-id="${esc(row.id)}">
        <b>Census tract ${esc(row.label)}</b><br>
        ${esc(metrics[key].label)}: ${formatValue(row.value, key)}<br>
        <b>Population:</b> ${esc(formatPopulation(row.feature))}<br>
        <b>Relative need score:</b> ${row.needScore} / 100<br>
        <b>Access signal:</b> ${esc(accessText(row, radius))}<br>
        <span class="score">Priority score ${row.score} / 100</span><span class="pill">Rank ${row.rank}</span><span class="pill">worth validating</span><span class="pill">${esc((lenses[selectedValue('censusLensSelect', 'all')] || lenses.all).label)}</span>
        ${row.closest.length ? `<p class="small muted"><b>Closest matching assets:</b><br>${row.closest.slice(0, 5).map(o => `${esc(o.name || 'Unnamed')} (${o._miles.toFixed(1)} mi)`).join('<br>')}</p>` : '<p class="small muted"><b>Closest matching assets:</b><br>None found inside selected radius.</p>'}
      </button>`).join('');

    list.querySelectorAll('[data-tract-id]').forEach(button => {
      button.addEventListener('click', () => focusTract(button.dataset.tractId));
    });
  }

  function populateTypeSelect(reset = false) {
    const select = byId('censusTypeSelect');
    if (!select) return;
    const current = reset ? '' : select.value;
    const lensKey = selectedValue('censusLensSelect', 'all');
    const orgs = orgsForLens(lensKey);
    const types = unique(orgs.map(o => String(o.type || '').trim()).filter(Boolean));
    const label = lensKey === 'all' ? 'All organization types' : 'All relevant organization types';
    select.innerHTML = `<option value="">${esc(label)}</option>${types.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}`;
    select.value = current && types.includes(current) ? current : '';
  }

  function focusTract(id) {
    const layer = state.tractLayersById.get(id);
    if (!layer || !state.map) return;

    state.panel.querySelectorAll('.gap-row').forEach(el => el.classList.remove('active'));
    const card = state.panel.querySelector(`[data-tract-id="${cssEscape(id)}"]`);
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ block: 'nearest' });
    }

    removeLayer('selectedLayer');
    state.selectedLayer = L.geoJSON(layer.feature, { style: { color: '#111827', weight: 5, opacity: 1, fillOpacity: 0, dashArray: '2 0' } }).addTo(state.map);
    state.selectedLayer.bringToFront();
    state.map.fitBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 12 });
    setTimeout(() => layer.openPopup(), 200);
  }

  function addLegend() {
    if (state.legendControl) state.legendControl.remove();
    state.legendControl = L.control({ position: 'bottomright' });
    state.legendControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend-box');
      div.innerHTML = '<b>CONVENE Service Gap Lens</b><br><span class="legend-swatch dark"></span>Darker red = higher selected Census need<br><span class="legend-dot"></span>Red dots = matching mapped organizations<br><span class="legend-line"></span>Bold/dashed outline = priority signal';
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    state.legendControl.addTo(state.map);
  }

  function normalizeFeatureCollection(payload = {}) {
    if (payload.geojson?.features) return payload.geojson;
    if (payload.features) return { type: 'FeatureCollection', features: payload.features };
    return { type: 'FeatureCollection', features: [] };
  }

  function filteredOrgs() {
    const type = selectedValue('censusTypeSelect', '');
    const lensKey = selectedValue('censusLensSelect', 'all');
    return orgsForLens(lensKey).filter(org => !type || String(org.type || '').trim() === type);
  }

  function orgsForLens(lensKey) {
    const lens = lenses[lensKey] || lenses.all;
    return ConveneStorage.loadStore(state.county, 'organizations')
      .filter(orgHasCoordinates)
      .filter(org => {
        if (!lens.terms.length) return true;
        const text = orgText(org);
        return lens.terms.some(term => text.includes(term));
      });
  }

  function orgHasCoordinates(org) {
    return Number.isFinite(orgLat(org)) && Number.isFinite(orgLng(org));
  }

  function orgLat(org) {
    return Number(org.lat ?? org.latitude);
  }

  function orgLng(org) {
    return Number(org.lng ?? org.longitude);
  }

  function orgText(org) {
    return [org.name, org.type, org.focus, org.tags, org.mission, org.description, org.notes, org.communitiesServed, org.geographicReach, org.reach].filter(Boolean).join(' ').toLowerCase();
  }

  function nearbyOrgs(layer, orgs, radius) {
    const center = layer.getBounds().getCenter();
    return orgs
      .map(org => ({ ...org, _miles: milesBetween(center.lat, center.lng, orgLat(org), orgLng(org)) }))
      .filter(org => org._miles <= radius)
      .sort((a, b) => a._miles - b._miles);
  }

  function valueForMetric(feature, key) {
    const acs = acsForFeature(feature);
    return Number(acs[key]);
  }

  function acsForFeature(feature) {
    return feature?.properties?.acs || {};
  }

  function populationForFeature(feature) {
    const acs = acsForFeature(feature);
    const candidates = [acs.population, acs.totalPopulation, acs.totalPop, acs.pop, acs.B01001_001E];
    const found = candidates.find(value => Number.isFinite(Number(value)));
    return Number.isFinite(Number(found)) ? Number(found) : null;
  }

  function formatPopulation(feature) {
    const pop = populationForFeature(feature);
    return pop === null ? 'No data' : Math.round(pop).toLocaleString();
  }

  function featureId(feature) {
    const props = feature.properties || {};
    return String(feature.id || props.GEOID || props.geoid || props.TRACT || props.NAME || Math.random());
  }

  function tractLabel(props) {
    const value = String(props.TRACT || props.NAME || props.GEOID || '').replace('Census Tract ', '');
    if (!value) return 'Unknown';
    return value.replace(/^0+/, '').replace(/(\d{2})$/, ' .$1').replace(' .00', '');
  }

  function formatValue(value, key) {
    if (!Number.isFinite(Number(value))) return 'No data';
    const metric = metrics[key] || metrics.poverty;
    if (metric.prefix) return metric.prefix + Math.round(value).toLocaleString();
    if (metric.suffix && metric.suffix.includes('/ 100')) return Number(value).toFixed(0) + metric.suffix;
    return Number(value).toFixed(1) + (metric.suffix || '');
  }

  function colorForValue(value, min, max, key) {
    if (!Number.isFinite(Number(value))) return '#f3f4f6';
    const metric = metrics[key] || metrics.poverty;
    const span = Math.max(0.0001, max - min);
    let pct = (Number(value) - min) / span;
    if (metric.inverse) pct = 1 - pct;
    if (pct >= 0.8) return '#7f1d1d';
    if (pct >= 0.6) return '#b91c1c';
    if (pct >= 0.4) return '#ef4444';
    if (pct >= 0.2) return '#fca5a5';
    return '#fee2e2';
  }

  function needScore(value, key, min, max) {
    if (!Number.isFinite(Number(value))) return 0;
    const metric = metrics[key] || metrics.poverty;
    const span = Math.max(0.0001, max - min);
    let score = ((Number(value) - min) / span) * 100;
    if (metric.inverse) score = 100 - score;
    return Math.max(0, Math.min(100, score));
  }

  function meetsNeedThreshold(value, key, sorted, min, max) {
    if (!Number.isFinite(Number(value))) return false;
    const selected = selectedValue('censusNeedThresholdSelect', 'top25');
    const metric = metrics[key] || metrics.poverty;
    if (selected === 'any' || selected === 'zeroAssets') return true;
    if (selected === 'top25') {
      const cut = metric.inverse ? sorted[Math.floor(sorted.length * 0.25)] : sorted[Math.floor(sorted.length * 0.75)];
      return metric.inverse ? value <= cut : value >= cut;
    }
    if (selected === 'top50') {
      const cut = sorted[Math.floor(sorted.length * 0.5)];
      return metric.inverse ? value <= cut : value >= cut;
    }
    const threshold = Number(selected.replace('abs', ''));
    return needScore(value, key, min, max) >= threshold;
  }

  function meetsAssetThreshold(count, threshold) {
    const selected = selectedValue('censusNeedThresholdSelect', 'top25');
    if (selected === 'zeroAssets') return count === 0;
    return count <= threshold;
  }

  function accessScore(count, closestMiles, radius) {
    const scarcity = count === 0 ? 35 : count === 1 ? 25 : count === 2 ? 15 : count === 3 ? 5 : 0;
    const distance = count === 0 ? 20 : closestMiles >= radius ? 15 : closestMiles >= 10 ? 12 : closestMiles >= 5 ? 8 : closestMiles >= 2 ? 4 : 0;
    return scarcity + distance;
  }

  function priorityScore(row, key, min, max, radius) {
    const ns = needScore(row.value, key, min, max);
    const closest = row.closest[0]?._miles ?? null;
    const as = accessScore(row.count, closest, radius);
    return Math.max(0, Math.min(100, Math.round(ns * 0.65 + as)));
  }

  function accessText(row, radius) {
    if (row.count === 0) return `No matching mapped assets within ${radius} miles`;
    return `${row.count} matching mapped asset${row.count === 1 ? '' : 's'} within ${radius} miles; closest is ${row.closest[0]._miles.toFixed(1)} mi`;
  }

  function signalRuleText(radius, threshold) {
    const selected = selectedValue('censusNeedThresholdSelect', 'top25');
    if (selected === 'zeroAssets') return `zero matching assets within ${radius} miles.`;
    if (selected === 'any') return `${threshold} or fewer matching assets within ${radius} miles, regardless of need score.`;
    return `relative need score threshold met plus ${threshold} or fewer matching assets within ${radius} miles.`;
  }

  function popupHtml(row, key, radius) {
    return `<b>Census tract ${esc(row.label)}</b><br><b>${esc(metrics[key].label)}:</b> ${formatValue(row.value, key)}<br><b>Population:</b> ${esc(formatPopulation(row.feature))}<br><b>Relative need score:</b> ${row.needScore} / 100<br><b>Need threshold:</b> ${esc(needThresholdLabel())}<br><b>Access signal:</b> ${esc(row.count === 0 ? `No matching mapped assets within ${radius} miles` : `${row.count} matching assets within ${radius} miles`)}<br><b>Priority score:</b> ${row.score} / 100<br>${row.closest.length ? `<b>Closest:</b><br>${row.closest.slice(0, 5).map(o => `${esc(o.name || 'Unnamed')} (${o._miles.toFixed(1)} mi)`).join('<br>')}` : '<b>No matching assets found within radius.</b>'}<br><span class="muted">ACS ${esc(state.payload?.acsYear || '')} 5-year. Suspected signal only.</span>`;
  }

  function needThresholdLabel() {
    const select = byId('censusNeedThresholdSelect');
    return select?.selectedOptions?.[0]?.textContent || 'Need threshold';
  }

  function updateNeedThresholdHelp() {
    const selected = selectedValue('censusNeedThresholdSelect', 'top25');
    const help = byId('needThresholdHelp');
    if (help) help.textContent = thresholdHelp[selected] || '';
  }

  function milesBetween(lat1, lng1, lat2, lng2) {
    const toRad = value => Number(value) * Math.PI / 180;
    const r = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function removeLayer(name) {
    if (state[name]) {
      state[name].remove();
      state[name] = null;
    }
  }

  function destroyMap() {
    if (state.legendControl) {
      state.legendControl.remove();
      state.legendControl = null;
    }
    if (state.map) {
      state.map.remove();
      state.map = null;
    }
    state.tractLayer = null;
    state.orgLayer = null;
    state.labelLayer = null;
    state.selectedLayer = null;
  }

  function selectedValue(id, fallback) {
    return byId(id)?.value ?? fallback;
  }

  function byId(id) {
    return state.panel?.querySelector(`#${id}`) || document.getElementById(id);
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  return { loadCountyCensus, renderCountyCensus };
})();
