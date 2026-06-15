(() => {
  if (window.__conveneReportsV2Loaded) return;
  window.__conveneReportsV2Loaded = true;

  const cache = { census: new Map(), lastHtml: '' };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReports);
  else initReports();

  function initReports() {
    installReportsTab();
    installReportStyles();
    bindReportEvents();
    setTimeout(populateFilters, 250);
    document.getElementById('countySelect')?.addEventListener('change', () => setTimeout(populateFilters, 250));
  }

  function installReportsTab() {
    if (!document.querySelector('.nav-btn[data-view="reportsView"]')) {
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.view = 'reportsView';
      btn.textContent = 'Reports';
      const backup = document.querySelector('.nav-btn[data-view="backupView"]');
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && backup) sidebar.insertBefore(btn, backup);
      else sidebar?.appendChild(btn);
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'reportsView'));
        setTimeout(populateFilters, 100);
      });
    }

    if (!document.getElementById('reportsView')) {
      const section = document.createElement('section');
      section.id = 'reportsView';
      section.className = 'view';
      section.innerHTML = `
        <div class="section-header report-controls">
          <div><h2>Reports</h2><p>Generate printable reports from the active county workspace.</p></div>
          <div class="small-actions"><button id="reportPrintBtn">Print Report</button><button id="reportExportBtn">Export HTML</button></div>
        </div>
        <div class="card report-controls report-builder">
          <div class="report-builder-grid">
            <label>Report type<select id="reportType">
              <option value="ecosystem">County Ecosystem Snapshot</option>
              <option value="focus">Focus Area Report</option>
              <option value="gap">Geographic Access / Gap Report</option>
              <option value="engagement">Partner Engagement Report</option>
              <option value="network">Relationship / Network Report</option>
              <option value="quality">Data Quality Report</option>
            </select></label>
            <label>Service type<select id="reportService"><option value="">All service types</option></select></label>
            <label>Focus tag<select id="reportFocus"><option value="">All focus tags</option></select></label>
            <label>Date range<select id="reportRange"><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option><option value="custom">Custom</option></select></label>
            <label>Start date<input id="reportStart" type="date"></label>
            <label>End date<input id="reportEnd" type="date"></label>
          </div>
          <div class="report-options">
            <label class="checkline"><input id="reportCharts" type="checkbox" checked> Charts</label>
            <label class="checkline"><input id="reportOrgList" type="checkbox" checked> Organization list</label>
            <label class="checkline"><input id="reportActivities" type="checkbox" checked> Recent activity</label>
            <label class="checkline"><input id="reportRelationships" type="checkbox" checked> Relationships</label>
            <label class="checkline"><input id="reportQuality" type="checkbox" checked> Data quality notes</label>
          </div>
          <div class="report-actions"><button id="generateReportBtn" class="primary">Generate Report</button><button id="resetReportBtn">Reset Filters</button></div>
        </div>
        <div id="reportOutput" class="report-output"><div class="card report-empty"><h3>No report generated yet</h3><p>Choose a report type and click Generate Report.</p></div></div>`;
      const main = document.querySelector('main');
      const backupView = document.getElementById('backupView');
      if (main && backupView) main.insertBefore(section, backupView);
      else main?.appendChild(section);
    }
  }

  function installReportStyles() {
    if (document.getElementById('reportsV2Styles')) return;
    const s = document.createElement('style');
    s.id = 'reportsV2Styles';
    s.textContent = `
      .report-builder { display: grid; gap: 14px; }
      .report-builder-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
      .report-builder label { display: grid; gap: 5px; font-weight: 700; }
      .report-builder input, .report-builder select { font-weight: 400; }
      .report-options, .report-actions { display: flex; flex-wrap: wrap; gap: 10px 18px; }
      .report-options { border-top: 1px solid var(--line); padding-top: 12px; }
      .report-output { margin-top: 16px; }
      .report-doc { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 10px 28px rgba(40,39,40,.08); }
      .report-cover { border-bottom: 5px solid var(--brand); padding-bottom: 16px; margin-bottom: 18px; }
      .report-cover h1 { margin: 0; font-size: 1.8rem; }
      .report-cover p { margin: 4px 0 0; color: var(--muted); }
      .report-chip { display: inline-block; margin-top: 8px; padding: 4px 9px; border-radius: 999px; background: #f3f4f6; font-weight: 800; font-size: .78rem; }
      .report-section { margin: 20px 0; break-inside: avoid; }
      .report-section h2 { font-size: 1.22rem; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 0 0 10px; }
      .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; }
      .report-metric { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fafafa; }
      .report-metric span { display: block; color: var(--muted); font-size: .82rem; }
      .report-metric b { display: block; font-size: 1.48rem; margin-top: 3px; color: var(--brand-dark); }
      .chart-grid, .report-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; }
      .chart-box { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; }
      .bar-row { display: grid; grid-template-columns: minmax(110px, 1.2fr) 2fr 42px; gap: 8px; align-items: center; margin: 7px 0; font-size: .9rem; }
      .bar-track { height: 12px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
      .bar-fill { height: 100%; background: var(--brand); border-radius: 999px; min-width: 3px; }
      .report-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
      .report-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
      .report-table th, .report-table td { border-bottom: 1px solid var(--line); padding: 8px 9px; text-align: left; vertical-align: top; }
      .report-table th { background: #f8fafc; }
      .report-callout { border-left: 5px solid var(--brand); background: #fff7f7; padding: 12px 14px; border-radius: 12px; }
      .report-empty { text-align: center; padding: 36px; }
      @media print {
        .topbar, .sidebar, .report-controls, .back-button, dialog { display: none !important; }
        body { background: #fff !important; }
        .layout { display: block !important; }
        main { padding: 0 !important; }
        .view { display: none !important; }
        #reportsView { display: block !important; }
        .report-doc { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        .report-section { page-break-inside: avoid; break-inside: avoid; }
        .bar-fill { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `;
    document.head.appendChild(s);
  }

  function bindReportEvents() {
    document.body.addEventListener('click', e => {
      if (e.target.closest('#generateReportBtn')) generateReport();
      if (e.target.closest('#resetReportBtn')) resetReport();
      if (e.target.closest('#reportPrintBtn')) printReport();
      if (e.target.closest('#reportExportBtn')) exportHtml();
    });
    document.body.addEventListener('change', e => {
      if (e.target.matches('#reportType, #reportRange')) updateControlState();
    });
  }

  function populateFilters() {
    const data = getWorkspace();
    setOptions($('#reportService'), unique(data.organizations.map(o => o.type)), 'All service types');
    setOptions($('#reportFocus'), unique(data.organizations.flatMap(tagsOf)), 'All focus tags');
    updateControlState();
  }

  function updateControlState() {
    const custom = val('reportRange') === 'custom';
    if ($('#reportStart')) $('#reportStart').disabled = !custom;
    if ($('#reportEnd')) $('#reportEnd').disabled = !custom;
  }

  async function generateReport() {
    populateFilters();
    const county = activeCounty();
    const data = getWorkspace();
    const settings = getSettings();
    const orgs = filterOrgs(data.organizations, settings);
    const activities = filterActivities(data.activities, orgs, settings);
    const relationships = filterRelationships(data.relationships, orgs);
    const census = settings.type === 'gap' ? await loadCensus(county) : null;

    const map = {
      ecosystem: () => ecosystemReport(county, data, orgs, activities, relationships, settings),
      focus: () => focusReport(county, data, orgs, activities, relationships, settings),
      gap: () => gapReport(county, data, orgs, activities, relationships, census, settings),
      engagement: () => engagementReport(county, data, orgs, activities, relationships, settings),
      network: () => networkReport(county, data, orgs, activities, relationships, settings),
      quality: () => qualityReport(county, data, orgs, activities, relationships, settings)
    };
    cache.lastHtml = (map[settings.type] || map.ecosystem)();
    $('#reportOutput').innerHTML = cache.lastHtml;
  }

  function ecosystemReport(county, data, orgs, activities, relationships, settings) {
    return shell(county, 'County Ecosystem Snapshot', scope(settings), `
      ${metrics([['Organizations', orgs.length], ['Mapped', orgs.filter(hasCoords).length], ['Contacts', data.contacts.length], ['Activities', activities.length], ['Relationships', relationships.length], ['Missing coords', orgs.filter(o => !hasCoords(o)).length]])}
      ${section('Summary interpretation', `<p>The active workspace contains ${orgs.length} organizations. ${percent(orgs.filter(hasCoords).length, orgs.length)}% are mapped. The largest categories are ${topList(countBy(orgs, o => o.type || 'No type'), 3)}.</p>`)}
      ${settings.charts ? charts(orgs) : ''}
      ${settings.relationships ? relationshipSection(relationships, data.organizations) : ''}
      ${settings.activities ? activitySection(activities, data.organizations) : ''}
      ${settings.quality ? qualityNotes(orgs) : ''}
      ${settings.orgList ? orgTable(orgs) : ''}`);
  }

  function focusReport(county, data, orgs, activities, relationships, settings) {
    const title = settings.focus || settings.service ? `${settings.focus || settings.service} Focus Area Report` : 'Focus Area Report';
    return shell(county, title, scope(settings), `
      ${metrics([['Relevant orgs', orgs.length], ['Mapped orgs', orgs.filter(hasCoords).length], ['Activities', activities.length], ['Relationships', relationships.length], ['Research-only', orgs.filter(isResearchOnly).length], ['Low confidence', orgs.filter(isLowConfidence).length]])}
      ${section('Focus area readout', `<p>This report narrows the county workspace to ${escapeHtml(settings.focus || settings.service || 'the selected focus area')}. It includes ${orgs.length} organizations, ${activities.length} activities, and ${relationships.length} relationships.</p>`)}
      ${settings.charts ? charts(orgs) : ''}
      ${settings.relationships ? relationshipSection(relationships, data.organizations) : ''}
      ${settings.activities ? activitySection(activities, data.organizations) : ''}
      ${settings.quality ? qualityNotes(orgs) : ''}
      ${settings.orgList ? orgTable(orgs) : ''}`);
  }

  function gapReport(county, data, orgs, activities, relationships, census, settings) {
    const tracts = priorityTracts(census, orgs).slice(0, 12);
    return shell(county, 'Geographic Access / Gap Report', scope(settings), `
      ${metrics([['Relevant orgs', orgs.length], ['Mapped assets', orgs.filter(hasCoords).length], ['Census tracts', allTracts(census).length], ['Priority tracts shown', tracts.length], ['No nearby assets', tracts.filter(t => t.assets === 0).length], ['Activities', activities.length]])}
      ${section('Geographic access readout', `<p>This report compares tract-level need signals with mapped assets in the selected service/focus scope. Tracts with high need and few nearby mapped assets should be treated as planning signals for follow-up, not proof that no services exist.</p>`)}
      ${section('Priority tract table', tractTable(tracts))}
      ${settings.charts ? section('Gap visuals', `<div class="chart-grid">${barChart('Priority tracts', tracts.map(t => [t.name, t.priority]), 12)}${barChart('Assets within 10 miles', tracts.map(t => [t.name, t.assets]), 12)}</div>`) : ''}
      ${settings.orgList ? orgTable(orgs.filter(hasCoords), 'Mapped organizations used as assets') : ''}
      ${settings.activities ? activitySection(activities, data.organizations) : ''}`);
  }

  function engagementReport(county, data, orgs, activities, relationships, settings) {
    return shell(county, 'Partner Engagement Report', scope(settings), `
      ${metrics([['Organizations in scope', orgs.length], ['Activities', activities.length], ['Open follow-ups', activities.filter(a => a.followUpDate && !a.followUpCompleted).length], ['Completed follow-ups', activities.filter(a => a.followUpDate && a.followUpCompleted).length], ['Contacts', data.contacts.length], ['Relationships', relationships.length]])}
      ${section('Engagement readout', `<p>This report summarizes outreach and follow-up activity for the selected county scope. Use it for supervisor updates, work planning, and checking whether relationship-building is happening across the ecosystem or clustering around the same partners.</p>`)}
      ${settings.charts ? section('Engagement visuals', `<div class="chart-grid">${barChart('Organization status', countBy(orgs, o => o.status || 'No status'))}${barChart('Activity type', countBy(activities, a => a.type || 'Activity'))}</div>`) : ''}
      ${activitySection(activities, data.organizations, 'Activity log')}
      ${orgTable(orgs, 'Organizations in engagement scope')}`);
  }

  function networkReport(county, data, orgs, activities, relationships, settings) {
    const degrees = degreeMap(orgs, relationships);
    const isolated = orgs.filter(o => !degrees.get(o.id));
    const hubs = [...degrees.entries()].sort((a,b) => b[1] - a[1]).slice(0, 12).map(([id, degree]) => [orgName(id, data.organizations), degree]);
    return shell(county, 'Relationship / Network Report', scope(settings), `
      ${metrics([['Organizations', orgs.length], ['Relationships', relationships.length], ['Connected orgs', orgs.length - isolated.length], ['Isolated orgs', isolated.length], ['Potential ties', relationships.filter(r => /potential/i.test(r.status || '')).length], ['Strong ties', relationships.filter(r => /strong/i.test(r.strength || '')).length]])}
      ${section('Network readout', `<p>The relationship map shows ${relationships.length} recorded connections among the organizations in scope. ${isolated.length} organizations have no mapped relationship yet. That may indicate a true network gap, or simply a data-entry gap.</p>`)}
      ${section('Network hubs', hubs.length ? table(['Organization', 'Mapped relationships'], hubs) : '<p class="muted">No hubs found yet.</p>')}
      ${relationshipSection(relationships, data.organizations)}
      ${orgTable(isolated, 'Organizations without mapped relationships')}`);
  }

  function qualityReport(county, data, orgs, activities, relationships, settings) {
    const missingCoords = orgs.filter(o => !hasCoords(o));
    const missingContact = orgs.filter(o => !String(o.phone || o.email || o.website || '').trim());
    const researchOnly = orgs.filter(isResearchOnly);
    const lowConf = orgs.filter(isLowConfidence);
    const dupes = duplicates(orgs);
    return shell(county, 'Data Quality Report', scope(settings), `
      ${metrics([['Records reviewed', orgs.length], ['Missing coordinates', missingCoords.length], ['Missing phone/email/web', missingContact.length], ['Research-only', researchOnly.length], ['Low confidence', lowConf.length], ['Possible duplicates', dupes.length]])}
      ${section('Data quality readout', `<p>This report identifies cleanup items that affect mapping, reporting, and credibility. The most important fixes are missing coordinates, low-confidence records, and research-only records that should be verified before public presentation.</p>`)}
      <div class="report-two">${issueTable('Missing coordinates', missingCoords, ['Name','Type','Address'], o => [o.name, o.type, o.address])}${issueTable('Low confidence / verify', lowConf, ['Name','Type','Confidence'], o => [o.name, o.type, o.confidence])}${issueTable('Research-only records', researchOnly, ['Name','Type','Status'], o => [o.name, o.type, o.status])}${issueTable('Possible duplicates', dupes, ['Possible match','Reason'], d => [d.names, d.reason])}</div>`);
  }

  function shell(county, title, subtitle, body) {
    return `<article class="report-doc"><header class="report-cover"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(county.name || 'Active county')} | CONVENE Reporting Center</p><p>Generated ${escapeHtml(new Date().toLocaleString())}</p><span class="report-chip">${escapeHtml(subtitle)}</span></header>${body}<footer class="report-section"><p class="muted small">Generated from browser-stored CONVENE workspace data. Census sections depend on the current county census file.</p></footer></article>`;
  }

  function section(title, body) { return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`; }
  function metrics(items) { return section('', `<div class="metric-grid">${items.map(([l,v]) => `<div class="report-metric"><span>${escapeHtml(l)}</span><b>${escapeHtml(String(v ?? 0))}</b></div>`).join('')}</div>`).replace('<h2></h2>', ''); }
  function charts(orgs) { return section('Charts and visuals', `<div class="chart-grid">${barChart('By service type', countBy(orgs, o => o.type || 'No type'))}${barChart('By focus tag', countTags(orgs))}${barChart('By reach', countBy(orgs, o => o.reach || 'No reach'))}${barChart('By confidence', countBy(orgs, o => o.confidence || 'No confidence'))}</div>`); }

  function barChart(title, entries, limit = 10) {
    const rows = (entries || []).slice(0, limit);
    const max = Math.max(1, ...rows.map(r => Number(r[1]) || 0));
    return `<div class="chart-box"><h3>${escapeHtml(title)}</h3>${rows.length ? rows.map(([label, count]) => `<div class="bar-row"><span title="${escapeAttr(label)}">${escapeHtml(shorten(label, 28))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, Math.round((Number(count) || 0) / max * 100))}%"></div></div><b>${count}</b></div>`).join('') : '<p class="muted">No records.</p>'}</div>`;
  }

  function table(headers, rows) { return `<div class="report-table-wrap"><table class="report-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function orgTable(orgs, title = 'Organization list') { return section(title, orgs.length ? table(['Name','Type','Focus','Status','Reach','Confidence','Address'], orgs.slice(0,80).map(o => [o.name,o.type,tagsOf(o).join(', '),o.status,o.reach,o.confidence,o.address])) + (orgs.length > 80 ? `<p class="muted small">Showing first 80 of ${orgs.length}.</p>` : '') : '<p class="muted">No organizations found.</p>'); }
  function activitySection(activities, orgs, title = 'Recent activity') { return section(title, activities.length ? table(['Date','Type','Summary','Organizations','Follow-up'], activities.slice(0,30).map(a => [fmtDate(a.date), a.type, a.summary, toArray(a.organizationIds).map(id => orgName(id, orgs)).join(', '), followUp(a)])) : '<p class="muted">No activities found.</p>'); }
  function relationshipSection(rels, orgs) { return section('Relationship summary', rels.length ? table(['Organization A','Organization B','Status','Strength','Summary'], rels.slice(0,40).map(r => [orgName(r.fromOrgId, orgs), orgName(r.toOrgId, orgs), r.status, r.strength, r.summary || r.notes])) : '<p class="muted">No relationships found.</p>'); }
  function qualityNotes(orgs) { return section('Data quality notes', `<div class="report-callout"><p>${orgs.filter(o => !hasCoords(o)).length} records are missing coordinates. ${orgs.filter(isResearchOnly).length} are research-only. ${orgs.filter(isLowConfidence).length} are low confidence or need verification.</p></div>`); }
  function issueTable(title, items, headers, mapper) { return section(title, items.length ? table(headers, items.slice(0,30).map(mapper)) : '<p class="muted">No issues found in this category.</p>'); }

  function getSettings() { return { type: val('reportType') || 'ecosystem', service: val('reportService'), focus: val('reportFocus'), range: val('reportRange') || 'all', start: val('reportStart'), end: val('reportEnd'), charts: checked('reportCharts'), orgList: checked('reportOrgList'), activities: checked('reportActivities'), relationships: checked('reportRelationships'), quality: checked('reportQuality') }; }
  function activeCounty() { const id = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl'; return window.CONVENE_COUNTIES?.[id] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY] || { id, name: id, storagePrefix: `convene:${id}` }; }
  function getWorkspace() { const county = activeCounty(); const raw = window.ConveneStorage?.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {}; return { organizations: (raw.organizations || []).map(normOrg), contacts: raw.contacts || [], activities: (raw.activities || []).map(normActivity), relationships: (raw.relationships || []).map(normRel) }; }
  function normOrg(o = {}) { return { ...o, id: o.id || '', name: o.name || o.organization || '', type: o.type || '', status: o.status || '', reach: o.reach || o.geographicReach || '', confidence: o.confidence || o.reachConfidence || '', focus: o.focus || o.tags || '', lat: clean(o.lat ?? o.latitude), lng: clean(o.lng ?? o.longitude) }; }
  function normActivity(a = {}) { return { ...a, organizationIds: toArray(a.organizationIds || a.orgIds || a.organizations), contactIds: toArray(a.contactIds || a.contacts) }; }
  function normRel(r = {}) { return { ...r, fromOrgId: r.fromOrgId || r.sourceOrgId || '', toOrgId: r.toOrgId || r.targetOrgId || '' }; }
  function clean(v) { const n = Number(String(v ?? '').trim().replace(/^--/, '-')); return Number.isFinite(n) ? String(n) : ''; }

  function filterOrgs(orgs, s) { return orgs.filter(o => (!s.service || o.type === s.service) && (!s.focus || tagsOf(o).some(t => key(t) === key(s.focus)))).sort((a,b) => String(a.name).localeCompare(String(b.name))); }
  function filterActivities(activities, orgs, s) { const ids = new Set(orgs.map(o => o.id)); const win = dateWindow(s); return activities.filter(a => { const d = a.date ? new Date(`${a.date}T00:00:00`) : null; const inDate = (!win.start || (d && d >= win.start)) && (!win.end || (d && d <= win.end)); const inScope = !ids.size || toArray(a.organizationIds).some(id => ids.has(id)); return inDate && inScope; }).sort((a,b) => String(b.date || '').localeCompare(String(a.date || ''))); }
  function filterRelationships(rels, orgs) { const ids = new Set(orgs.map(o => o.id)); return rels.filter(r => ids.has(r.fromOrgId) || ids.has(r.toOrgId)); }
  function dateWindow(s) { if (s.range === 'all') return {}; if (s.range === 'custom') return { start: s.start ? new Date(`${s.start}T00:00:00`) : null, end: s.end ? new Date(`${s.end}T23:59:59`) : null }; const end = new Date(); const start = new Date(); start.setDate(start.getDate() - Number(s.range || 0)); start.setHours(0,0,0,0); return { start, end }; }

  async function loadCensus(county) { if (!county?.censusFile) return null; if (cache.census.has(county.id)) return cache.census.get(county.id); try { const r = await fetch(county.censusFile, { cache: 'no-store' }); const j = await r.json(); cache.census.set(county.id, j); return j; } catch { return null; } }
  function allTracts(census) { const features = census?.geojson?.features || census?.features || []; return features.map(f => { const p = f.properties || {}; return { name: p.name || p.NAME || p.tract || p.GEOID || 'Tract', population: Number(p.population ?? p.totalPopulation ?? p.B01001_001E ?? 0), need: Number(p.needScore ?? p.relativeNeedScore ?? p.priorityScore ?? p.compositeScore ?? 0), center: centerOf(f.geometry) }; }); }
  function priorityTracts(census, orgs) { const mapped = orgs.filter(hasCoords); return allTracts(census).map(t => { const ds = mapped.map(o => miles(t.center[0], t.center[1], Number(o.lat), Number(o.lng))).filter(Number.isFinite).sort((a,b) => a-b); const assets = ds.filter(d => d <= 10).length; const priority = Math.max(0, Math.min(100, Math.round(t.need + (assets === 0 ? 25 : assets <= 2 ? 12 : 0)))); return { ...t, assets, closest: ds[0], priority }; }).sort((a,b) => b.priority - a.priority || a.assets - b.assets); }
  function tractTable(tracts) { return tracts.length ? table(['Tract','Population','Need score','Priority','Assets within 10 mi','Closest asset'], tracts.map(t => [t.name, t.population || 'n/a', t.need || 'n/a', t.priority, t.assets, t.closest == null ? 'None mapped' : `${t.closest.toFixed(1)} mi`])) : '<p class="muted">No census tract data available.</p>'; }
  function centerOf(g = {}) { const pts = []; rings(g).forEach(r => r.forEach(c => { if (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) pts.push(c); })); if (!pts.length) return [NaN, NaN]; return [pts.reduce((s,c) => s + Number(c[1]), 0) / pts.length, pts.reduce((s,c) => s + Number(c[0]), 0) / pts.length]; }
  function rings(g = {}) { if (g.type === 'Polygon') return g.coordinates || []; if (g.type === 'MultiPolygon') return (g.coordinates || []).flat(); return []; }
  function miles(a,b,c,d) { if (![a,b,c,d].every(Number.isFinite)) return NaN; const R=3958.8, x=rad(c-a), y=rad(d-b); const z=Math.sin(x/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2; return R*2*Math.atan2(Math.sqrt(z), Math.sqrt(1-z)); }
  function rad(d) { return d * Math.PI / 180; }

  function degreeMap(orgs, rels) { const ids = new Set(orgs.map(o => o.id)); const m = new Map(); rels.forEach(r => { if (ids.has(r.fromOrgId)) m.set(r.fromOrgId, (m.get(r.fromOrgId)||0)+1); if (ids.has(r.toOrgId)) m.set(r.toOrgId, (m.get(r.toOrgId)||0)+1); }); return m; }
  function duplicates(orgs) { const m = new Map(); orgs.forEach(o => { const k = key(o.name); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }); return [...m.values()].filter(g => g.length > 1).map(g => ({ names: g.map(o => o.name).join(' | '), reason: 'Same normalized name' })); }
  function countBy(items, get) { const m = new Map(); items.forEach(i => { const k = String(get(i) || 'Blank').trim() || 'Blank'; m.set(k, (m.get(k)||0)+1); }); return [...m.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])); }
  function countTags(orgs) { const m = new Map(); orgs.forEach(o => tagsOf(o).forEach(t => m.set(t, (m.get(t)||0)+1))); return [...m.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])); }
  function tagsOf(o) { return String(o.focus || o.tags || '').split(',').map(t => t.trim()).filter(Boolean); }
  function topList(entries, n) { return entries.slice(0,n).map(([k,v]) => `${escapeHtml(k)} (${v})`).join(', ') || 'not yet established'; }
  function hasCoords(o) { return Number.isFinite(Number(o?.lat)) && Number.isFinite(Number(o?.lng)); }
  function isResearchOnly(o) { return /research/i.test(o.status || ''); }
  function isLowConfidence(o) { return /low|needs/i.test(o.confidence || ''); }
  function orgName(id, orgs) { return (orgs || []).find(o => o.id === id)?.name || 'Unknown organization'; }
  function followUp(a) { return a.followUpDate ? `${fmtDate(a.followUpDate)} ${a.followUpCompleted ? '(completed)' : '(open)'}` : 'No follow-up'; }
  function fmtDate(v) { if (!v) return ''; const d = new Date(`${v}T00:00:00`); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(); }
  function scope(s) { return [s.service, s.focus, s.range !== 'all' ? (s.range === 'custom' ? 'Custom date range' : `Last ${s.range} days`) : ''].filter(Boolean).join(' | ') || 'All records in active county workspace'; }
  function percent(part, total) { return total ? Math.round(part / total * 100) : 0; }
  function val(id) { return document.getElementById(id)?.value || ''; }
  function checked(id) { return Boolean(document.getElementById(id)?.checked); }
  function toArray(v) { return Array.isArray(v) ? v : String(v || '').split(/[;,]/).map(x => x.trim()).filter(Boolean); }
  function unique(v) { return [...new Set((v || []).map(x => String(x || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b)); }
  function setOptions(sel, vals, blank) { if (!sel) return; const current = sel.value; sel.innerHTML = `<option value="">${escapeHtml(blank)}</option>` + vals.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join(''); sel.value = vals.includes(current) ? current : ''; }
  function key(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function shorten(v, n) { const s = String(v || ''); return s.length > n ? `${s.slice(0,n-1)}…` : s; }
  function escapeHtml(v) { return String(v ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function escapeAttr(v) { return escapeHtml(v).replace(/'/g, '&#39;'); }
  function $(id) { return document.getElementById(id); }

  function resetReport() { ['reportService','reportFocus','reportStart','reportEnd'].forEach(id => { if ($(id)) $(id).value = ''; }); if ($('#reportRange')) $('#reportRange').value = 'all'; ['reportCharts','reportOrgList','reportActivities','reportRelationships','reportQuality'].forEach(id => { if ($(id)) $(id).checked = true; }); updateControlState(); }
  function printReport() { if (!cache.lastHtml) generateReport().then(() => window.print()); else window.print(); }
  function exportHtml() { if (!cache.lastHtml) { alert('Generate a report before exporting.'); return; } const county = activeCounty(); const html = `<!doctype html><html><head><meta charset="utf-8"><title>CONVENE Report</title><style>${document.getElementById('reportsV2Styles')?.textContent || ''}</style></head><body>${cache.lastHtml}</body></html>`; const blob = new Blob([html], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `convene-${county.id}-report-${new Date().toISOString().slice(0,10)}.html`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
})();