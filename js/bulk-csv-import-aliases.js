(function () {
  if (window.__conveneBulkCsvImportAliasesLoaded) return;
  window.__conveneBulkCsvImportAliasesLoaded = true;

  var state = {
    rows: [],
    preview: null,
    installed: false
  };

  window.ConveneBulkCsvImporter = {
    parseCsv: parseCsv,
    parseOrganizations: parseOrganizations,
    normalizeOrgRow: normalizeOrgRow,
    buildPreview: buildPreview
  };

  function boot() {
    install();
    setTimeout(install, 250);
    setTimeout(install, 800);

    document.body.addEventListener('click', function (event) {
      var nav = event.target && event.target.closest && event.target.closest('.nav-btn[data-view="backupView"]');
      if (nav) {
        setTimeout(install, 80);
        setTimeout(install, 350);
      }
    }, true);
  }

  function install() {
    var input = document.getElementById('bulkUpdateCsvFile');
    if (!input || input.dataset.conveneAliasImportInstalled === 'true') return;
    input.dataset.conveneAliasImportInstalled = 'true';
    input.addEventListener('change', handleFile, true);

    var append = document.getElementById('bulkAppendNew');
    var clear = document.getElementById('bulkClearBlank');
    if (append && append.dataset.conveneAliasImportInstalled !== 'true') {
      append.dataset.conveneAliasImportInstalled = 'true';
      append.addEventListener('change', renderPreview, true);
    }
    if (clear && clear.dataset.conveneAliasImportInstalled !== 'true') {
      clear.dataset.conveneAliasImportInstalled = 'true';
      clear.addEventListener('change', renderPreview, true);
    }
  }

  function handleFile(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    event.stopImmediatePropagation();

    readText(file, function (text) {
      state.rows = parseOrganizations(text);
      renderPreview();
    });
  }

  function readText(file, callback) {
    if (file.text) {
      file.text().then(callback).catch(function () { showMessage('Could not read that CSV file.'); });
      return;
    }
    var reader = new FileReader();
    reader.onload = function () { callback(String(reader.result || '')); };
    reader.onerror = function () { showMessage('Could not read that CSV file.'); };
    reader.readAsText(file);
  }

  function renderPreview() {
    var container = document.getElementById('bulkUpdatePreview');
    if (!container) return;

    var rows = state.rows || [];
    if (!rows.length) {
      container.innerHTML = '<p class="muted">No valid rows loaded. The CSV needs a name, organization name, or id column.</p>';
      return;
    }

    var preview = buildPreview(rows);
    state.preview = preview;
    var sample = preview.items.slice(0, 18);

    container.innerHTML = '' +
      '<p><b>' + rows.length + '</b> valid CSV rows parsed. <b>' + preview.updateCount + '</b> update existing records, <b>' + preview.appendCount + '</b> append as new, <b>' + preview.skipCount + '</b> skipped/unchanged.</p>' +
      '<table><thead><tr><th>Status</th><th>Name</th><th>Match</th><th>Changed fields</th></tr></thead><tbody>' +
        sample.map(function (item) {
          return '<tr><td>' + pill(item.status) + '</td><td>' + escapeHtml(item.row.name || (item.match && item.match.name) || 'Unnamed') + '</td><td>' + escapeHtml((item.match && item.match.name) || item.reason || 'New record') + '</td><td>' + escapeHtml((item.changedFields || []).join(', ') || item.reason || 'None') + '</td></tr>';
        }).join('') +
      '</tbody></table>' +
      (preview.items.length > sample.length ? '<p class="muted">Showing first ' + sample.length + ' rows.</p>' : '') +
      '<div class="small-actions" style="margin-top:10px"><button id="commitBulkAliasImportBtn" class="primary" type="button">Apply CSV Import / Update</button></div>';

    var commit = document.getElementById('commitBulkAliasImportBtn');
    if (commit) commit.addEventListener('click', commitImport);
  }

  function buildPreview(rows) {
    var data = workspace();
    var organizations = data.organizations || [];
    var appendNew = document.getElementById('bulkAppendNew') ? document.getElementById('bulkAppendNew').checked !== false : true;
    var clearBlank = Boolean(document.getElementById('bulkClearBlank') && document.getElementById('bulkClearBlank').checked);

    var items = rows.map(function (row) {
      var match = findOrgMatch(row, organizations);
      if (match.ambiguous) return { row: row, status: 'warn', reason: 'Ambiguous name match', match: null, changedFields: [] };
      if (match.org) {
        var changedFields = changedOrgFields(match.org, row, clearBlank);
        return { row: row, status: changedFields.length ? 'update' : 'skip', match: match.org, changedFields: changedFields, reason: changedFields.length ? '' : 'No changes' };
      }
      return { row: row, status: appendNew ? 'append' : 'skip', match: null, changedFields: Object.keys(row).filter(function (key) { return clean(row[key]); }), reason: appendNew ? '' : 'Append disabled' };
    });

    return {
      items: items,
      updateCount: items.filter(function (item) { return item.status === 'update'; }).length,
      appendCount: items.filter(function (item) { return item.status === 'append'; }).length,
      skipCount: items.filter(function (item) { return item.status === 'skip' || item.status === 'warn'; }).length,
      clearBlank: clearBlank
    };
  }

  function commitImport() {
    var preview = state.preview;
    if (!preview) return;

    var county = activeCounty();
    var data = workspace();
    var organizations = (data.organizations || []).slice();

    preview.items.forEach(function (item) {
      if (item.status === 'update' && item.match) {
        var index = organizations.findIndex(function (org) { return org.id === item.match.id; });
        if (index >= 0) organizations[index] = mergeOrg(organizations[index], item.row, preview.clearBlank);
      }
      if (item.status === 'append') organizations.push(newOrg(item.row));
    });

    data.organizations = organizations;
    if (window.ConveneStorage && window.ConveneStorage.saveWorkspace) window.ConveneStorage.saveWorkspace(county, data);
    else localStorage.setItem(county.storagePrefix + ':organizations', JSON.stringify(organizations));

    var container = document.getElementById('bulkUpdatePreview');
    if (container) container.innerHTML = '<p>' + preview.updateCount + ' records updated and ' + preview.appendCount + ' records appended for ' + escapeHtml(county.name || county.id || 'this county') + '. Refreshing the workspace...</p>';
    setTimeout(function () { window.location.reload(); }, 650);
  }

  function parseOrganizations(text) {
    return parseCsv(text).map(normalizeOrgRow).filter(function (row) {
      return clean(row.name) || clean(row.id);
    });
  }

  function normalizeOrgRow(row) {
    var index = normalizedIndex(row);
    function pick() {
      for (var i = 0; i < arguments.length; i += 1) {
        var key = headerKey(arguments[i]);
        var actual = index[key];
        if (actual != null && clean(row[actual])) return clean(row[actual]);
      }
      return '';
    }

    return {
      id: pick('id', 'organization id', 'org id'),
      name: pick('name', 'organization name', 'organization', 'org name', 'agency', 'agency name', 'nonprofit name'),
      type: pick('type', 'organization type', 'org type', 'category', 'service type'),
      status: canonicalStatus(pick('status', 'organization status')),
      address: pick('address', 'street address', 'physical address', 'full address'),
      city: pick('city', 'municipality'),
      county: pick('county'),
      phone: pick('phone', 'telephone', 'phone number'),
      email: pick('email', 'e-mail'),
      website: pick('website', 'url', 'web site'),
      primaryContact: pick('primary contact', 'contact', 'contact name'),
      lat: cleanLng(pick('lat', 'latitude')),
      lng: cleanLng(pick('lng', 'lon', 'long', 'longitude')),
      focus: pick('focus', 'tags', 'focus tags', 'focus areas', 'focus areas tags', 'focus areas / tags'),
      mission: pick('mission', 'description', 'mission description', 'mission / description'),
      communitiesServed: pick('communities served', 'community served', 'service area'),
      reach: pick('reach', 'geographic reach'),
      confidence: pick('confidence', 'reach confidence'),
      notes: pick('notes', 'note'),
      reachNotes: pick('reach notes'),
      reachBasis: pick('reach basis'),
      reachSourceUrl: pick('reach source url', 'source url')
    };
  }

  function normalizedIndex(row) {
    var out = {};
    Object.keys(row || {}).forEach(function (key) {
      out[headerKey(key)] = key;
    });
    return out;
  }

  function parseCsv(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var rawRows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      var next = text[i + 1];
      if (ch === '"' && inQuotes && next === '"') { cell += '"'; i += 1; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i += 1;
        row.push(cell);
        rawRows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    rawRows.push(row);

    var headers = (rawRows.shift() || []).map(function (h) { return clean(h).replace(/^\uFEFF/, ''); });
    return rawRows.filter(function (r) {
      return r.some(function (v) { return clean(v); });
    }).map(function (r) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = clean(r[i]); });
      return obj;
    });
  }

  function findOrgMatch(row, organizations) {
    if (row.id) {
      var byId = (organizations || []).find(function (org) { return org.id === row.id; });
      if (byId) return { org: byId };
    }
    var name = norm(row.name);
    var address = norm(row.address);
    if (!name) return { org: null };
    if (address) {
      var exact = (organizations || []).find(function (org) { return norm(org.name) === name && norm(org.address) === address; });
      if (exact) return { org: exact };
    }
    var matches = (organizations || []).filter(function (org) { return norm(org.name) === name; });
    if (matches.length === 1) return { org: matches[0] };
    if (matches.length > 1) return { ambiguous: true };
    return { org: null };
  }

  function changedOrgFields(existing, row, clearBlank) {
    return Object.keys(row).filter(function (field) {
      if (field === 'id') return false;
      if (!clearBlank && !clean(row[field])) return false;
      return String(existing[field] == null ? legacyValue(existing, field) || '' : existing[field]) !== String(row[field] == null ? '' : row[field]);
    });
  }

  function mergeOrg(existing, row, clearBlank) {
    var merged = Object.assign({}, existing);
    Object.keys(row).forEach(function (field) {
      if (field === 'id') return;
      if (!clearBlank && !clean(row[field])) return;
      merged[field] = row[field];
    });
    return merged;
  }

  function newOrg(row) {
    var org = Object.assign({}, row);
    if (!org.id) org.id = 'org_' + Date.now() + '_' + Math.random().toString(16).slice(2);
    return org;
  }

  function workspace() {
    var county = activeCounty();
    if (window.ConveneStorage && window.ConveneStorage.loadWorkspace) return window.ConveneStorage.loadWorkspace(county) || {};
    return { organizations: JSON.parse(localStorage.getItem(county.storagePrefix + ':organizations') || '[]') };
  }

  function activeCounty() {
    var selected = document.getElementById('countySelect') && document.getElementById('countySelect').value;
    if (window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[selected]) return window.CONVENE_COUNTIES[selected];
    if (window.CONVENE_COUNTIES && window.CONVENE_DEFAULT_COUNTY) return window.CONVENE_COUNTIES[window.CONVENE_DEFAULT_COUNTY];
    return { id: selected || 'county', name: selected || 'County', storagePrefix: 'convene:' + (selected || 'county') };
  }

  function legacyValue(org, field) {
    var map = { reach: 'geographicReach', confidence: 'reachConfidence', focus: 'tags', mission: 'description', lat: 'latitude', lng: 'longitude' };
    return org[map[field]];
  }

  function canonicalStatus(value) {
    var raw = clean(value);
    var key = raw.toLowerCase();
    var map = {
      'active': 'Active',
      'active collaboration': 'Active collaboration',
      'research only': 'Research only',
      'inactive': 'Inactive',
      'contacted': 'Contacted',
      'meeting scheduled': 'Meeting scheduled',
      'met': 'Met',
      'not contacted': 'Not contacted'
    };
    return map[key] || raw;
  }

  function headerKey(value) { return clean(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function cleanLng(value) { var text = clean(value); return text.indexOf('--') === 0 ? '-' + text.slice(2) : text; }
  function norm(value) { return clean(value).replace(/\s+/g, ' ').toLowerCase(); }
  function pill(status) { return '<span class="pill pill-' + (status === 'append' ? 'ready' : status) + '">' + (status === 'append' ? 'append' : status) + '</span>'; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]; }); }
  function showMessage(message) { var container = document.getElementById('bulkUpdatePreview'); if (container) container.innerHTML = '<p class="muted">' + escapeHtml(message) + '</p>'; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
