(() => {
  if (window.__conveneReportFallbackLoaded) return;
  window.__conveneReportFallbackLoaded = true;

  let lastReportHtml = '';

  document.addEventListener('click', event => {
    if (event.target.closest('#generateReportBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      generateReportSafely();
    }
    if (event.target.closest('#reportPrintBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!lastReportHtml) generateReportSafely().then(() => window.print());
      else window.print();
    }
    if (event.target.closest('#reportExportBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportReport();
    }
    if (event.target.closest('#resetReportBtn')) {
      setTimeout(populateReportDropdowns, 80);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches('#countySelect, #reportType, #reportService, #reportFocus')) {
      setTimeout(populateReportDropdowns, 80);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => setTimeout(populateReportDropdowns, 500));
  setTimeout(populateReportDropdowns, 1000);

  async function generateReportSafely() {
    const output = document.getElementById('reportOutput');
    if (!output) return;
    try {
      populateReportDropdowns();
      const county = activeCounty();
      const data = workspace();
      const settings = settingsFromControls();
      const orgs = filterOrgs(data.organizations, settings);
      const activities = filterActivities(data.activities, orgs, settings);
      const relationships = filterRelationships(data.relationships, orgs);
      const census = settings.reportType === 'gap' ? await loadCensus(county) : null;
      lastReportHtml = buildReport(county, data, orgs, activities, relationships, census, settings);
      output.innerHTML = lastReportHtml;
    } catch (err) {
      console.error('CONVENE report generation failed', err);
      output.innerHTML = `<div class="card report-empty"><h3>Report could not be generated</h3><p>${escapeHtml(err?.message || 'Unknown report error')}</p><p class="muted">The reporting fallback caught the error instead of leaving the page stuck.</p></div>`;
    }
  }

  function buildReport(county, data, orgs, activities, relationships, census, settings) {
    const titleMap = {
      ecosystem: 'County Ecosystem Snapshot',
      focus: `${settings.focusTag || settings.serviceType || 'Focus Area'} Report`,
      gap: 'Geographic Access / Gap Report',
      engagement: 'Partner Engagement Report',
      network: 'Relationship / Network Report',
      quality: 'Data Quality Report'
    };
    const title = titleMap[settings.reportType] || titleMap.ecosystem;
    let body = '';

    if (settings.reportType === 'ecosystem') body = ecosystemBody(data, orgs, activities, relationships, settings);
    else if (settings.reportType === 'focus') body = focusBody(data, orgs, activities, relationships, settings);
    else if (settings.reportType === 'gap') body = gapBody(data, orgs, activities, census, settings);
    else if (settings.reportType === 'engagement') body = engagementBody(data, orgs, activities, relationships, settings);
    else if (settings.reportType === 'network') body = networkBody(data, orgs, relationships, settings);
    else if (settings.reportType === 'quality') body = qualityBody(data, orgs, settings);
    else body = ecosystemBody(data, orgs, activities, relationships, settings);

    return `<article class="report-doc">
      <header class="report-cover">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(county.name || 'Active county')} | CONVENE Reporting Center</p>
        <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
        <span class="report-chip">${escapeHtml(scopeLabel(settings))}</span>
      </header>
      ${body}
      <footer class="report-section"><p class="muted small">Generated from the active county's browser-stored CONVENE workspace. Census sections use the county census file when available.</p></footer>
    </article>`;
  }

  function ecosystemBody(data, orgs, activities, relationships, settings) {
    return `
      ${metricSection([['Organizations', orgs.length], ['Mapped', orgs.filter(hasCoords).length], ['Contacts', data.contacts.length], ['Activities', activities.length], ['Relationships', relationships.length], ['Missing coords', orgs.filter(o => !hasCoords(o)).length]])}
      ${section('Summary interpretation', `<p>The workspace contains ${orgs.length} organization records in the selected scope. ${percent(orgs.filter(hasCoords).length, orgs.length)}% are currently mapped. The largest service categories are ${topList(countBy(orgs, o => o.type || 'No type'), 3)}.</p>`)}
      ${settings.includeCharts ? charts(orgs) : ''}
      ${settings.includeRelationships ? relationshipSection(relationships, data.organizations) : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}
      ${settings.includeQuality ? qualityNotes(orgs) : ''}
      ${settings.includeOrgList ? orgTable(orgs) : ''}`;
  }

  function focusBody(data, orgs, activities, relationships, settings) {
    return `
      ${metricSection([['Relevant orgs', orgs.length], ['Mapped orgs', orgs.filter(hasCoords).length], ['Activities', activities.length], ['Relationships', relationships.length], ['Research-only', orgs.filter(isResearchOnly).length], ['Low confidence', orgs.filter(isLowConfidence).length]])}
      ${section('Focus area readout', `<p>This report narrows the workspace to ${escapeHtml(settings.focusTag || settings.serviceType || 'the selected focus area')}. It includes ${orgs.length} relevant organizations, ${activities.length} activities, and ${relationships.length} relationship records connected to the selected scope.</p>`)}
      ${settings.includeCharts ? charts(orgs) : ''}
      ${settings.includeRelationships ? relationshipSection(relationships, data.organizations) : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}
      ${settings.includeQuality ? qualityNotes(orgs) : ''}
      ${settings.includeOrgList ? orgTable(orgs) : ''}`;
  }

  function gapBody(data, orgs, activities, census, settings) {
    const tracts = priorityTracts(census, orgs).slice(0, 12);
    return `
      ${metricSection([['Relevant orgs', orgs.length], ['Mapped assets', orgs.filter(hasCoords).length], ['Census tracts', allTracts(census).length], ['Priority tracts shown', tracts.length], ['No nearby assets', tracts.filter(t => t.assetCount === 0).length], ['Activities', activities.length]])}
      ${section('Geographic access readout', `<p>This report compares tract-level need signals with mapped assets in the selected service or focus scope. Treat high-priority tracts as planning signals for follow-up, not as proof that no service exists.</p>`)}
      ${section('Priority tract table', tractTable(tracts))}
      ${settings.includeCharts ? section('Gap visuals', `<div class="chart-grid">${barChart('Priority tracts', tracts.map(t => [t.name, t.priority]), 12)}${barChart('Assets within 10 miles', tracts.map(t => [t.name, t.assetCount]), 12)}</div>`) : ''}
      ${settings.includeOrgList ? orgTable(orgs.filter(hasCoords), 'Mapped organizations used as assets') : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}`;
  }

  function engagementBody(data, orgs, activities, relationships, settings) {
    return `
      ${metricSection([['Organizations in scope', orgs.length], ['Activities', activities.length], ['Open follow-ups', activities.filter(a => a.followUpDate && !a.followUpCompleted).length], ['Completed follow-ups', activities.filter(a => a.followUpDate && a.followUpCompleted).length], ['Contacts', data.contacts.length], ['Relationships', relationships.length]])}
      ${section('Engagement readout', `<p>This report summarizes outreach, meetings, calls, site visits, and follow-up activity in the selected scope. Use it to check whether engagement is broad across the ecosystem or concentrated around a smaller set of partners.</p>`)}
      ${settings.includeCharts ? section('Engagement visuals', `<div class="chart-grid">${barChart('Organization status', countBy(orgs, o => o.status || 'No status'))}${barChart('Activity type', countBy(activities, a => a.type || 'Activity'))}</div>`) : ''}
      ${activitySection(activities, data.organizations, 'Activity log')}
      ${settings.includeOrgList ? orgTable(orgs, 'Organizations in engagement scope') : ''}`;
  }

  function networkBody(data, orgs, relationships, settings) {
    const degrees = degreeMap(orgs, relationships);
    const isolated = orgs.filter(o => !degrees.get(o.id));
    const hubs = [...degrees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, degree]) => [orgName(id, data.organizations), degree]);
    return `
      ${metricSection([['Organizations', orgs.length], ['Relationships', relationships.length], ['Connected orgs', orgs.length - isolated.length], ['Isolated orgs', isolated.length], ['Potential ties', relationships.filter(r => /potential/i.test(r.status || '')).length], ['Strong ties', relationships.filter(r => /strong/i.test(r.strength || '')).length]])}
      ${section('Network readout', `<p>The relationship map contains ${relationships.length} recorded connections in the selected scope. ${isolated.length} organizations do not currently have a mapped relationship, which may reflect an actual network gap or incomplete relationship tracking.</p>`)}
      ${section('Network hubs', hubs.length ? table(['Organization', 'Mapped relationships'], hubs) : '<p class="muted">No relationship hubs found yet.</p>')}
      ${relationshipSection(relationships, data.organizations)}
      ${settings.includeOrgList ? orgTable(isolated, 'Organizations without mapped relationships') : ''}`;
  }

  function qualityBody(data, orgs, settings) {
    const missingCoords = orgs.filter(o => !hasCoords(o));
    const missingContact = orgs.filter(o => !String(o.phone || o.email || o.website || '').trim());
    const researchOnly = orgs.filter(isResearchOnly);
    const lowConfidence = orgs.filter(isLowConfidence);
    const dupes = duplicateCandidates(orgs);
    return `
      ${metricSection([['Records reviewed', orgs.length], ['Missing coordinates', missingCoords.length], ['Missing phone/email/web', missingContact.length], ['Research-only', researchOnly.length], ['Low confidence', lowConfidence.length], ['Possible duplicates', dupes.length]])}
      ${section('Data quality readout', `<p>This report identifies cleanup items that affect mapping, reporting, and credibility. Missing coordinates, low-confidence records, and research-only records should be reviewed before public presentation.</p>`)}
      <div class="report-two">
        ${issueSection('Missing coordinates', missingCoords, ['Name', 'Type', 'Address'], o => [o.name, o.type, o.address])}
        ${issueSection('Low confidence / verify', lowConfidence, ['Name', 'Type', 'Confidence'], o => [o.name, o.type, o.confidence])}
        ${issueSection('Research-only records', researchOnly, ['Name', 'Type', 'Status'], o => [o.name, o.type, o.status])}
        ${issueSection('Possible duplicates', dupes, ['Possible match', 'Reason'], d => [d.names, d.reason])}
      </div>`;
  }

  function populateReportDropdowns() {
    const data = workspace();
    setOptions(document.getElementById('reportService'), unique(data.organizations.map(o => o.type)), 'All service types');
    setOptions(document.getElementById('reportFocus'), unique(data.organizations.flatMap(tagsOf)), 'All focus tags');
  }

  function settingsFromControls() {
    return {
      reportType: valueOf('reportType') || 'ecosystem',
      serviceType: valueOf('reportService'),
      focusTag: valueOf('reportFocus'),
      range: valueOf('reportRange') || 'all',
      start: valueOf('reportStart'),
      end: valueOf('reportEnd'),
      includeCharts: checked('reportCharts'),
      includeOrgList: checked('reportOrgList'),
      includeActivities: checked('reportActivities'),
      includeRelationships: checked('reportRelationships'),
      includeQuality: checked('reportQuality')
    };
  }

  function activeCounty() {
    const id = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES?.[id] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY] || { id, name: id, storagePrefix: `convene:${id}` };
  }

  function workspace() {
    const county = activeCounty();
    const raw = window.ConveneStorage?.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {};
    return {
      organizations: toArrayRecords(raw.organizations).map(normalizeOrg),
      contacts: toArrayRecords(raw.contacts),
      activities: toArrayRecords(raw.activities).map(normalizeActivity),
      relationships: toArrayRecords(raw.relationships).map(normalizeRelationship)
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
      focus: normalizeFocus(raw.focus ?? raw.tags ?? raw.focusTags),
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

  function normalizeRelationship(raw = {}) {
    return { ...raw, fromOrgId: raw.fromOrgId || raw.sourceOrgId || raw.orgAId || '', toOrgId: raw.toOrgId || raw.targetOrgId || raw.orgBId || '' };
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
    const window = dateWindow(settings);
    return activities.filter(activity => {
      const date = activity.date ? new Date(`${activity.date}T00:00:00`) : null;
      const dateOk = (!window.start || (date && date >= window.start)) && (!window.end || (date && date <= window.end));
      const scopeOk = !ids.size || toArray(activity.organizationIds).some(id => ids.has(id));
      return dateOk && scopeOk;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function filterRelationships(relationships, orgs) {
    const ids = new Set(orgs.map(o => o.id).filter(Boolean));
    return relationships.filter(rel => ids.has(rel.fromOrgId) || ids.has(rel.toOrgId));
  }

  function dateWindow(settings) {
    if (settings.range === 'all') return {};
    if (settings.range === 'custom') return {
      start: settings.start ? new Date(`${settings.start}T00:00:00`) : null,
      end: settings.end ? new Date(`${settings.end}T23:59:59`) : null
    };
    const days = Number(settings.range || 0);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  async function loadCensus(county) {
    if (!county?.censusFile) return null;
    try {
      const response = await fetch(county.censusFile, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  function allTracts(census) {
    const features = census?.geojson?.features || census?.features || [];
    return features.map(feature => {
      const p = feature.properties || {};
      return {
        name: p.name || p.NAME || p.tract || p.GEOID || 'Tract',
        population: Number(p.population ?? p.totalPopulation ?? p.B01001_001E ?? 0),
        need: Number(p.needScore ?? p.relativeNeedScore ?? p.priorityScore ?? p.compositeScore ?? 0),
        center: centerOf(feature.geometry)
      };
    });
  }

  function priorityTracts(census, orgs) {
    const mapped = orgs.filter(hasCoords);
    return allTracts(census).map(tract => {
      const distances = mapped.map(org => distanceMiles(tract.center[0], tract.center[1], Number(org.lat), Number(org.lng))).filter(Number.isFinite).sort((a, b) => a - b);
      const assetCount = distances.filter(d => d <= 10).length;
      const priority = Math.max(0, Math.min(100, Math.round(tract.need + (assetCount === 0 ? 25 : assetCount <= 2 ? 12 : 0))));
      return { ...tract, assetCount, closest: distances[0], priority };
    }).sort((a, b) => b.priority - a.priority || a.assetCount - b.assetCount);
  }

  function centerOf(geometry = {}) {
    const points = [];
    rings(geometry).forEach(ring => ring.forEach(coord => {
      if (Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]))) points.push(coord);
    }));
    if (!points.length) return [NaN, NaN];
    return [points.reduce((sum, c) => sum + Number(c[1]), 0) / points.length, points.reduce((sum, c) => sum + Number(c[0]), 0) / points.length];
  }

  function rings(geometry = {}) {
    if (geometry.type === 'Polygon') return geometry.coordinates || [];
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
    return [];
  }

  function metricSection(items) {
    return section('', `<div class="metric-grid">${items.map(([label, value]) => `<div class="report-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value ?? 0))}</b></div>`).join('')}</div>`).replace('<h2></h2>', '');
  }

  function charts(orgs) {
    return section('Charts and visuals', `<div class="chart-grid">${barChart('By service type', countBy(orgs, o => o.type || 'No type'))}${barChart('By focus tag', countTags(orgs))}${barChart('By reach', countBy(orgs, o => o.reach || 'No reach'))}${barChart('By confidence', countBy(orgs, o => o.confidence || 'No confidence'))}</div>`);
  }

  function orgTable(orgs, title = 'Organization list') {
    const rows = orgs.slice(0, 80).map(o => [o.name, o.type, tagsOf(o).join(', '), o.status, o.reach, o.confidence, o.address]);
    return section(title, rows.length ? table(['Name', 'Type', 'Focus', 'Status', 'Reach', 'Confidence', 'Address'], rows) + (orgs.length > 80 ? `<p class="muted small">Showing first 80 of ${orgs.length}.</p>` : '') : '<p class="muted">No organizations found.</p>');
  }

  function activitySection(activities, orgs, title = 'Recent activity') {
    const rows = activities.slice(0, 30).map(a => [formatDate(a.date), a.type || '', a.summary || '', toArray(a.organizationIds).map(id => orgName(id, orgs)).join(', '), followUp(a)]);
    return section(title, rows.length ? table(['Date', 'Type', 'Summary', 'Organizations', 'Follow-up'], rows) : '<p class="muted">No activities found.</p>');
  }

  function relationshipSection(relationships, orgs) {
    const rows = relationships.slice(0, 40).map(r => [orgName(r.fromOrgId, orgs), orgName(r.toOrgId, orgs), r.status || '', r.strength || '', r.summary || r.notes || '']);
    return section('Relationship summary', rows.length ? table(['Organization A', 'Organization B', 'Status', 'Strength', 'Summary'], rows) : '<p class="muted">No relationships found.</p>');
  }

  function qualityNotes(orgs) {
    return section('Data quality notes', `<div class="report-callout"><p>${orgs.filter(o => !hasCoords(o)).length} records are missing coordinates. ${orgs.filter(isResearchOnly).length} are research-only. ${orgs.filter(isLowConfidence).length} are low confidence or need verification.</p></div>`);
  }

  function issueSection(title, items, headers, mapper) {
    return section(title, items.length ? table(headers, items.slice(0, 30).map(mapper)) : '<p class="muted">No issues found in this category.</p>');
  }

  function tractTable(tracts) {
    return tracts.length ? table(['Tract', 'Population', 'Need score', 'Priority', 'Assets within 10 mi', 'Closest asset'], tracts.map(t => [t.name, t.population || 'n/a', t.need || 'n/a', t.priority, t.assetCount, t.closest == null ? 'None mapped' : `${t.closest.toFixed(1)} mi`])) : '<p class="muted">No census tract data available.</p>';
  }

  function section(title, body) {
    return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
  }

  function table(headers, rows) {
    return `<div class="report-table-wrap"><table class="report-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function barChart(title, entries, limit = 10) {
    const rows = (entries || []).slice(0, limit);
    const max = Math.max(1, ...rows.map(row => Number(row[1]) || 0));
    return `<div class="chart-box"><h3>${escapeHtml(title)}</h3>${rows.length ? rows.map(([label, count]) => `<div class="bar-row"><span title="${escapeAttr(label)}">${escapeHtml(shorten(label, 28))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round(((Number(count) || 0) / max) * 100))}%"></div></div><b>${escapeHtml(String(count))}</b></div>`).join('') : '<p class="muted">No records.</p>'}</div>`;
  }

  function exportReport() {
    if (!lastReportHtml) {
      alert('Generate a report before exporting.');
      return;
    }
    const county = activeCounty();
    const style = document.getElementById('reportsV2Styles')?.textContent || '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CONVENE Report</title><style>${style}</style></head><body>${lastReportHtml}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convene-${county.id}-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setOptions(select, values, blankLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(blankLabel)}</option>` + values.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('');
    select.value = values.includes(current) ? current : '';
  }

  function toArrayRecords(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeFocus(value) {
    if (Array.isArray(value)) return value.join(', ');
    return String(value || '');
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    return String(value || '').split(/[;,|]/).map(v => v.trim()).filter(Boolean);
  }

  function tagsOf(org) {
    return [...new Set(toArray(org.focus || org.tags || org.focusTags))];
  }

  function countTags(orgs) {
    const counts = new Map();
    orgs.forEach(org => tagsOf(org).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function countBy(items, getter) {
    const counts = new Map();
    items.forEach(item => {
      const keyValue = String(getter(item) || 'Blank').trim() || 'Blank';
      counts.set(keyValue, (counts.get(keyValue) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function duplicateCandidates(orgs) {
    const groups = new Map();
    orgs.forEach(org => {
      const k = key(org.name);
      if (!k) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(org);
    });
    return [...groups.values()].filter(group => group.length > 1).map(group => ({ names: group.map(o => o.name).join(' | '), reason: 'Same normalized name' }));
  }

  function degreeMap(orgs, relationships) {
    const ids = new Set(orgs.map(o => o.id));
    const degrees = new Map();
    relationships.forEach(rel => {
      if (ids.has(rel.fromOrgId)) degrees.set(rel.fromOrgId, (degrees.get(rel.fromOrgId) || 0) + 1);
      if (ids.has(rel.toOrgId)) degrees.set(rel.toOrgId, (degrees.get(rel.toOrgId) || 0) + 1);
    });
    return degrees;
  }

  function cleanNumber(value) {
    const num = Number(String(value ?? '').trim().replace(/^--/, '-'));
    return Number.isFinite(num) ? String(num) : '';
  }

  function hasCoords(org) {
    return Number.isFinite(Number(org?.lat)) && Number.isFinite(Number(org?.lng));
  }

  function isResearchOnly(org) {
    return /research/i.test(org.status || '');
  }

  function isLowConfidence(org) {
    return /low|needs/i.test(org.confidence || '');
  }

  function orgName(id, orgs) {
    return (orgs || []).find(org => org.id === id)?.name || 'Unknown organization';
  }

  function followUp(activity) {
    if (!activity.followUpDate) return 'No follow-up';
    return `${formatDate(activity.followUpDate)} ${activity.followUpCompleted ? '(completed)' : '(open)'}`;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  function scopeLabel(settings) {
    return [settings.serviceType, settings.focusTag, settings.range !== 'all' ? (settings.range === 'custom' ? 'Custom date range' : `Last ${settings.range} days`) : ''].filter(Boolean).join(' | ') || 'All records in active county workspace';
  }

  function percent(part, whole) {
    return whole ? Math.round((part / whole) * 100) : 0;
  }

  function topList(entries, limit) {
    return entries.slice(0, limit).map(([label, count]) => `${escapeHtml(label)} (${count})`).join(', ') || 'not yet established';
  }

  function distanceMiles(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN;
    const radius = 3958.8;
    const dLat = radians(lat2 - lat1);
    const dLng = radians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function radians(degrees) { return degrees * Math.PI / 180; }
  function valueOf(id) { return document.getElementById(id)?.value || ''; }
  function checked(id) { return Boolean(document.getElementById(id)?.checked); }
  function key(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function unique(values) { return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
  function shorten(value, max) { const text = String(value || ''); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
})();