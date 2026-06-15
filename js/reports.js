(() => {
  if (window.__conveneReportsLoaded) return;
  window.__conveneReportsLoaded = true;

  const state = {
    censusCache: new Map(),
    lastReportHtml: ''
  };

  document.addEventListener('DOMContentLoaded', () => {
    installReportsTab();
    installReportStyles();
    bindReportEvents();
    setTimeout(populateReportFilters, 400);
    document.getElementById('countySelect')?.addEventListener('change', () => setTimeout(populateReportFilters, 300));
  });

  function installReportsTab() {
    if (!document.getElementById('reportsView')) {
      const section = document.createElement('section');
      section.id = 'reportsView';
      section.className = 'view';
      section.innerHTML = `
        <div class="section-header reports-screen-only">
          <div>
            <h2>Reports</h2>
            <p>Build printable county, focus-area, gap, engagement, network, and data-quality reports from the active workspace.</p>
          </div>
          <div class="small-actions">
            <button id="reportPrintBtn">Print Report</button>
            <button id="reportExportHtmlBtn">Export HTML</button>
          </div>
        </div>

        <div class="card report-builder reports-screen-only">
          <div class="report-builder-grid">
            <label>Report type
              <select id="reportType">
                <option value="ecosystem">County Ecosystem Snapshot</option>
                <option value="focus">Focus Area Report</option>
                <option value="gap">Geographic Access / Gap Report</option>
                <option value="engagement">Partner Engagement Report</option>
                <option value="network">Relationship / Network Report</option>
                <option value="quality">Data Quality Report</option>
              </select>
            </label>
            <label>Service type
              <select id="reportServiceType"><option value="">All service types</option></select>
            </label>
            <label>Focus tag
              <select id="reportFocusTag"><option value="">All focus tags</option></select>
            </label>
            <label>Date range
              <select id="reportDateRange">
                <option value="all">All time</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>Start date<input id="reportStartDate" type="date" /></label>
            <label>End date<input id="reportEndDate" type="date" /></label>
          </div>

          <div class="report-options">
            <label class="checkline"><input id="includeCharts" type="checkbox" checked /> Charts and visuals</label>
            <label class="checkline"><input id="includeOrgList" type="checkbox" checked /> Organization list</label>
            <label class="checkline"><input id="includeActivities" type="checkbox" checked /> Recent activity</label>
            <label class="checkline"><input id="includeRelationships" type="checkbox" checked /> Relationship summary</label>
            <label class="checkline"><input id="includeDataQuality" type="checkbox" checked /> Data quality notes</label>
          </div>

          <div class="report-actions">
            <button id="generateReportBtn" class="primary">Generate Report</button>
            <button id="clearReportFiltersBtn">Reset Report Filters</button>
          </div>
        </div>

        <div id="reportOutput" class="report-output">
          <div class="card report-empty-state">
            <h3>No report generated yet</h3>
            <p>Select a report type and click <strong>Generate Report</strong>. The report will appear here and can be printed or saved as PDF from your browser.</p>
          </div>
        </div>`;

      const main = document.querySelector('main');
      const backup = document.getElementById('backupView');
      if (main && backup) main.insertBefore(section, backup);
      else main?.appendChild(section);
    }

    if (!document.querySelector('.nav-btn[data-view="reportsView"]')) {
      const button = document.createElement('button');
      button.className = 'nav-btn';
      button.dataset.view = 'reportsView';
      button.textContent = 'Reports';
      const sidebar = document.querySelector('.sidebar');
      const backupBtn = document.querySelector('.nav-btn[data-view="backupView"]');
      if (sidebar && backupBtn) sidebar.insertBefore(button, backupBtn);
      else sidebar?.appendChild(button);
      button.addEventListener('click', () => {
        showReportsView();
        setTimeout(populateReportFilters, 120);
      });
    }
  }

  function showReportsView() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'reportsView'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'reportsView'));
  }

  function installReportStyles() {
    if (document.getElementById('conveneReportStyles')) return;
    const style = document.createElement('style');
    style.id = 'conveneReportStyles';
    style.textContent = `
      .report-builder { display: grid; gap: 14px; }
      .report-builder-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
      .report-builder label { font-weight: 700; color: var(--text); display: grid; gap: 5px; }
      .report-builder input, .report-builder select { font-weight: 400; }
      .report-options { display: flex; flex-wrap: wrap; gap: 10px 18px; border-top: 1px solid var(--line); padding-top: 12px; }
      .report-actions { display: flex; gap: 10px; flex-wrap: wrap; }
      .report-output { margin-top: 16px; }
      .report-document { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px; box-shadow: 0 10px 28px rgba(40, 39, 40, .08); }
      .report-cover { border-bottom: 5px solid var(--brand); padding-bottom: 16px; margin-bottom: 18px; }
      .report-cover h1 { margin: 0; font-size: 1.8rem; }
      .report-cover p { margin: 5px 0 0; color: var(--muted); }
      .report-section { margin: 20px 0; break-inside: avoid; }
      .report-section h2 { font-size: 1.25rem; margin: 0 0 10px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
      .report-section h3 { font-size: 1rem; margin: 12px 0 6px; }
      .report-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; }
      .report-metric { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fafafa; }
      .report-metric span { display: block; color: var(--muted); font-size: .82rem; }
      .report-metric b { display: block; margin-top: 4px; font-size: 1.5rem; color: var(--brand-dark); }
      .report-chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
      .report-chart { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: #fff; }
      .bar-row { display: grid; grid-template-columns: minmax(110px, 1.2fr) 2fr 42px; gap: 8px; align-items: center; margin: 7px 0; font-size: .9rem; }
      .bar-track { height: 12px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
      .bar-fill { height: 100%; background: var(--brand); border-radius: 999px; min-width: 3px; }
      .report-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
      .report-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
      .report-table th, .report-table td { padding: 8px 9px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      .report-table th { background: #f8fafc; }
      .report-table tr:last-child td { border-bottom: 0; }
      .report-callout { border-left: 5px solid var(--brand); background: #fff7f7; padding: 12px 14px; border-radius: 12px; }
      .report-two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
      .report-empty-state { text-align: center; padding: 36px; }
      .report-tagline { display: inline-block; margin-top: 8px; padding: 4px 9px; border-radius: 999px; background: #f3f4f6; color: #374151; font-weight: 700; font-size: .78rem; }
      .quality-good { color: #166534; font-weight: 800; }
      .quality-warn { color: #92400e; font-weight: 800; }
      .quality-bad { color: #991b1b; font-weight: 800; }
      @media print {
        body { background: #fff !important; }
        .topbar, .sidebar, .reports-screen-only, .back-button, dialog { display: none !important; }
        .layout { display: block !important; }
        main { padding: 0 !important; }
        .view { display: none !important; }
        #reportsView { display: block !important; }
        #reportsView.view { display: block !important; }
        .report-output { margin: 0 !important; }
        .report-document { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        .report-section { break-inside: avoid; page-break-inside: avoid; }
        .report-table-wrap { overflow: visible !important; }
        .bar-fill { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `;
    document.head.appendChild(style);
  }

  function bindReportEvents() {
    document.body.addEventListener('click', event => {
      if (event.target.closest('#generateReportBtn')) generateReport();
      if (event.target.closest('#reportPrintBtn')) printReport();
      if (event.target.closest('#reportExportHtmlBtn')) exportReportHtml();
      if (event.target.closest('#clearReportFiltersBtn')) resetReportFilters();
    });
    document.body.addEventListener('change', event => {
      if (event.target.matches('#reportType, #reportServiceType, #reportFocusTag, #reportDateRange')) updateReportBuilderState();
    });
  }

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY] || { id: selected, name: selected, storagePrefix: `convene:${selected}` };
  }

  function workspace() {
    const county = activeCounty();
    const raw = window.ConveneStorage?.loadWorkspace ? ConveneStorage.loadWorkspace(county) : {};
    return {
      organizations: (raw.organizations || []).map(normalizeOrg),
      contacts: raw.contacts || [],
      activities: (raw.activities || []).map(normalizeActivity),
      relationships: (raw.relationships || []).map(normalizeRelationship)
    };
  }

  function populateReportFilters() {
    const data = workspace();
    setOptions(document.getElementById('reportServiceType'), unique(data.organizations.map(o => o.type)), 'All service types');
    setOptions(document.getElementById('reportFocusTag'), unique(data.organizations.flatMap(focusTags)), 'All focus tags');
    updateReportBuilderState();
  }

  function updateReportBuilderState() {
    const type = document.getElementById('reportType')?.value || 'ecosystem';
    const focus = document.getElementById('reportFocusTag');
    const service = document.getElementById('reportServiceType');
    const dateRange = document.getElementById('reportDateRange')?.value || 'all';
    const start = document.getElementById('reportStartDate');
    const end = document.getElementById('reportEndDate');

    if (focus) focus.disabled = type !== 'focus' && type !== 'gap' && type !== 'ecosystem';
    if (service) service.disabled = false;
    if (start) start.disabled = dateRange !== 'custom';
    if (end) end.disabled = dateRange !== 'custom';
  }

  async function generateReport() {
    const data = workspace();
    const county = activeCounty();
    const settings = reportSettings();
    const orgs = filteredReportOrgs(data.organizations, settings);
    const activities = filterActivities(data.activities, settings);
    const relationships = relevantRelationships(data.relationships, orgs);
    const census = settings.type === 'gap' ? await loadCensus(county) : null;

    let html = '';
    if (settings.type === 'ecosystem') html = ecosystemReport(county, data, orgs, activities, relationships, settings);
    if (settings.type === 'focus') html = focusReport(county, data, orgs, activities, relationships, settings);
    if (settings.type === 'gap') html = gapReport(county, data, orgs, activities, relationships, census, settings);
    if (settings.type === 'engagement') html = engagementReport(county, data, orgs, activities, relationships, settings);
    if (settings.type === 'network') html = networkReport(county, data, orgs, activities, relationships, settings);
    if (settings.type === 'quality') html = qualityReport(county, data, orgs, activities, relationships, settings);

    state.lastReportHtml = html;
    const output = document.getElementById('reportOutput');
    if (output) output.innerHTML = html;
  }

  function reportSettings() {
    return {
      type: valueOf('reportType') || 'ecosystem',
      serviceType: valueOf('reportServiceType'),
      focusTag: valueOf('reportFocusTag'),
      dateRange: valueOf('reportDateRange') || 'all',
      startDate: valueOf('reportStartDate'),
      endDate: valueOf('reportEndDate'),
      includeCharts: checked('includeCharts'),
      includeOrgList: checked('includeOrgList'),
      includeActivities: checked('includeActivities'),
      includeRelationships: checked('includeRelationships'),
      includeDataQuality: checked('includeDataQuality')
    };
  }

  function ecosystemReport(county, data, orgs, activities, relationships, settings) {
    return documentShell(county, 'County Ecosystem Snapshot', reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Organizations', orgs.length], ['Mapped', orgs.filter(hasCoordinates).length], ['Contacts', data.contacts.length], ['Activities', activities.length], ['Relationships', relationships.length], ['Missing coords', orgs.filter(o => !hasCoordinates(o)).length]
      ])}
      <section class="report-section"><h2>Summary interpretation</h2>${ecosystemInterpretation(orgs, activities, relationships)}</section>
      ${settings.includeCharts ? chartSection(orgs) : ''}
      ${settings.includeRelationships ? relationshipSection(relationships, data.organizations, orgs) : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}
      ${settings.includeDataQuality ? qualityNotesSection(orgs) : ''}
      ${settings.includeOrgList ? orgTableSection(orgs) : ''}`);
  }

  function focusReport(county, data, orgs, activities, relationships, settings) {
    const title = settings.focusTag ? `${settings.focusTag} Focus Area Report` : settings.serviceType ? `${settings.serviceType} Focus Area Report` : 'Focus Area Report';
    return documentShell(county, title, reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Relevant orgs', orgs.length], ['Mapped orgs', orgs.filter(hasCoordinates).length], ['Recent activities', activities.length], ['Relationships', relationships.length], ['Research-only', orgs.filter(isResearchOnly).length], ['Low confidence', orgs.filter(isLowConfidence).length]
      ])}
      <section class="report-section"><h2>Focus area readout</h2>${focusInterpretation(orgs, activities, relationships, settings)}</section>
      ${settings.includeCharts ? chartSection(orgs) : ''}
      ${settings.includeRelationships ? relationshipSection(relationships, data.organizations, orgs) : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}
      ${settings.includeDataQuality ? qualityNotesSection(orgs) : ''}
      ${settings.includeOrgList ? orgTableSection(orgs) : ''}`);
  }

  function gapReport(county, data, orgs, activities, relationships, census, settings) {
    const tracts = tractRows(census, orgs, settings).slice(0, 12);
    return documentShell(county, 'Geographic Access / Gap Report', reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Relevant orgs', orgs.length], ['Mapped orgs', orgs.filter(hasCoordinates).length], ['Census tracts', allTracts(census).length], ['Priority tracts shown', tracts.length], ['No nearby assets', tracts.filter(t => t.closestCount === 0).length], ['Activities', activities.length]
      ])}
      <section class="report-section"><h2>Geographic access readout</h2>${gapInterpretation(tracts, orgs, settings)}</section>
      <section class="report-section"><h2>Priority tract table</h2>${tractTable(tracts)}</section>
      ${settings.includeCharts ? gapChartSection(tracts) : ''}
      ${settings.includeOrgList ? orgTableSection(orgs.filter(hasCoordinates), 'Mapped organizations used as assets') : ''}
      ${settings.includeActivities ? activitySection(activities, data.organizations) : ''}`);
  }

  function engagementReport(county, data, orgs, activities, relationships, settings) {
    const statusCounts = countBy(orgs, o => o.status || 'No status');
    const activityCounts = countBy(activities, a => a.type || 'Activity');
    return documentShell(county, 'Partner Engagement Report', reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Organizations in scope', orgs.length], ['Activities in range', activities.length], ['Open follow-ups', activities.filter(a => a.followUpDate && !a.followUpCompleted).length], ['Completed follow-ups', activities.filter(a => a.followUpDate && a.followUpCompleted).length], ['Contacts', data.contacts.length], ['Relationships', relationships.length]
      ])}
      <section class="report-section"><h2>Engagement readout</h2>${engagementInterpretation(orgs, activities)}</section>
      ${settings.includeCharts ? `<section class="report-section"><h2>Engagement visuals</h2><div class="report-chart-grid">${barChart('Organization status', statusCounts)}${barChart('Activity types', activityCounts)}</div></section>` : ''}
      ${activitySection(activities, data.organizations, 'Activity log')}
      ${orgTableSection(orgs, 'Organizations in engagement scope')}`);
  }

  function networkReport(county, data, orgs, activities, relationships, settings) {
    const degrees = networkDegrees(orgs, relationships);
    const isolated = orgs.filter(o => !degrees.get(o.id));
    const hubs = [...degrees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, degree]) => ({ org: orgs.find(o => o.id === id), degree }));
    return documentShell(county, 'Relationship / Network Report', reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Organizations in scope', orgs.length], ['Relationships', relationships.length], ['Connected orgs', orgs.length - isolated.length], ['Isolated orgs', isolated.length], ['Potential ties', relationships.filter(r => /potential/i.test(r.status || '')).length], ['Strong ties', relationships.filter(r => /strong/i.test(r.strength || '')).length]
      ])}
      <section class="report-section"><h2>Network readout</h2>${networkInterpretation(orgs, relationships, isolated)}</section>
      <section class="report-section"><h2>Network hubs</h2>${hubTable(hubs)}</section>
      ${relationshipSection(relationships, data.organizations, orgs)}
      ${orgTableSection(isolated, 'Organizations without mapped relationships')}`);
  }

  function qualityReport(county, data, orgs, activities, relationships, settings) {
    const missingCoords = orgs.filter(o => !hasCoordinates(o));
    const missingContact = orgs.filter(o => !String(o.phone || o.email || o.website || '').trim());
    const researchOnly = orgs.filter(isResearchOnly);
    const lowConfidence = orgs.filter(isLowConfidence);
    const possibleDuplicates = duplicateCandidates(orgs);
    return documentShell(county, 'Data Quality Report', reportScopeLabel(settings), `
      ${summaryMetrics([
        ['Organizations reviewed', orgs.length], ['Missing coordinates', missingCoords.length], ['Missing contact/web', missingContact.length], ['Research-only', researchOnly.length], ['Low confidence', lowConfidence.length], ['Possible duplicates', possibleDuplicates.length]
      ])}
      <section class="report-section"><h2>Data quality readout</h2>${qualityInterpretation(orgs, missingCoords, missingContact, researchOnly, lowConfidence, possibleDuplicates)}</section>
      <div class="report-two-col">
        ${issueTable('Missing coordinates', missingCoords, ['Name', 'Type', 'Address'], o => [o.name, o.type, o.address])}
        ${issueTable('Low confidence or needs verification', lowConfidence, ['Name', 'Type', 'Confidence'], o => [o.name, o.type, o.confidence])}
        ${issueTable('Research-only records', researchOnly, ['Name', 'Type', 'Status'], o => [o.name, o.type, o.status])}
        ${issueTable('Possible duplicates', possibleDuplicates, ['Possible match', 'Reason'], d => [d.names, d.reason])}
      </div>`);
  }

  function documentShell(county, title, subtitle, body) {
    const generated = new Date().toLocaleString();
    return `<article class="report-document">
      <header class="report-cover">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(county.name || 'Active county')} | CONVENE Reporting Center</p>
        <p>Generated ${escapeHtml(generated)}</p>
        <span class="report-tagline">${escapeHtml(subtitle || 'All active records')}</span>
      </header>
      ${body}
      <footer class="report-section"><p class="muted small">Report generated from browser-stored CONVENE workspace data for the selected county. Census-based sections depend on the current county census file.</p></footer>
    </article>`;
  }

  function summaryMetrics(items) {
    return `<section class="report-section"><div class="report-summary-grid">${items.map(([label, value]) => `<div class="report-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value ?? 0))}</b></div>`).join('')}</div></section>`;
  }

  function chartSection(orgs) {
    return `<section class="report-section"><h2>Charts and visuals</h2><div class="report-chart-grid">
      ${barChart('Organizations by service type', countBy(orgs, o => o.type || 'No type'), 10)}
      ${barChart('Organizations by focus tag', countTags(orgs), 10)}
      ${barChart('Reach', countBy(orgs, o => o.reach || 'No reach'), 8)}
      ${barChart('Confidence', countBy(orgs, o => o.confidence || 'No confidence'), 8)}
    </div></section>`;
  }

  function gapChartSection(tracts) {
    return `<section class="report-section"><h2>Gap visuals</h2><div class="report-chart-grid">
      ${barChart('Highest priority tracts', tracts.map(t => [t.name, t.priority]), 12)}
      ${barChart('Closest mapped assets', tracts.map(t => [t.name, t.closestCount]), 12)}
    </div></section>`;
  }

  function barChart(title, entries, limit = 10) {
    const rows = (entries || []).slice(0, limit);
    const max = Math.max(1, ...rows.map(([, count]) => Number(count) || 0));
    return `<div class="report-chart"><h3>${escapeHtml(title)}</h3>${rows.length ? rows.map(([label, count]) => {
      const pct = Math.max(2, Math.round(((Number(count) || 0) / max) * 100));
      return `<div class="bar-row"><span title="${escapeAttr(label)}">${escapeHtml(shorten(label, 30))}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><b>${escapeHtml(String(count))}</b></div>`;
    }).join('') : '<p class="muted">No records available.</p>'}</div>`;
  }

  function relationshipSection(relationships, allOrgs, scopedOrgs) {
    const scopedIds = new Set(scopedOrgs.map(o => o.id));
    const rows = relationships.slice(0, 40).map(r => [orgName(r.fromOrgId, allOrgs), orgName(r.toOrgId, allOrgs), r.status || '', r.strength || '', r.summary || r.notes || '']);
    return `<section class="report-section"><h2>Relationship summary</h2>
      ${relationships.length ? table(['Organization A', 'Organization B', 'Status', 'Strength', 'Summary'], rows) : '<p class="muted">No relationships found in this report scope.</p>'}
      ${scopedIds.size ? `<p class="muted small">Showing up to 40 relationships involving organizations in this report scope.</p>` : ''}
    </section>`;
  }

  function activitySection(activities, allOrgs, title = 'Recent activity') {
    const rows = activities.slice(0, 25).map(a => [formatDate(a.date), a.type || '', a.summary || '', toArray(a.organizationIds).map(id => orgName(id, allOrgs)).join(', '), followUpLabel(a)]);
    return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${rows.length ? table(['Date', 'Type', 'Summary', 'Organizations', 'Follow-up'], rows) : '<p class="muted">No activities found in this report scope.</p>'}</section>`;
  }

  function orgTableSection(orgs, title = 'Organization list') {
    const rows = orgs.slice(0, 80).map(o => [o.name || '', o.type || '', focusTags(o).join(', '), o.status || '', o.reach || '', o.confidence || '', o.address || '']);
    return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${rows.length ? table(['Name', 'Type', 'Focus', 'Status', 'Reach', 'Confidence', 'Address'], rows) : '<p class="muted">No organizations found in this report scope.</p>'}${orgs.length > 80 ? `<p class="muted small">Showing first 80 of ${orgs.length} organizations.</p>` : ''}</section>`;
  }

  function qualityNotesSection(orgs) {
    const missingCoords = orgs.filter(o => !hasCoordinates(o)).length;
    const researchOnly = orgs.filter(isResearchOnly).length;
    const lowConfidence = orgs.filter(isLowConfidence).length;
    return `<section class="report-section"><h2>Data quality notes</h2><div class="report-callout">
      <p>${qualitySentence(missingCoords, 'organization is', 'organizations are')} missing coordinates. ${qualitySentence(researchOnly, 'record is', 'records are')} marked research-only. ${qualitySentence(lowConfidence, 'record has', 'records have')} low confidence or needs verification.</p>
    </div></section>`;
  }

  function table(headers, rows) {
    return `<div class="report-table-wrap"><table class="report-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function issueTable(title, items, headers, mapper) {
    const rows = items.slice(0, 30).map(mapper);
    return `<section class="report-section"><h2>${escapeHtml(title)}</h2>${rows.length ? table(headers, rows) : '<p class="quality-good">No issues found in this category.</p>'}${items.length > 30 ? `<p class="muted small">Showing first 30 of ${items.length}.</p>` : ''}</section>`;
  }

  function ecosystemInterpretation(orgs, activities, relationships) {
    const mappedPct = orgs.length ? Math.round((orgs.filter(hasCoordinates).length / orgs.length) * 100) : 0;
    const topTypes = countBy(orgs, o => o.type || 'No type').slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ');
    return `<p>The active workspace contains ${orgs.length} organizations, with ${mappedPct}% currently mapped. The largest service categories are ${escapeHtml(topTypes || 'not yet established')}. The report scope includes ${activities.length} activities and ${relationships.length} mapped relationships.</p>`;
  }

  function focusInterpretation(orgs, activities, relationships, settings) {
    const label = settings.focusTag || settings.serviceType || 'selected focus area';
    return `<p>This report narrows the workspace to ${escapeHtml(label)}. It includes ${orgs.length} relevant organizations, ${orgs.filter(hasCoordinates).length} mapped locations, ${activities.length} activities in the selected date range, and ${relationships.length} relationships connected to the scoped organizations.</p>`;
  }

  function gapInterpretation(tracts, orgs, settings) {
    const noAssets = tracts.filter(t => t.closestCount === 0).length;
    const label = settings.focusTag || settings.serviceType || 'selected service lens';
    return `<p>This report compares tract-level need signals with mapped assets for ${escapeHtml(label)}. Among the priority tracts shown, ${noAssets} have no matching mapped assets within the working distance estimate. This should be treated as a planning signal, not as proof that services do not exist.</p>`;
  }

  function engagementInterpretation(orgs, activities) {
    const open = activities.filter(a => a.followUpDate && !a.followUpCompleted).length;
    return `<p>This report summarizes engagement activity for ${orgs.length} organizations in scope. There are ${activities.length} activities in the selected period and ${open} open follow-up items.</p>`;
  }

  function networkInterpretation(orgs, relationships, isolated) {
    return `<p>The current relationship map includes ${relationships.length} relationships among ${orgs.length} scoped organizations. ${isolated.length} organizations do not yet have a mapped relationship, which may indicate either actual isolation or simply incomplete relationship tracking.</p>`;
  }

  function qualityInterpretation(orgs, missingCoords, missingContact, researchOnly, lowConfidence, possibleDuplicates) {
    return `<p>This review checks ${orgs.length} organization records for basic cleanup needs. The most important issues are ${missingCoords.length} missing coordinates, ${missingContact.length} records missing phone/email/website, ${researchOnly.length} research-only records, ${lowConfidence.length} low-confidence records, and ${possibleDuplicates.length} possible duplicate clusters.</p>`;
  }

  async function loadCensus(county) {
    if (!county?.censusFile) return null;
    if (state.censusCache.has(county.id)) return state.censusCache.get(county.id);
    try {
      const response = await fetch(county.censusFile, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.censusCache.set(county.id, payload);
      return payload;
    } catch (err) {
      console.warn('Could not load census file for report.', err);
      return null;
    }
  }

  function allTracts(census) {
    if (!census) return [];
    if (Array.isArray(census.tracts)) return census.tracts;
    if (Array.isArray(census.features)) return census.features.map(featureToTract);
    if (Array.isArray(census.geojson?.features)) return census.geojson.features.map(featureToTract);
    return [];
  }

  function featureToTract(feature = {}) {
    const p = feature.properties || {};
    return {
      id: p.geoid || p.GEOID || p.tract || p.NAME || '',
      name: p.name || p.NAME || p.tract || p.GEOID || 'Tract',
      population: Number(p.population ?? p.totalPopulation ?? p.B01001_001E ?? 0),
      needScore: Number(p.needScore ?? p.relativeNeedScore ?? p.priorityScore ?? p.compositeScore ?? 0),
      priorityScore: Number(p.priorityScore ?? p.needScore ?? p.relativeNeedScore ?? 0),
      povertyRate: Number(p.povertyRate ?? p.poverty ?? 0),
      olderAdultRate: Number(p.olderAdultRate ?? p.age65Rate ?? p.age65PlusRate ?? 0),
      coordinates: tractCenter(feature.geometry)
    };
  }

  function tractRows(census, orgs) {
    const mapped = orgs.filter(hasCoordinates);
    return allTracts(census).map(tract => {
      const center = tract.coordinates || tract.center || [Number(tract.lat), Number(tract.lng)];
      const distances = mapped.map(org => distanceMiles(center[0], center[1], Number(org.lat), Number(org.lng))).filter(Number.isFinite).sort((a, b) => a - b);
      const closestCount = distances.filter(d => d <= 10).length;
      const closestMiles = distances.length ? distances[0] : null;
      const need = Number(tract.needScore ?? tract.relativeNeedScore ?? tract.priorityScore ?? tract.compositeScore ?? 0);
      const priority = Math.round(Math.max(0, Math.min(100, need + (closestCount === 0 ? 25 : closestCount <= 2 ? 12 : 0))));
      return {
        name: tract.name || tract.tract || tract.id || 'Tract',
        population: tract.population || tract.totalPopulation || 0,
        need,
        priority,
        closestCount,
        closestMiles
      };
    }).sort((a, b) => b.priority - a.priority || a.closestCount - b.closestCount);
  }

  function tractTable(tracts) {
    return tracts.length ? table(['Tract', 'Population', 'Need score', 'Priority', 'Assets within 10 mi', 'Closest asset'], tracts.map(t => [t.name, t.population || 'n/a', t.need || 'n/a', t.priority, t.closestCount, t.closestMiles == null ? 'None mapped' : `${t.closestMiles.toFixed(1)} mi`])) : '<p class="muted">No census tract data was available for this county report.</p>';
  }

  function tractCenter(geometry = {}) {
    const coords = [];
    geometryRings(geometry).forEach(ring => ring.forEach(c => { if (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) coords.push(c); }));
    if (!coords.length) return [NaN, NaN];
    const lng = coords.reduce((sum, c) => sum + Number(c[0]), 0) / coords.length;
    const lat = coords.reduce((sum, c) => sum + Number(c[1]), 0) / coords.length;
    return [lat, lng];
  }

  function geometryRings(geometry = {}) {
    if (geometry.type === 'Polygon') return geometry.coordinates || [];
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
    return [];
  }

  function filteredReportOrgs(orgs, settings) {
    return orgs.filter(org => {
      const matchesType = !settings.serviceType || org.type === settings.serviceType;
      const matchesFocus = !settings.focusTag || focusTags(org).some(tag => normalizeKey(tag) === normalizeKey(settings.focusTag));
      return matchesType && matchesFocus;
    }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function filterActivities(activities, settings) {
    const orgIds = new Set(filteredReportOrgs(workspace().organizations, settings).map(o => o.id));
    const { start, end } = dateWindow(settings);
    return activities.filter(activity => {
      const date = activity.date ? new Date(`${activity.date}T00:00:00`) : null;
      const inDate = (!start || (date && date >= start)) && (!end || (date && date <= end));
      const inScope = !orgIds.size || toArray(activity.organizationIds).some(id => orgIds.has(id));
      return inDate && inScope;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function relevantRelationships(relationships, orgs) {
    const ids = new Set(orgs.map(o => o.id));
    return relationships.filter(r => ids.has(r.fromOrgId) || ids.has(r.toOrgId));
  }

  function dateWindow(settings) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (settings.dateRange === 'custom') {
      const start = settings.startDate ? new Date(`${settings.startDate}T00:00:00`) : null;
      const end = settings.endDate ? new Date(`${settings.endDate}T23:59:59`) : null;
      return { start, end };
    }
    if (settings.dateRange === 'all') return { start: null, end: null };
    const days = Number(settings.dateRange) || 0;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return { start, end: today };
  }

  function normalizeOrg(raw = {}) {
    return {
      ...raw,
      id: raw.id || raw.orgId || '',
      name: raw.name || raw.organization || '',
      type: raw.type || '',
      status: raw.status || '',
      reach: raw.reach || raw.geographicReach || '',
      confidence: raw.confidence || raw.reachConfidence || '',
      focus: raw.focus || raw.tags || '',
      mission: raw.mission || raw.description || '',
      lat: cleanNumber(raw.lat ?? raw.latitude),
      lng: cleanNumber(raw.lng ?? raw.longitude)
    };
  }

  function normalizeActivity(raw = {}) {
    return { ...raw, organizationIds: toArray(raw.organizationIds || raw.orgIds || raw.organizations), contactIds: toArray(raw.contactIds || raw.contacts) };
  }

  function normalizeRelationship(raw = {}) {
    return { ...raw, fromOrgId: raw.fromOrgId || raw.sourceOrgId || '', toOrgId: raw.toOrgId || raw.targetOrgId || '' };
  }

  function cleanNumber(value) {
    const cleaned = String(value ?? '').trim().replace(/^--/, '-');
    const n = Number(cleaned);
    return Number.isFinite(n) ? String(n) : '';
  }

  function hasCoordinates(org) {
    return Number.isFinite(Number(org?.lat)) && Number.isFinite(Number(org?.lng));
  }

  function focusTags(org) {
    return String(org.focus || org.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  }

  function countTags(orgs) {
    const counts = new Map();
    orgs.forEach(org => focusTags(org).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function countBy(items, getter) {
    const counts = new Map();
    (items || []).forEach(item => {
      const key = String(getter(item) || '').trim() || 'Blank';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function networkDegrees(orgs, relationships) {
    const ids = new Set(orgs.map(o => o.id));
    const degrees = new Map();
    relationships.forEach(r => {
      if (ids.has(r.fromOrgId)) degrees.set(r.fromOrgId, (degrees.get(r.fromOrgId) || 0) + 1);
      if (ids.has(r.toOrgId)) degrees.set(r.toOrgId, (degrees.get(r.toOrgId) || 0) + 1);
    });
    return degrees;
  }

  function hubTable(hubs) {
    return hubs.length ? table(['Organization', 'Mapped relationships'], hubs.map(h => [h.org?.name || 'Unknown', h.degree])) : '<p class="muted">No connected hubs found in this report scope.</p>';
  }

  function duplicateCandidates(orgs) {
    const byName = new Map();
    orgs.forEach(org => {
      const key = normalizeKey(org.name);
      if (!key) return;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(org);
    });
    return [...byName.values()].filter(group => group.length > 1).map(group => ({ names: group.map(o => o.name).join(' | '), reason: 'Same normalized organization name' }));
  }

  function isResearchOnly(org) {
    return /research/i.test(org.status || '');
  }

  function isLowConfidence(org) {
    return /low|needs/i.test(org.confidence || org.reachConfidence || '');
  }

  function orgName(id, orgs) {
    return (orgs || []).find(o => o.id === id)?.name || 'Unknown organization';
  }

  function followUpLabel(activity) {
    if (!activity.followUpDate) return 'No follow-up';
    return `Follow-up ${formatDate(activity.followUpDate)} ${activity.followUpCompleted ? '(completed)' : '(open)'}`;
  }

  function reportScopeLabel(settings) {
    const parts = [];
    if (settings.serviceType) parts.push(settings.serviceType);
    if (settings.focusTag) parts.push(settings.focusTag);
    if (settings.dateRange && settings.dateRange !== 'all') parts.push(settings.dateRange === 'custom' ? 'Custom date range' : `Last ${settings.dateRange} days`);
    return parts.length ? parts.join(' | ') : 'All records in active county workspace';
  }

  function qualitySentence(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function distanceMiles(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN;
    const R = 3958.8;
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function deg2rad(deg) { return deg * Math.PI / 180; }
  function valueOf(id) { return document.getElementById(id)?.value || ''; }
  function checked(id) { return Boolean(document.getElementById(id)?.checked); }
  function toArray(value) { return Array.isArray(value) ? value : String(value || '').split(/[;,]/).map(v => v.trim()).filter(Boolean); }
  function unique(values) { return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
  function setOptions(select, values, blank) { if (!select) return; const current = select.value; select.innerHTML = `<option value="">${escapeHtml(blank)}</option>` + values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join(''); select.value = values.includes(current) ? current : ''; }
  function formatDate(value) { if (!value) return ''; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(); }
  function normalizeKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function shorten(value, max) { const s = String(value || ''); return s.length > max ? `${s.slice(0, max - 1)}…` : s; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#39;'); }

  function resetReportFilters() {
    ['reportServiceType', 'reportFocusTag', 'reportStartDate', 'reportEndDate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const range = document.getElementById('reportDateRange');
    if (range) range.value = 'all';
    ['includeCharts', 'includeOrgList', 'includeActivities', 'includeRelationships', 'includeDataQuality'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });
    updateReportBuilderState();
  }

  function printReport() {
    if (!state.lastReportHtml) generateReport().then(() => window.print());
    else window.print();
  }

  function exportReportHtml() {
    if (!state.lastReportHtml) {
      alert('Generate a report before exporting HTML.');
      return;
    }
    const county = activeCounty();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CONVENE Report</title><style>${document.getElementById('conveneReportStyles')?.textContent || ''}</style></head><body>${state.lastReportHtml}</body></html>`;
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
})();