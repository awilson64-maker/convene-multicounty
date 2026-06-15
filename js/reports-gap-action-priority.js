(function () {
  if (window.__conveneGapActionPriorityLoaded) return;
  window.__conveneGapActionPriorityLoaded = true;

  var state = { lastHtml: '' };
  var metricOptions = {
    auto: { label: 'Auto-select from service/focus' },
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
    window.addEventListener('click', function (event) {
      var generate = closest(event.target, '#generateReportBtn');
      if (generate && valueOf('reportType') === 'gap') {
        event.preventDefault();
        event.stopImmediatePropagation();
        buildGapReport();
      }
    }, true);
    document.addEventListener('change', function (event) {
      if (event.target && event.target.matches && event.target.matches('#reportType')) updateNeedLayerVisibility();
    }, true);
  }

  function installNeedLayerControl() {
    if (!document.getElementById('reportNeedLayer')) {
      var focusLabel = document.getElementById('reportFocus') ? document.getElementById('reportFocus').closest('label') : null;
      var serviceLabel = document.getElementById('reportService') ? document.getElementById('reportService').closest('label') : null;
      var anchor = focusLabel || serviceLabel;
      if (!anchor || !anchor.parentElement) return;
      var label = document.createElement('label');
      label.id = 'reportNeedLayerWrap';
      label.textContent = 'Need layer';
      var select = document.createElement('select');
      select.id = 'reportNeedLayer';
      Object.keys(metricOptions).forEach(function (key) {
        var option = document.createElement('option');
        option.value = key;
        option.textContent = metricOptions[key].label;
        select.appendChild(option);
      });
      label.appendChild(select);
      anchor.insertAdjacentElement('afterend', label);
    }
    updateNeedLayerVisibility();
  }

  function updateNeedLayerVisibility() {
    var wrap = document.getElementById('reportNeedLayerWrap');
    if (!wrap) return;
    wrap.style.display = valueOf('reportType') === 'gap' ? 'grid' : 'none';
  }

  async function buildGapReport() {
    var output = document.getElementById('reportOutput');
    if (!output) return;
    try {
      installNeedLayerControl();
      var county = activeCounty();
      var data = workspace();
      var settings = settingsFromControls();
      var orgs = filterOrgs(data.organizations, settings);
      var activities = filterActivities(data.activities, orgs, settings);
      var census = await loadCensus(county);
      var metricKey = resolveMetricKey(settings);
      var metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle;
      var all = allTracts(census, metricKey);
      var mappedAssets = orgs.filter(hasCoords);
      var scopeMissing = !settings.serviceType && !settings.focusTag;
      var body = '';

      if (scopeMissing) {
        body += metricSection([['County organizations', data.organizations.length], ['Mapped organizations', data.organizations.filter(hasCoords).length], ['Census tracts', all.length], ['ACS year', census && census.acsYear ? census.acsYear : 'n/a'], ['Selected service/focus', 'None'], ['Need layer', metric.label]]);
        body += section('Choose a service or focus lens', '<div class="report-callout"><p>This report needs a selected service type or focus tag. The service/focus lens defines the matching assets. The need layer defines the Census signal. Choose both, then generate the report again.</p></div>');
        body += section('Highest-need tracts before asset comparison', needOnlyTable(all.slice(0, 12), metricKey));
      } else {
        var ranked = actionRankedTracts(census, mappedAssets, metricKey);
        var shown = ranked.slice(0, 12);
        body += metricSection([['Relevant orgs', orgs.length], ['Mapped matching assets', mappedAssets.length], ['Census tracts', all.length], ['Focus first', ranked.filter(function (t) { return t.actionTier === 1; }).length], ['Investigate', ranked.filter(function (t) { return t.actionTier === 2; }).length], ['Capacity check', ranked.filter(function (t) { return t.actionTier === 4; }).length]]);
        body += section('How to read this report', '<div class="report-callout"><p>A tract rises to the top when it has both meaningful need and weak matching access. High need with a nearby matching asset is still important, but it is treated as a capacity, eligibility, hours, awareness, or coordination question rather than a geographic access gap.</p></div>');
        body += section('Geographic access readout', '<p>This report compares mapped assets matching <b>' + escapeHtml(settings.focusTag || settings.serviceType) + '</b> against the Census need layer <b>' + escapeHtml(metric.label) + '</b>. The final focus score uses an interaction model: <b>relative need x access gap</b>. This keeps tracts with very close matching access from dominating the gap list.</p>');
        body += section('Recommended focus order', tractTable(shown, metricKey));
        if (settings.includeCharts) body += section('Gap visuals', '<div class="chart-grid">' + barChart('Recommended attention order', shown.map(function (t) { return [t.shortLabel, t.focusScore]; }), 12) + barChart('Access gap score', shown.map(function (t) { return [t.shortLabel, t.accessGap]; }), 12) + '</div>');
        if (settings.includeOrgList) body += orgTable(mappedAssets, 'Mapped organizations used as matching assets');
        if (settings.includeActivities) body += activitySection(activities, data.organizations);
      }

      state.lastHtml = '<article class="report-doc"><header class="report-cover"><h1>Geographic Access / Gap Report</h1><p>' + escapeHtml(county.name || 'Active county') + ' | CONVENE Reporting Center</p><p>Generated ' + escapeHtml(new Date().toLocaleString()) + '</p><span class="report-chip">' + escapeHtml(scopeLabel(settings)) + '</span></header>' + body + '<footer class="report-section"><p class="muted small">Generated from the active county workspace. The service/focus selection defines matching assets. The need layer defines the Census signal. Recommended focus order is based on the combination of need and access gap, not need alone.</p></footer></article>';
      output.innerHTML = state.lastHtml;
    } catch (err) {
      console.error('Gap report failed', err);
      output.innerHTML = '<div class="card report-empty"><h3>Gap report could not be generated</h3><p>' + escapeHtml(err && err.message ? err.message : 'Unknown error') + '</p></div>';
    }
  }

  function settingsFromControls() { return { serviceType: valueOf('reportService'), focusTag: valueOf('reportFocus'), range: valueOf('reportRange') || 'all', start: valueOf('reportStart'), end: valueOf('reportEnd'), needLayer: valueOf('reportNeedLayer') || 'auto', includeCharts: checked('reportCharts'), includeOrgList: checked('reportOrgList'), includeActivities: checked('reportActivities') }; }
  function actionRankedTracts(census, mappedAssets, metricKey) { return allTracts(census, metricKey).map(function (tract) { var distances = mappedAssets.map(function (org) { return { org: org, miles: distanceMiles(tract.center[0], tract.center[1], Number(org.lat), Number(org.lng)) }; }).filter(function (item) { return Number.isFinite(item.miles); }).sort(function (a, b) { return a.miles - b.miles; }); var nearby = distances.filter(function (item) { return item.miles <= 10; }); var assetCount = nearby.length; var closest = distances[0] || null; var accessGap = accessGapScore(closest ? closest.miles : NaN, assetCount); var focusScore = Math.round((tract.needScore * accessGap) / 100); var category = actionCategory(tract.needScore, accessGap, closest ? closest.miles : NaN, assetCount); return Object.assign({}, tract, { assetCount: assetCount, closest: closest, accessGap: accessGap, focusScore: focusScore }, category); }).sort(function (a, b) { return a.actionTier - b.actionTier || b.focusScore - a.focusScore || b.accessGap - a.accessGap || b.needScore - a.needScore; }); }
  function actionCategory(needScore, accessGap) { if (needScore >= 35 && accessGap >= 55) return { actionTier: 1, actionLabel: 'Focus first' }; if (needScore >= 18 && accessGap >= 55) return { actionTier: 2, actionLabel: 'Investigate' }; if (accessGap >= 55) return { actionTier: 3, actionLabel: 'Monitor geography' }; if (needScore >= 35 && accessGap < 55) return { actionTier: 4, actionLabel: 'Capacity check' }; return { actionTier: 5, actionLabel: 'Maybe someday' }; }
  function accessGapScore(closestMiles, assetCount) { if (!Number.isFinite(Number(closestMiles))) return 100; var d = Number(closestMiles); var score = d <= 1 ? 0 : d <= 2 ? 18 : d <= 5 ? 40 : d <= 10 ? 65 : 90; if (assetCount >= 5) score -= 20; else if (assetCount >= 3) score -= 12; else if (assetCount >= 2) score -= 6; return Math.max(0, Math.min(100, Math.round(score))); }
  function tractTable(tracts, metricKey) { var metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle; return tracts.length ? table(['Order', 'Tract', 'Category', 'Population', metric.label, 'Relative need', 'Access gap', 'Final focus score', 'Closest matching asset'], tracts.map(function (t, i) { return [i + 1, t.name, t.actionLabel, formatPopulation(t.population), formatMetricValue(t.rawValue, metricKey), Math.round(t.needScore) + ' / 100', t.accessGap + ' / 100', t.focusScore + ' / 100', t.closest ? (t.closest.org.name || 'Unnamed organization') + ' (' + t.closest.miles.toFixed(1) + ' mi)' : 'None mapped']; })) : '<p class="muted">No census tract data available for the selected need layer.</p>'; }
  function needOnlyTable(tracts, metricKey) { var metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle; return tracts.length ? table(['Tract', 'Population', metric.label, 'Relative need score'], tracts.map(function (t) { return [t.name, formatPopulation(t.population), formatMetricValue(t.rawValue, metricKey), Math.round(t.needScore) + ' / 100']; })) : '<p class="muted">No census tract data available for the selected need layer.</p>'; }
  function resolveMetricKey(settings) { if (settings.needLayer && settings.needLayer !== 'auto') return settings.needLayer; var text = String((settings.serviceType || '') + ' ' + (settings.focusTag || '')).toLowerCase(); if (/aging|senior|older|elder|disab|adrc/.test(text)) return 'compositeSeniorAccess'; if (/housing|homeless|rent|eviction|shelter/.test(text)) return 'compositeHousingPressure'; if (/child|children|youth|family|families|school|education|literacy/.test(text)) return 'compositePovertyChildren'; if (/internet|digital|broadband|technology/.test(text)) return 'compositeDigitalAccess'; if (/language|english|immigrant|latino|hispanic|spanish/.test(text)) return 'compositeLanguagePoverty'; if (/workforce|employment|job|career|training/.test(text)) return 'unemployment'; return 'compositePovertyNoVehicle'; }
  async function loadCensus(county) { if (!county || !county.censusFile) return null; var response = await fetch(county.censusFile, { cache: 'no-store' }); if (!response.ok) return null; return response.json(); }
  function allTracts(census, metricKey) { var features = census && census.geojson && Array.isArray(census.geojson.features) ? census.geojson.features : census && Array.isArray(census.features) ? census.features : []; var tracts = features.map(function (feature) { var p = feature.properties || {}; var acs = p.acs || {}; var rawValue = firstNumber(acs[metricKey], p[metricKey]); return { name: tractLabel(p), shortLabel: tractLabel(p).replace('Census Tract ', 'Tract '), population: firstNumber(acs.population, acs.totalPopulation, acs.totalPop, acs.pop, acs.B01001_001E, p.population), rawValue: rawValue, center: centerOf(feature.geometry) }; }).filter(function (t) { return Number.isFinite(Number(t.rawValue)); }); var metric = metricOptions[metricKey] || metricOptions.compositePovertyNoVehicle; var values = tracts.map(function (t) { return Number(t.rawValue); }).sort(function (a, b) { return a - b; }); var min = values[0]; var max = values[values.length - 1]; return tracts.map(function (t) { t.needScore = relativeNeedScore(t.rawValue, min, max, Boolean(metric.inverse)); return t; }).sort(function (a, b) { return b.needScore - a.needScore; }); }
  function activeCounty() { var id = valueOf('countySelect') || window.CONVENE_DEFAULT_COUNTY || 'fdl'; return window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[id] ? window.CONVENE_COUNTIES[id] : { id: id, name: id, storagePrefix: 'convene:' + id }; }
  function workspace() { var county = activeCounty(); var raw = window.ConveneStorage && ConveneStorage.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {}; return { organizations: arr(raw.organizations).map(normalizeOrg), contacts: arr(raw.contacts), activities: arr(raw.activities).map(normalizeActivity), relationships: arr(raw.relationships) }; }
  function normalizeOrg(raw) { raw = raw || {}; var focus = Array.isArray(raw.focus || raw.tags || raw.focusTags) ? (raw.focus || raw.tags || raw.focusTags).join(', ') : String(raw.focus || raw.tags || raw.focusTags || ''); return Object.assign({}, raw, { id: raw.id || raw.orgId || raw.organizationId || '', name: raw.name || raw.organization || '', type: raw.type || raw.category || '', status: raw.status || '', reach: raw.reach || raw.geographicReach || '', confidence: raw.confidence || raw.reachConfidence || '', focus: focus, address: raw.address || '', lat: cleanNumber(raw.lat || raw.latitude), lng: cleanNumber(raw.lng || raw.longitude) }); }
  function normalizeActivity(raw) { raw = raw || {}; return Object.assign({}, raw, { organizationIds: toArray(raw.organizationIds || raw.orgIds || raw.organizations), contactIds: toArray(raw.contactIds || raw.contacts) }); }
  function filterOrgs(orgs, settings) { return orgs.filter(function (org) { return (!settings.serviceType || org.type === settings.serviceType) && (!settings.focusTag || tagsOf(org).some(function (tag) { return key(tag) === key(settings.focusTag); })); }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }); }
  function filterActivities(activities, orgs, settings) { var ids = new Set(orgs.map(function (o) { return o.id; }).filter(Boolean)); var win = dateWindow(settings); return activities.filter(function (activity) { var date = activity.date ? new Date(activity.date + 'T00:00:00') : null; var dateOk = (!win.start || (date && date >= win.start)) && (!win.end || (date && date <= win.end)); var scopeOk = !ids.size || toArray(activity.organizationIds).some(function (id) { return ids.has(id); }); return dateOk && scopeOk; }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }); }
  function dateWindow(settings) { if (settings.range === 'all') return {}; if (settings.range === 'custom') return { start: settings.start ? new Date(settings.start + 'T00:00:00') : null, end: settings.end ? new Date(settings.end + 'T23:59:59') : null }; var days = Number(settings.range || 0); var end = new Date(); var start = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0); return { start: start, end: end }; }
  function metricSection(items) { return '<section class="report-section"><div class="metric-grid">' + items.map(function (item) { return '<div class="report-metric"><span>' + escapeHtml(item[0]) + '</span><b>' + escapeHtml(String(item[1] == null ? 0 : item[1])) + '</b></div>'; }).join('') + '</div></section>'; }
  function section(title, body) { return '<section class="report-section"><h2>' + escapeHtml(title) + '</h2>' + body + '</section>'; }
  function table(headers, rows) { return '<div class="report-table-wrap"><table class="report-table"><thead><tr>' + headers.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(String(cell == null ? '' : cell)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  function barChart(title, entries, limit) { var rows = (entries || []).slice().sort(function (a, b) { return (Number(b[1]) || 0) - (Number(a[1]) || 0); }).slice(0, limit || 12); var max = Math.max.apply(null, [1].concat(rows.map(function (row) { return Number(row[1]) || 0; }))); return '<div class="chart-box"><h3>' + escapeHtml(title) + '</h3>' + (rows.length ? rows.map(function (row) { var label = row[0]; var count = row[1]; return '<div class="bar-row"><span title="' + escapeAttr(label) + '">' + escapeHtml(shorten(label, 32)) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + Math.max(3, Math.round(((Number(count) || 0) / max) * 100)) + '%"></div></div><b>' + escapeHtml(String(count)) + '</b></div>'; }).join('') : '<p class="muted">No records.</p>') + '</div>'; }
  function orgTable(orgs, title) { return section(title || 'Organization list', orgs.length ? table(['Name', 'Type', 'Focus', 'Status', 'Reach', 'Confidence', 'Address'], orgs.slice(0, 80).map(function (o) { return [o.name, o.type, tagsOf(o).join(', '), o.status, o.reach, o.confidence, o.address]; })) : '<p class="muted">No organizations found.</p>'); }
  function activitySection(activities, orgs) { return section('Recent activity', activities.length ? table(['Date', 'Type', 'Summary', 'Organizations', 'Follow-up'], activities.slice(0, 30).map(function (a) { return [formatDate(a.date), a.type || '', a.summary || '', toArray(a.organizationIds).map(function (id) { return orgName(id, orgs); }).join(', '), followUp(a)]; })) : '<p class="muted">No activities found.</p>'); }
  function centerOf(geometry) { var pts = []; rings(geometry || {}).forEach(function (r) { r.forEach(function (c) { if (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) pts.push(c); }); }); if (!pts.length) return [NaN, NaN]; return [pts.reduce(function (s, c) { return s + Number(c[1]); }, 0) / pts.length, pts.reduce(function (s, c) { return s + Number(c[0]); }, 0) / pts.length]; }
  function rings(g) { if (g.type === 'Polygon') return g.coordinates || []; if (g.type === 'MultiPolygon') return (g.coordinates || []).flat(); return []; }
  function relativeNeedScore(value, min, max, inverse) { var n = Number(value); if (!Number.isFinite(n) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0; var scaled = ((n - min) / (max - min)) * 100; return Math.max(0, Math.min(100, Math.round(inverse ? 100 - scaled : scaled))); }
  function distanceMiles(lat1, lng1, lat2, lng2) { if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN; var r = 3958.8; var dLat = rad(lat2 - lat1); var dLng = rad(lng2 - lng1); var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
  function rad(d) { return d * Math.PI / 180; }
  function firstNumber() { for (var i = 0; i < arguments.length; i += 1) { var n = Number(arguments[i]); if (Number.isFinite(n)) return n; } return NaN; }
  function formatPopulation(value) { var n = Number(value); return Number.isFinite(n) ? Math.round(n).toLocaleString() : 'n/a'; }
  function formatMetricValue(value, metricKey) { var metric = metricOptions[metricKey] || {}; var n = Number(value); if (!Number.isFinite(n)) return 'n/a'; if (metric.prefix === '$') return '$' + Math.round(n).toLocaleString(); return (Number.isInteger(n) ? n : n.toFixed(1)) + (metric.suffix || ''); }
  function tractLabel(p) { var raw = p.name || p.NAME || p.tract || p.TRACTCE || p.GEOID || 'Tract'; return /^census tract/i.test(String(raw)) ? String(raw) : 'Census Tract ' + raw; }
  function hasCoords(o) { return Number.isFinite(Number(o && o.lat)) && Number.isFinite(Number(o && o.lng)); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function cleanNumber(v) { var n = Number(String(v == null ? '' : v).trim().replace(/^--/, '-')); return Number.isFinite(n) ? String(n) : ''; }
  function toArray(v) { return Array.isArray(v) ? v : String(v || '').split(/[;,|]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function tagsOf(o) { return Array.from(new Set(toArray(o.focus || o.tags || o.focusTags))); }
  function orgName(id, orgs) { var found = (orgs || []).find(function (o) { return o.id === id; }); return found ? found.name : 'Unknown organization'; }
  function followUp(a) { return a.followUpDate ? formatDate(a.followUpDate) + (a.followUpCompleted ? ' (completed)' : ' (open)') : 'No follow-up'; }
  function formatDate(v) { if (!v) return ''; var d = new Date(v + 'T00:00:00'); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(); }
  function scopeLabel(s) { return [s.serviceType, s.focusTag, s.needLayer && s.needLayer !== 'auto' ? (metricOptions[s.needLayer] ? metricOptions[s.needLayer].label : s.needLayer) : 'Auto need layer'].filter(Boolean).join(' | ') || 'Gap report'; }
  function valueOf(id) { var el = document.getElementById(id); return el ? el.value || '' : ''; }
  function checked(id) { var el = document.getElementById(id); return Boolean(el && el.checked); }
  function key(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function shorten(v, n) { var s = String(v || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function escapeHtml(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]; }); }
  function escapeAttr(v) { return escapeHtml(v).replace(/'/g, '&#39;'); }
  function closest(target, selector) { return target && target.closest ? target.closest(selector) : null; }
})();