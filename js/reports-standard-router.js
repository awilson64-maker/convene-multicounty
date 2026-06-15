(function () {
  if (window.__conveneReportsStandardRouterLoaded) return;
  window.__conveneReportsStandardRouterLoaded = true;

  var state = { lastHtml: '' };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    document.addEventListener('click', function (event) {
      var generate = closest(event.target, '#generateReportBtn');
      if (generate && valueOf('reportType') !== 'gap') {
        event.preventDefault();
        event.stopImmediatePropagation();
        buildStandardReport();
        return;
      }

      var exportBtn = closest(event.target, '#reportExportBtn');
      if (exportBtn && state.lastHtml && valueOf('reportType') !== 'gap') {
        event.preventDefault();
        event.stopImmediatePropagation();
        exportHtml();
      }
    }, true);
  }

  function buildStandardReport() {
    var output = document.getElementById('reportOutput');
    if (!output) return;
    try {
      var county = activeCounty();
      var data = workspace();
      var settings = settingsFromControls();
      var orgs = filterOrganizations(data.organizations, settings);
      var activities = filterActivities(data.activities, orgs, settings);
      var relationships = filterRelationships(data.relationships, orgs);
      var title = reportTitle(settings.type, settings);
      var body = '';

      if (settings.type === 'focus') body = focusReport(data, orgs, activities, relationships, settings);
      else if (settings.type === 'engagement') body = engagementReport(data, orgs, activities, relationships, settings);
      else if (settings.type === 'network') body = networkReport(data, orgs, activities, relationships, settings);
      else if (settings.type === 'quality') body = qualityReport(data, orgs, activities, relationships, settings);
      else body = ecosystemReport(data, orgs, activities, relationships, settings);

      state.lastHtml = shell(county, title, scopeText(settings), body);
      output.innerHTML = state.lastHtml;
    } catch (err) {
      console.error('Standard report failed', err);
      output.innerHTML = '<div class="card report-empty"><h3>Report could not be generated</h3><p>' + escapeHtml(err && err.message ? err.message : 'Unknown error') + '</p></div>';
    }
  }

  function ecosystemReport(data, orgs, activities, relationships, settings) {
    return metricSection([
      ['Organizations', orgs.length],
      ['Mapped', orgs.filter(hasCoords).length],
      ['Contacts', data.contacts.length],
      ['Activities', activities.length],
      ['Relationships', relationships.length],
      ['Missing coords', orgs.filter(function (o) { return !hasCoords(o); }).length]
    ]) + section('Summary interpretation', '<p>The active workspace contains <b>' + orgs.length + '</b> organizations. The largest service types are ' + topList(countBy(orgs, function (o) { return o.type || 'No type'; }), 4) + '.</p>') +
      (settings.charts ? charts(orgs) : '') +
      (settings.relationships ? relationshipSection(relationships, data.organizations) : '') +
      (settings.activities ? activitySection(activities, data.organizations) : '') +
      (settings.quality ? qualityNotes(orgs) : '') +
      (settings.orgList ? orgTable(orgs, 'Organization list') : '');
  }

  function focusReport(data, orgs, activities, relationships, settings) {
    return metricSection([
      ['Relevant orgs', orgs.length],
      ['Mapped orgs', orgs.filter(hasCoords).length],
      ['Activities', activities.length],
      ['Relationships', relationships.length],
      ['Research-only', orgs.filter(isResearchOnly).length],
      ['Low confidence', orgs.filter(isLowConfidence).length]
    ]) + section('Focus area readout', '<p>This report narrows the workspace to <b>' + escapeHtml(settings.focus || settings.service || 'the selected focus area') + '</b>.</p>') +
      (settings.charts ? charts(orgs) : '') +
      (settings.relationships ? relationshipSection(relationships, data.organizations) : '') +
      (settings.activities ? activitySection(activities, data.organizations) : '') +
      (settings.quality ? qualityNotes(orgs) : '') +
      (settings.orgList ? orgTable(orgs, 'Organizations in focus area') : '');
  }

  function engagementReport(data, orgs, activities, relationships, settings) {
    var open = activities.filter(function (a) { return a.followUpDate && !a.followUpCompleted; });
    return metricSection([
      ['Organizations in scope', orgs.length],
      ['Activities', activities.length],
      ['Open follow-ups', open.length],
      ['Contacts', data.contacts.length],
      ['Relationships', relationships.length],
      ['Recent activities shown', Math.min(activities.length, 40)]
    ]) + section('Engagement readout', '<p>This report summarizes partner outreach, meetings, follow-ups, and other recorded engagement activity for the selected scope.</p>') +
      (settings.charts ? section('Engagement visuals', '<div class="chart-grid">' + barChart('Organization status', countBy(orgs, function (o) { return o.status || 'No status'; }), 10) + barChart('Activity type', countBy(activities, function (a) { return a.type || 'Activity'; }), 10) + '</div>') : '') +
      activitySection(activities, data.organizations, 'Activity log') +
      (settings.orgList ? orgTable(orgs, 'Organizations in engagement scope') : '');
  }

  function networkReport(data, orgs, activities, relationships, settings) {
    var degrees = degreeMap(orgs, relationships);
    var isolated = orgs.filter(function (o) { return !degrees[o.id]; });
    var hubs = Object.keys(degrees).map(function (id) { return [orgName(id, data.organizations), degrees[id]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
    return metricSection([
      ['Organizations', orgs.length],
      ['Relationships', relationships.length],
      ['Connected orgs', orgs.length - isolated.length],
      ['Isolated orgs', isolated.length],
      ['Strong ties', relationships.filter(function (r) { return /strong/i.test(r.strength || ''); }).length],
      ['Potential ties', relationships.filter(function (r) { return /potential/i.test(r.status || ''); }).length]
    ]) + section('Network readout', '<p>This report summarizes recorded relationships among organizations in the selected scope.</p>') +
      section('Network hubs', hubs.length ? table(['Organization', 'Mapped relationships'], hubs) : '<p class="muted">No hubs found yet.</p>') +
      relationshipSection(relationships, data.organizations) +
      (settings.orgList ? orgTable(isolated, 'Organizations without mapped relationships') : '');
  }

  function qualityReport(data, orgs, activities, relationships, settings) {
    var missingCoords = orgs.filter(function (o) { return !hasCoords(o); });
    var missingContact = orgs.filter(function (o) { return !String((o.phone || '') + (o.email || '') + (o.website || '')).trim(); });
    var researchOnly = orgs.filter(isResearchOnly);
    var lowConfidence = orgs.filter(isLowConfidence);
    return metricSection([
      ['Records reviewed', orgs.length],
      ['Missing coordinates', missingCoords.length],
      ['Missing phone/email/web', missingContact.length],
      ['Research-only', researchOnly.length],
      ['Low confidence', lowConfidence.length],
      ['Relationships reviewed', relationships.length]
    ]) + section('Data quality readout', '<p>This report identifies cleanup items that affect mapping, reporting, and stakeholder credibility.</p>') +
      '<div class="report-two">' + issueTable('Missing coordinates', missingCoords, ['Name', 'Type', 'Address'], function (o) { return [o.name, o.type, o.address]; }) + issueTable('Missing contact information', missingContact, ['Name', 'Type', 'Address'], function (o) { return [o.name, o.type, o.address]; }) + issueTable('Research-only records', researchOnly, ['Name', 'Type', 'Status'], function (o) { return [o.name, o.type, o.status]; }) + issueTable('Low confidence / verify', lowConfidence, ['Name', 'Type', 'Confidence'], function (o) { return [o.name, o.type, o.confidence]; }) + '</div>';
  }

  function shell(county, title, subtitle, body) {
    return '<article class="report-doc"><header class="report-cover"><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(county.name || 'Active county') + ' | CONVENE Reporting Center</p><p>Generated ' + escapeHtml(new Date().toLocaleString()) + '</p><span class="report-chip">' + escapeHtml(subtitle) + '</span></header>' + body + '<footer class="report-section"><p class="muted small">Generated from browser-stored CONVENE workspace data for the active county.</p></footer></article>';
  }

  function reportTitle(type, settings) {
    if (type === 'focus') return settings.focus || settings.service ? (settings.focus || settings.service) + ' Focus Area Report' : 'Focus Area Report';
    if (type === 'engagement') return 'Partner Engagement Report';
    if (type === 'network') return 'Relationship / Network Report';
    if (type === 'quality') return 'Data Quality Report';
    return 'County Ecosystem Snapshot';
  }

  function settingsFromControls() {
    return {
      type: valueOf('reportType') || 'ecosystem',
      service: valueOf('reportService'),
      focus: valueOf('reportFocus'),
      range: valueOf('reportRange') || 'all',
      start: valueOf('reportStart'),
      end: valueOf('reportEnd'),
      charts: checked('reportCharts'),
      orgList: checked('reportOrgList'),
      activities: checked('reportActivities'),
      relationships: checked('reportRelationships'),
      quality: checked('reportQuality')
    };
  }

  function workspace() {
    var county = activeCounty();
    var raw = window.ConveneStorage && ConveneStorage.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {};
    if (!raw || !raw.organizations) raw = fallbackWorkspace(county);
    return {
      organizations: arr(raw.organizations).map(normalizeOrg),
      contacts: arr(raw.contacts),
      activities: arr(raw.activities).map(normalizeActivity),
      relationships: arr(raw.relationships).map(normalizeRelationship)
    };
  }

  function fallbackWorkspace(county) {
    return {
      organizations: readJson((county.storagePrefix || ('convene:' + county.id)) + ':organizations'),
      contacts: readJson((county.storagePrefix || ('convene:' + county.id)) + ':contacts'),
      activities: readJson((county.storagePrefix || ('convene:' + county.id)) + ':activities'),
      relationships: readJson((county.storagePrefix || ('convene:' + county.id)) + ':relationships')
    };
  }

  function activeCounty() {
    var id = valueOf('countySelect') || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[id] ? window.CONVENE_COUNTIES[id] : { id: id, name: id, storagePrefix: 'convene:' + id };
  }

  function normalizeOrg(o) {
    o = o || {};
    return Object.assign({}, o, {
      id: o.id || o.orgId || o.organizationId || '',
      name: o.name || o.organization || o.organizationName || '',
      type: o.type || o.category || o.serviceType || '',
      status: o.status || '',
      reach: o.reach || o.geographicReach || '',
      confidence: o.confidence || o.reachConfidence || '',
      focus: Array.isArray(o.focus || o.tags || o.focusTags) ? (o.focus || o.tags || o.focusTags).join(', ') : String(o.focus || o.tags || o.focusTags || ''),
      address: o.address || '',
      phone: o.phone || '',
      email: o.email || '',
      website: o.website || '',
      lat: cleanNumber(o.lat || o.latitude),
      lng: cleanNumber(o.lng || o.longitude)
    });
  }

  function normalizeActivity(a) { a = a || {}; return Object.assign({}, a, { organizationIds: toArray(a.organizationIds || a.orgIds || a.organizations), contactIds: toArray(a.contactIds || a.contacts) }); }
  function normalizeRelationship(r) { r = r || {}; return Object.assign({}, r, { fromOrgId: r.fromOrgId || r.sourceOrgId || '', toOrgId: r.toOrgId || r.targetOrgId || '' }); }

  function filterOrganizations(orgs, s) {
    return orgs.filter(function (o) {
      var serviceOk = !s.service || o.type === s.service;
      var focusOk = !s.focus || tagsOf(o).some(function (t) { return key(t) === key(s.focus); });
      return serviceOk && focusOk;
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }

  function filterActivities(activities, orgs, s) {
    var ids = {};
    orgs.forEach(function (o) { if (o.id) ids[o.id] = true; });
    var win = dateWindow(s);
    return activities.filter(function (a) {
      var d = a.date ? new Date(a.date + 'T00:00:00') : null;
      var dateOk = (!win.start || (d && d >= win.start)) && (!win.end || (d && d <= win.end));
      var scopeOk = !Object.keys(ids).length || toArray(a.organizationIds).some(function (id) { return ids[id]; });
      return dateOk && scopeOk;
    }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  }

  function filterRelationships(relationships, orgs) {
    var ids = {};
    orgs.forEach(function (o) { if (o.id) ids[o.id] = true; });
    return relationships.filter(function (r) { return ids[r.fromOrgId] || ids[r.toOrgId]; });
  }

  function dateWindow(s) {
    if (s.range === 'all') return {};
    if (s.range === 'custom') return { start: s.start ? new Date(s.start + 'T00:00:00') : null, end: s.end ? new Date(s.end + 'T23:59:59') : null };
    var end = new Date();
    var start = new Date();
    start.setDate(start.getDate() - Number(s.range || 0));
    start.setHours(0, 0, 0, 0);
    return { start: start, end: end };
  }

  function metricSection(items) { return '<section class="report-section"><div class="metric-grid">' + items.map(function (item) { return '<div class="report-metric"><span>' + escapeHtml(item[0]) + '</span><b>' + escapeHtml(String(item[1] == null ? 0 : item[1])) + '</b></div>'; }).join('') + '</div></section>'; }
  function section(title, body) { return '<section class="report-section"><h2>' + escapeHtml(title) + '</h2>' + body + '</section>'; }
  function charts(orgs) { return section('Charts and visuals', '<div class="chart-grid">' + barChart('By service type', countBy(orgs, function (o) { return o.type || 'No type'; }), 10) + barChart('By focus tag', countTags(orgs), 10) + barChart('By reach', countBy(orgs, function (o) { return o.reach || 'No reach'; }), 10) + barChart('By confidence', countBy(orgs, function (o) { return o.confidence || 'No confidence'; }), 10) + '</div>'); }
  function barChart(title, entries, limit) { var rows = (entries || []).slice(0, limit || 10); var max = Math.max.apply(null, [1].concat(rows.map(function (r) { return Number(r[1]) || 0; }))); return '<div class="chart-box"><h3>' + escapeHtml(title) + '</h3>' + (rows.length ? rows.map(function (r) { var pct = Math.max(3, Math.round((Number(r[1]) || 0) / max * 100)); return '<div class="bar-row"><span title="' + escapeAttr(r[0]) + '">' + escapeHtml(shorten(r[0], 28)) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><b>' + escapeHtml(String(r[1])) + '</b></div>'; }).join('') : '<p class="muted">No records.</p>') + '</div>'; }
  function table(headers, rows) { return '<div class="report-table-wrap"><table class="report-table"><thead><tr>' + headers.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(cell == null ? '' : String(cell)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  function orgTable(orgs, title) { return section(title || 'Organization list', orgs.length ? table(['Name', 'Type', 'Focus', 'Status', 'Reach', 'Confidence', 'Address'], orgs.slice(0, 80).map(function (o) { return [o.name, o.type, tagsOf(o).join(', '), o.status, o.reach, o.confidence, o.address]; })) + (orgs.length > 80 ? '<p class="muted small">Showing first 80 of ' + orgs.length + '.</p>' : '') : '<p class="muted">No organizations found.</p>'); }
  function activitySection(activities, orgs, title) { return section(title || 'Recent activity', activities.length ? table(['Date', 'Type', 'Summary', 'Organizations', 'Follow-up'], activities.slice(0, 40).map(function (a) { return [formatDate(a.date), a.type, a.summary || a.notes || '', toArray(a.organizationIds).map(function (id) { return orgName(id, orgs); }).join(', '), followUp(a)]; })) : '<p class="muted">No activities found.</p>'); }
  function relationshipSection(relationships, orgs) { return section('Relationship summary', relationships.length ? table(['Organization A', 'Organization B', 'Status', 'Strength', 'Summary'], relationships.slice(0, 60).map(function (r) { return [orgName(r.fromOrgId, orgs), orgName(r.toOrgId, orgs), r.status, r.strength, r.summary || r.notes || '']; })) : '<p class="muted">No relationships found.</p>'); }
  function qualityNotes(orgs) { return section('Data quality notes', '<div class="report-callout"><p>' + orgs.filter(function (o) { return !hasCoords(o); }).length + ' records are missing coordinates. ' + orgs.filter(isResearchOnly).length + ' are research-only. ' + orgs.filter(isLowConfidence).length + ' are low confidence or need verification.</p></div>'); }
  function issueTable(title, items, headers, mapper) { return section(title, items.length ? table(headers, items.slice(0, 30).map(mapper)) : '<p class="muted">No issues found in this category.</p>'); }

  function exportHtml() {
    var county = activeCounty();
    var styles = document.getElementById('reportsV2Styles') ? document.getElementById('reportsV2Styles').textContent : '';
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>CONVENE Report</title><style>' + styles + '</style></head><body>' + state.lastHtml + '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'convene-' + (county.id || 'county') + '-report-' + new Date().toISOString().slice(0, 10) + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function degreeMap(orgs, relationships) { var ids = {}; var degrees = {}; orgs.forEach(function (o) { if (o.id) ids[o.id] = true; }); relationships.forEach(function (r) { if (ids[r.fromOrgId]) degrees[r.fromOrgId] = (degrees[r.fromOrgId] || 0) + 1; if (ids[r.toOrgId]) degrees[r.toOrgId] = (degrees[r.toOrgId] || 0) + 1; }); return degrees; }
  function countBy(items, getter) { var counts = {}; items.forEach(function (item) { var label = String(getter(item) || 'Blank').trim() || 'Blank'; counts[label] = (counts[label] || 0) + 1; }); return Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }); }
  function countTags(orgs) { var counts = {}; orgs.forEach(function (o) { tagsOf(o).forEach(function (tag) { counts[tag] = (counts[tag] || 0) + 1; }); }); return Object.keys(counts).map(function (k) { return [k, counts[k]]; }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }); }
  function tagsOf(o) { return String(o.focus || o.tags || '').split(',').map(clean).filter(Boolean); }
  function topList(entries, n) { return entries.slice(0, n).map(function (e) { return escapeHtml(e[0]) + ' (' + e[1] + ')'; }).join(', ') || 'not yet established'; }
  function hasCoords(o) { return Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng)); }
  function isResearchOnly(o) { return /research/i.test(o.status || ''); }
  function isLowConfidence(o) { return /low|needs|not set/i.test(o.confidence || ''); }
  function orgName(id, orgs) { var found = arr(orgs).find(function (o) { return o.id === id; }); return found ? found.name : 'Unknown organization'; }
  function followUp(a) { return a.followUpDate ? formatDate(a.followUpDate) + (a.followUpCompleted ? ' (completed)' : ' (open)') : 'No follow-up'; }
  function formatDate(value) { if (!value) return ''; var date = new Date(value + 'T00:00:00'); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
  function scopeText(s) { var parts = []; if (s.service) parts.push(s.service); if (s.focus) parts.push(s.focus); if (s.range && s.range !== 'all') parts.push(s.range === 'custom' ? 'Custom date range' : 'Last ' + s.range + ' days'); return parts.join(' | ') || 'All records in active county workspace'; }
  function valueOf(id) { var el = document.getElementById(id); return el ? el.value || '' : ''; }
  function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function readJson(storageKey) { try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (err) { return []; } }
  function toArray(value) { return Array.isArray(value) ? value : String(value || '').split(/[;,]/).map(clean).filter(Boolean); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function cleanNumber(value) { var num = Number(String(value == null ? '' : value).trim().replace(/^--/, '-')); return Number.isFinite(num) ? String(num) : ''; }
  function key(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function shorten(value, n) { var s = String(value || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function closest(target, selector) { return target && target.closest ? target.closest(selector) : null; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#39;'); }
})();