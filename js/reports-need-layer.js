(() => {
  if (window.__conveneReportsNeedLayerLoaded) return;
  window.__conveneReportsNeedLayerLoaded = true;

  const state = { lastGapHtml: '' };

  const metricOptions = {
    auto: { label: 'Auto-select from service/focus', key: 'auto' },
    priorityScore: { label: 'Overall priority score', suffix: ' / 100' },
    poverty: { label: 'Poverty rate', suffix: '%' },
    childPoverty: { label: 'Child poverty rate', suffix: '%' },
    familiesPovertyChildren: { label: 'Families in poverty with children', suffix: '%' },
    income: { label: 'Median household income', prefix: '$', inverse: true },
    noVehicle: { label: 'No-vehicle households', suffix: '%' },
    compositePovertyNoVehicle: { label: 'Poverty + no vehicle score', suffix: ' / 100' },
    senior: { label: 'Age 65+', suffix: '%' },
    compositeSeniorAccess: { label: 'Senior access score', suffix: ' / 100' },
    children: { label: 'Children under 18', suffix: '%' },
    compositePovertyChildren: { label: 'Poverty + children score', suffix: ' / 100' },
    rentBurden: { label: 'Rent-burdened renters', suffix: '%' },
    compositeHousingPressure: { label: 'Housing pressure score', suffix: ' / 100' },
    unemployment: { label: 'Unemployment rate', suffix: '%' },
    snap: { label: 'SNAP households', suffix: '%' },
    noInternet: { label: 'No internet access', suffix: '%' },
    compositeDigitalAccess: { label: 'Digital access score', suffix: ' / 100' },
    limitedEnglish: { label: 'Limited-English households', suffix: '%' },
    compositeLanguagePoverty: { label: 'Language + poverty score', suffix: ' / 100' }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    installNeedLayerControl();
    setInterval(installNeedLayerControl, 1200);
    document.addEventListener('change', event => {
      if (event.target.matches('#reportType')) updateNeedLayerVisibility();
    }, true);

    window.addEventListener('click', event => {
      const generate = event.target.closest?.('#generateReportBtn');
      if (generate && document.getElementById('reportType')?.value === 'gap') {
        event.preventDefault();
        event.stopImmediatePropagation();
        buildGapReport();
      }
      const print = event.target.closest?.('#reportPrintBtn');
      if (print && state.lastGapHtml && document.querySelector('#reportsView.view.active')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.print();
      }
      const exportBtn = event.target.closest?.('#reportExportBtn');
      if (exportBtn && state.lastGapHtml && document.querySelector('#reportsView.view.active')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        exportGapHtml();
      }
    }, true);
  }

  function installNeedLayerControl() {
    if (!document.getElementById('reportNeedLayer')) {
      const focusLabel = document.getElementById('reportFocus')?.closest('label');
      const serviceLabel = document.getElementById('reportService')?.closest('label');
      const anchor = focusLabel || serviceLabel;
      if (!anchor || !anchor.parentElement) return;
      const label = document.createElement('label');
      label.id = 'reportNeedLayerWrap';
      label.textContent = 'Need layer';
      const select = document.createElement('select');
      select.id = 'reportNeedLayer';
      Object.entries(metricOptions).forEach(([value, opt]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
      label.appendChild(select);
      anchor.insertAdjacentElement('afterend', label);
    }
    updateNeedLayerVisibility();
  }

  function updateNeedLayerVisibility() {
    const wrap = document.getElementById('reportNeedLayerWrap');
    if (!wrap) return;
    wrap.style.display = document.getElementById('reportType')?.value === 'gap' ? 'grid' : 'none';
  }

  async function buildGapReport() {
    const output = document.getElementById('reportOutput');
    if (!output) return;
    try {
      installNeedLayerControl();
      const county = activeCounty();
      const data = workspace();
      const settings = settingsFromControls();
      const orgs = filterOrgs(data.organizations, settings);
      const activities = filterActivities(data.activities, orgs, settings);
      const census = await loadCensus(county);
      const selectedMetric = resolveMetricKey(settings);
      const metric = metricOptions[selectedMetric] || metricOptions.compositePovertyNoVehicle;
      const all = allTracts(census, selectedMetric);
      const mappedAssets = orgs.filter(hasCoords);
      const tracts = priorityTracts(census, mappedAssets, selectedMetric).slice(0, 12);
      const scopeMissing = !settings.serviceType && !settings.focusTag;

      let body;
      if (scopeMissing) {
        body = `
          ${metricSection([['County organizations', data.organizations.length], ['Mapped organizations', data.organizations.filter(hasCoords).length], ['Census tracts', all.length], ['ACS year', census?.acsYear || 'n/a'], ['Selected service/focus', 'None'], ['Need layer', metric.label]])}
          ${section('Choose a service or focus lens', `<div class="report-callout"><p><b>This report needs both parts:</b> a service/focus lens for the assets, and a need layer for the Census signal. Choose a service type or focus tag, then choose the need layer you want to test.</p></div>`)}
          ${section('Highest-need tracts before asset comparison', tractNeedOnlyTable(all.slice(0, 12), selectedMetric))}`;
      } else {
        body = `
          ${metricSection([['Relevant orgs', orgs.length], ['Mapped matching assets', mappedAssets.length], ['Census tracts', all.length], ['Priority tracts shown', tracts.length], ['No nearby matching assets', tracts.filter(t => t.assetCount === 0).length], ['Activities', activities.length]])}
          ${section('Geographic access readout', `<p>This report compares tract-level need signals with mapped assets matching <b>${escapeHtml(settings.focusTag || settings.serviceType)}</b>. The selected Census need layer is <b>${escapeHtml(metric.label)}</b>. The final gap priority now combines <b>relative need</b> with an <b>access gap score</b>, so nearby matching assets reduce the final priority.</p>`)}
          ${section('Priority tract table', tractTable(tracts, selectedMetric))}
          ${checked('reportCharts') ? section('Gap visuals', `<div class="chart-grid">${barChart('Final gap priority', tracts.map(t => [t.name, t.priority]), 12)}${barChart('Access gap score', tracts.map(t => [t.name, t.accessGap]), 12)}</div>`) : ''}
          ${checked('reportOrgList') ? orgTable(mappedAssets, 'Mapped organizations used as matching assets') : ''}
          ${checked('reportActivities') ? activitySection(activities, data.organizations) : ''}`;
      }

      state.lastGapHtml = `<article class="report-doc">
        <header class="report-cover">
          <h1>Geographic Access / Gap Report</h1>
          <p>${escapeHtml(county.name || 'Active county')} | CONVENE Reporting Center</p>
          <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
          <span class="report-chip">${escapeHtml(scopeLabel(settings))}</span>
        </header>
        ${body}
        <footer class="report-section"><p class="muted small">Generated from the active county workspace. The service/focus selection defines matching assets. The need layer defines the Census signal. Final gap priority is weighted 60% relative need and 40% access gap.</p></footer>
      </article>`;
      output.innerHTML = state.lastGapHtml;
    } catch (err) {
      console.error('Need-layer gap report failed', err);
      output.innerHTML = `<div class="card report-empty"><h3>Gap report could not be generated</h3><p>${escapeHtml(err?.message || 'Unknown error')}</p></div>`;
    }
  }

  function settingsFromControls() {
    return {
      serviceType: valueOf('reportService'),
      focusTag: valueOf('reportFocus'),
      range: valueOf('reportRange') || 'all',
      start: valueOf('reportStart'),
      end: valueOf('reportEnd'),
      needLayer: valueOf('reportNeedLayer') || 'auto'
    };
  }

  function resolveMetricKey(settings) {
    if (settings.needLayer && settings.needLayer !== 'auto') return settings.needLayer;
    const text = `${settings.serviceType || ''} ${settings.focusTag || ''}`.toLowerCase();
    if (/aging|senior|older|elder|disab|adrc/.test(text)) return 'compositeSeniorAccess';
    if (/housing|homeless|rent|eviction|shelter/.test(text)) return 'compositeHousingPressure';
    if (/child|children|youth|family|families|school|education|literacy/.test(text)) return 'compositePovertyChildren';
    if (/internet|digital|broadband|technology/.test(text)) return 'compositeDigitalAccess';
    if (/language|english|immigrant|latino|hispanic|spanish/.test(text)) return 'compositeLanguagePoverty';
    if (/workforce|employment|job|career|training/.test(text)) return 'unemployment';
    return 'compositePovertyNoVehicle';
  }

  function activeCounty() {
    const id = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES?.[id] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY] || { id, name: id, storagePrefix: `convene:${id}` };
  }

  function workspace() {
    const county = activeCounty();
    const raw = window.ConveneStorage?.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {};
    return {
      organizations: arr(raw.organizations).map(normalizeOrg),
      contacts: arr(raw.contacts),
      activities: arr(raw.activities).map(normalizeActivity),
      relationships: arr(raw.relationships)
    };
  }

  function normalizeOrg(raw = {}) {
    return {
      ...raw,
      id: raw.id || raw.orgId || raw.organizationId || '',
      name: raw.name || raw.organization || '',
      type: raw.type || raw.category || '',
      status: raw.status || '',
      reach: raw.reach || raw.geographicReach || '',
      confidence: raw.confidence || raw.reachConfidence || '',
      focus: Array.isArray(raw.focus ?? raw.tags ?? raw.focusTags) ? (raw.focus ?? raw.tags ?? raw.focusTags).join(', ') : String(raw.focus ?? raw.tags ?? raw.focusTags ?? ''),
      address: raw.address || '',
      phone: raw.phone || '',
      email: raw.email || '',
      website: raw.website || '',
      lat: cleanNumber(raw.lat ?? raw.latitude),
      lng: cleanNumber(raw.lng ?? raw.longitude)
    };
  }

  function normalizeActivity(raw = {}) {
    return { ...raw, organizationIds: toArray(raw.organizationIds || raw.orgIds || raw.organizations), contactIds: toArray(raw.contactIds || raw.contacts) };
  }

  function filterOrgs(orgs, settings) {
    return orgs.filter(org => {
      const serviceOk = !settings.serviceType || org.type === settings.serviceType;
      const focusOk = !settings.focusTag || tagsOf(org).some(tag => key(tag) === key(settings.focusTag));
      return serviceOk && focusOk;
    }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function filterActivities(activities, orgs, settings) {
    const ids = new Set(orgs.map(o => o.id).filter(Boolean));
    const win = dateWindow(settings);
    return activities.filter(activity => {
      const date = activity.date ? new Date(`${activity.date}T00:00:00`) : null;
      const dateOk = (!win.start || (date && date >= win.start)) && (!win.end || (date && date <= win.end));
      const scopeOk = !ids.size || toArray(activity.organizationIds).some(id => ids.has(id));
      return dateOk && scopeOk;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function dateWindow(settings) {
    if (settings.range === 'all') return {};
    if (settings.range === 'custom') return { start: settings.start ? new Date(`${settings.start}T00:00:00`) : null, end: settings.end ? new Date(`${settings.end}T23:59:59`) : null };
    const days = Number(settings.range || 0);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  async function loadCensus(county) {
    if (!county?.censusFile) return null;
    const response = await fetch(county.censusFile, { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  }

  function allTracts(census, metricKey) {
    const features = census?.geojson?.features || census?.features || [];
    const tracts = features.map(feature => {
      const p = feature.properties || {};
      const acs = p.acs || {};
      const rawValue = firstNumber(acs[metricKey], p[metricKey]);
      return {
        name: tractLabel(p),
        population: firstNumber(acs.population, acs.totalPopulation, acs.totalPop, acs.pop, acs.B01001_001E, p.population),
        rawValue,
        center: centerOf(feature.geometry)
      };
    }).filter(t => Number.isFinite(Number(t.rawValue)));
    const metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle;
    const values = tracts.map(t => Number(t.rawValue)).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    return tracts.map(t => ({ ...t, needScore: relativeNeedScore(t.rawValue, min, max, Boolean(metric.inverse)) })).sort((a, b) => b.needScore - a.needScore);
  }

  function priorityTracts(census, mappedAssets, metricKey) {
    return allTracts(census, metricKey).map(tract => {
      const distances = mappedAssets.map(org => ({ org, miles: distanceMiles(tract.center[0], tract.center[1], Number(org.lat), Number(org.lng)) }))
        .filter(item => Number.isFinite(item.miles))
        .sort((a, b) => a.miles - b.miles);
      const nearby = distances.filter(item => item.miles <= 10);
      const assetCount = nearby.length;
      const closest = distances[0] || null;
      const accessGap = accessGapScore(closest?.miles, assetCount);
      const priority = Math.max(0, Math.min(100, Math.round((tract.needScore * 0.6) + (accessGap * 0.4))));
      return { ...tract, assetCount, closest, accessGap, accessSignal: accessSignal(closest?.miles, assetCount), priority };
    }).sort((a, b) => b.priority - a.priority || b.accessGap - a.accessGap || b.needScore - a.needScore);
  }

  function accessGapScore(closestMiles, assetCount) {
    if (!Number.isFinite(Number(closestMiles))) return 100;
    const d = Number(closestMiles);
    let score;
    if (d <= 1) score = 8;
    else if (d <= 2) score = 18;
    else if (d <= 5) score = 40;
    else if (d <= 10) score = 65;
    else score = 90;

    if (assetCount >= 5) score -= 20;
    else if (assetCount >= 3) score -= 12;
    else if (assetCount >= 2) score -= 6;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function accessSignal(closestMiles, assetCount) {
    if (!assetCount) return 'No matching assets within 10 mi';
    const d = Number(closestMiles);
    if (d <= 1) return 'Very close matching access';
    if (d <= 2) return 'Close matching access';
    if (d <= 5) return 'Moderate matching access';
    return 'Distant matching access';
  }

  function metricSection(items) {
    return `<section class="report-section"><div class="metric-grid">${items.map(([label, value]) => `<div class="report-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value ?? 0))}</b></div>`).join('')}</div></section>`;
  }
  function section(title, body) { return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`; }
  function tractTable(tracts, metricKey) {
    const metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle;
    return tracts.length ? table(['Tract', 'Population', metric.label, 'Relative need', 'Access gap', 'Final gap priority', 'Access signal', 'Closest matching asset'], tracts.map(t => [t.name, formatPopulation(t.population), formatMetricValue(t.rawValue, metricKey), `${Math.round(t.needScore)} / 100`, `${t.accessGap} / 100`, `${t.priority} / 100`, t.accessSignal, t.closest ? `${t.closest.org.name || 'Unnamed organization'} (${t.closest.miles.toFixed(1)} mi)` : 'None mapped'])) : '<p class="muted">No census tract data available for the selected need layer.</p>';
  }
  function tractNeedOnlyTable(tracts, metricKey) {
    const metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle;
    return tracts.length ? table(['Tract', 'Population', metric.label, 'Relative need score'], tracts.map(t => [t.name, formatPopulation(t.population), formatMetricValue(t.rawValue, metricKey), `${Math.round(t.needScore)} / 100`])) : '<p class="muted">No census tract data available for the selected need layer.</p>';
  }
  function table(headers, rows) { return `<div class="report-table-wrap"><table class="report-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function barChart(title, entries, limit = 10) {
    const rows = (entries || []).slice(0, limit);
    const max = Math.max(1, ...rows.map(row => Number(row[1]) || 0));
    return `<div class="chart-box"><h3>${escapeHtml(title)}</h3>${rows.length ? rows.map(([label, count]) => `<div class="bar-row"><span>${escapeHtml(shorten(label, 28))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round(((Number(count) || 0) / max) * 100))}%"></div></div><b>${escapeHtml(String(count))}</b></div>`).join('') : '<p class="muted">No records.</p>'}</div>`;
  }
  function orgTable(orgs, title) { return section(title || 'Organization list', orgs.length ? table(['Name', 'Type', 'Focus', 'Status', 'Reach', 'Confidence', 'Address'], orgs.slice(0, 80).map(o => [o.name, o.type, tagsOf(o).join(', '), o.status, o.reach, o.confidence, o.address])) : '<p class="muted">No organizations found.</p>'); }
  function activitySection(activities, orgs) { return section('Recent activity', activities.length ? table(['Date', 'Type', 'Summary', 'Organizations', 'Follow-up'], activities.slice(0, 30).map(a => [formatDate(a.date), a.type || '', a.summary || '', toArray(a.organizationIds).map(id => orgName(id, orgs)).join(', '), followUp(a)])) : '<p class="muted">No activities found.</p>'); }

  function centerOf(geometry = {}) { const pts = []; rings(geometry).forEach(r => r.forEach(c => { if (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) pts.push(c); })); if (!pts.length) return [NaN, NaN]; return [pts.reduce((s, c) => s + Number(c[1]), 0) / pts.length, pts.reduce((s, c) => s + Number(c[0]), 0) / pts.length]; }
  function rings(geometry = {}) { if (geometry.type === 'Polygon') return geometry.coordinates || []; if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat(); return []; }
  function relativeNeedScore(value, min, max, inverse) { const n = Number(value); if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0; const scaled = ((n - min) / (max - min)) * 100; return Math.round(inverse ? 100 - scaled : scaled); }
  function distanceMiles(lat1, lng1, lat2, lng2) { if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN; const r = 3958.8; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
  function rad(d) { return d * Math.PI / 180; }
  function firstNumber(...values) { for (const value of values) { const n = Number(value); if (Number.isFinite(n)) return n; } return NaN; }
  function formatPopulation(value) { const n = Number(value); return Number.isFinite(n) ? Math.round(n).toLocaleString() : 'n/a'; }
  function formatMetricValue(value, metricKey) { const metric = metricOptions[metricKey] || {}; const n = Number(value); if (!Number.isFinite(n)) return 'n/a'; if (metric.prefix === '$') return `$${Math.round(n).toLocaleString()}`; return `${Number.isInteger(n) ? n : n.toFixed(1)}${metric.suffix || ''}`; }
  function tractLabel(p) { const raw = p.name || p.NAME || p.tract || p.TRACTCE || p.GEOID || 'Tract'; return /^census tract/i.test(String(raw)) ? String(raw) : `Census Tract ${raw}`; }
  function hasCoords(o) { return Number.isFinite(Number(o?.lat)) && Number.isFinite(Number(o?.lng)); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function cleanNumber(v) { const n = Number(String(v ?? '').trim().replace(/^--/, '-')); return Number.isFinite(n) ? String(n) : ''; }
  function toArray(v) { return Array.isArray(v) ? v : String(v || '').split(/[;,|]/).map(x => x.trim()).filter(Boolean); }
  function tagsOf(o) { return [...new Set(toArray(o.focus || o.tags || o.focusTags))]; }
  function orgName(id, orgs) { return (orgs || []).find(o => o.id === id)?.name || 'Unknown organization'; }
  function followUp(a) { return a.followUpDate ? `${formatDate(a.followUpDate)} ${a.followUpCompleted ? '(completed)' : '(open)'}` : 'No follow-up'; }
  function formatDate(v) { if (!v) return ''; const d = new Date(`${v}T00:00:00`); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(); }
  function scopeLabel(s) { return [s.serviceType, s.focusTag, s.needLayer && s.needLayer !== 'auto' ? (metricOptions[s.needLayer]?.label || s.needLayer) : 'Auto need layer'].filter(Boolean).join(' | ') || 'Gap report'; }
  function valueOf(id) { return document.getElementById(id)?.value || ''; }
  function checked(id) { return Boolean(document.getElementById(id)?.checked); }
  function key(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function shorten(v, n) { const s = String(v || ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; }
  function escapeHtml(v) { return String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  function exportGapHtml() {
    const county = activeCounty();
    const style = document.getElementById('reportsV2Styles')?.textContent || '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CONVENE Gap Report</title><style>${style}</style></head><body>${state.lastGapHtml}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convene-${county.id}-gap-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
})();