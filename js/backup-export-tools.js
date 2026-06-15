(function () {
  if (window.__conveneBackupExportToolsLoaded) return;
  window.__conveneBackupExportToolsLoaded = true;

  var ACCESS_KEY_STORAGE = 'convene:activeAccessKey';

  function install() {
    var backupView = document.getElementById('backupView');
    if (!backupView || document.getElementById('legacyExportToolsCard')) return;

    var card = document.createElement('div');
    card.id = 'legacyExportToolsCard';
    card.className = 'card legacy-export-tools';
    card.innerHTML = '' +
      '<h3>Quick exports</h3>' +
      '<p class="muted">Export active county records for spreadsheet review, reporting, or safe backup.</p>' +
      '<div class="legacy-export-actions">' +
        '<button id="legacyExportJsonBtn" class="primary" type="button">Export JSON Backup</button>' +
        '<button id="legacyClearAccessBtn" type="button">Clear Saved Access</button>' +
        '<button id="legacyExportOrgsBtn" type="button">Export Organizations CSV</button>' +
        '<button id="legacyExportContactsBtn" type="button">Export Contacts CSV</button>' +
        '<button id="legacyExportActivitiesBtn" type="button">Export Activities CSV</button>' +
        '<button id="legacyExportTasksBtn" type="button">Export Upcoming Tasks CSV</button>' +
        '<button id="legacyExportRelationshipsBtn" type="button">Export Relationships CSV</button>' +
        '<button id="legacyExportCoalitionsBtn" type="button">Export Coalitions CSV</button>' +
      '</div>';

    var firstCard = backupView.querySelector('.grid, .card');
    if (firstCard) backupView.insertBefore(card, firstCard);
    else backupView.appendChild(card);

    installStyles();
    bindButton('legacyExportJsonBtn', exportJsonBackup);
    bindButton('legacyClearAccessBtn', clearSavedAccess);
    bindButton('legacyExportOrgsBtn', function () { exportCsv('organizations'); });
    bindButton('legacyExportContactsBtn', function () { exportCsv('contacts'); });
    bindButton('legacyExportActivitiesBtn', function () { exportCsv('activities'); });
    bindButton('legacyExportTasksBtn', exportTasksCsv);
    bindButton('legacyExportRelationshipsBtn', function () { exportCsv('relationships'); });
    bindButton('legacyExportCoalitionsBtn', exportCoalitionsCsv);
  }

  function installStyles() {
    if (document.getElementById('legacyExportToolsStyles')) return;
    var style = document.createElement('style');
    style.id = 'legacyExportToolsStyles';
    style.textContent = '' +
      '.legacy-export-tools { margin-bottom: 16px; }' +
      '.legacy-export-tools h3 { margin-top: 0; }' +
      '.legacy-export-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }' +
      '.legacy-export-actions button { border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; background: #e5e5e5; color: #282728; }' +
      '.legacy-export-actions button.primary { background: var(--uw-red, #c5050c); color: #fff; }' +
      '.legacy-export-actions button:hover { filter: brightness(.96); }';
    document.head.appendChild(style);
  }

  function bindButton(id, handler) {
    var button = document.getElementById(id);
    if (button) button.addEventListener('click', handler);
  }

  function activeCounty() {
    var id = document.getElementById('countySelect') && document.getElementById('countySelect').value;
    if (window.CONVENE_COUNTIES && window.CONVENE_COUNTIES[id]) return window.CONVENE_COUNTIES[id];
    if (window.CONVENE_COUNTIES && window.CONVENE_DEFAULT_COUNTY) return window.CONVENE_COUNTIES[window.CONVENE_DEFAULT_COUNTY];
    return { id: id || 'county', name: id || 'County', storagePrefix: 'convene:' + (id || 'county') };
  }

  function workspace() {
    var county = activeCounty();
    if (window.ConveneStorage && window.ConveneStorage.loadWorkspace) {
      return window.ConveneStorage.loadWorkspace(county) || {};
    }
    return {
      organizations: loadStore(county, 'organizations'),
      contacts: loadStore(county, 'contacts'),
      activities: loadStore(county, 'activities'),
      relationships: loadStore(county, 'relationships'),
      coalitions: loadStore(county, 'coalitions')
    };
  }

  function loadStore(county, name) {
    try {
      var key = county.storagePrefix + ':' + name;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (err) {
      return [];
    }
  }

  function exportJsonBackup() {
    var county = activeCounty();
    var data = workspace();
    data.coalitions = coalitions();
    var payload = {
      system: 'CONVENE',
      edition: 'multi-county',
      countyId: county.id,
      countyName: county.name,
      exportDate: new Date().toISOString(),
      stores: ['organizations', 'contacts', 'activities', 'relationships', 'coalitions'],
      organizations: data.organizations || [],
      contacts: data.contacts || [],
      activities: data.activities || [],
      relationships: data.relationships || [],
      coalitions: data.coalitions || []
    };
    downloadJson('convene-' + county.id + '-workspace-' + dateStamp() + '.json', payload);
  }

  function clearSavedAccess() {
    if (!confirm('Clear saved access for this browser?')) return;
    localStorage.removeItem(ACCESS_KEY_STORAGE);
    alert('Saved access cleared for this browser.');
  }

  function exportCsv(storeName) {
    var data = workspace();
    var rows = data[storeName] || [];
    var columns = columnsFor(storeName, rows);
    downloadText('convene-' + activeCounty().id + '-' + storeName + '-' + dateStamp() + '.csv', csvFromRows(rows, columns), 'text/csv;charset=utf-8');
  }

  function exportCoalitionsCsv() {
    var rows = coalitions();
    var columns = columnsFor('coalitions', rows);
    downloadText('convene-' + activeCounty().id + '-coalitions-' + dateStamp() + '.csv', csvFromRows(rows, columns), 'text/csv;charset=utf-8');
  }

  function exportTasksCsv() {
    var data = workspace();
    var rows = (data.activities || []).filter(function (activity) {
      return activity.followUpDate && !activity.followUpCompleted;
    }).map(function (activity) {
      return {
        id: activity.id || '',
        followUpDate: activity.followUpDate || '',
        date: activity.date || '',
        type: activity.type || '',
        summary: activity.summary || activity.nextStep || '',
        organizations: namesFromIds(activity.organizationIds || activity.orgIds || activity.organizations, data.organizations || []),
        contacts: namesFromIds(activity.contactIds || activity.contacts, data.contacts || []),
        notes: activity.notes || ''
      };
    }).sort(function (a, b) {
      return String(a.followUpDate || '').localeCompare(String(b.followUpDate || ''));
    });
    var columns = ['id', 'followUpDate', 'date', 'type', 'summary', 'organizations', 'contacts', 'notes'];
    downloadText('convene-' + activeCounty().id + '-upcoming-tasks-' + dateStamp() + '.csv', csvFromRows(rows, columns), 'text/csv;charset=utf-8');
  }

  function coalitions() {
    var county = activeCounty();
    var data = workspace();
    if (Array.isArray(data.coalitions)) return data.coalitions;
    if (Array.isArray(data.legacyCoalitions)) return data.legacyCoalitions;
    return loadStore(county, 'coalitions');
  }

  function columnsFor(storeName, rows) {
    var defaults = {
      organizations: ['id', 'name', 'type', 'status', 'address', 'city', 'county', 'phone', 'email', 'website', 'primaryContact', 'lat', 'lng', 'reach', 'confidence', 'focus', 'tags', 'mission', 'description', 'notes', 'communitiesServed', 'reachNotes', 'reachBasis', 'reachSourceUrl', 'geocodeSource'],
      contacts: ['id', 'name', 'organizationId', 'organizationName', 'role', 'title', 'email', 'phone', 'strength', 'notes'],
      activities: ['id', 'date', 'type', 'organizationIds', 'organizationNames', 'contactIds', 'contactNames', 'summary', 'nextStep', 'followUpDate', 'followUpCompleted', 'notes'],
      relationships: ['id', 'fromOrgId', 'sourceOrgId', 'fromOrgName', 'toOrgId', 'targetOrgId', 'toOrgName', 'label', 'strength', 'status', 'summary', 'notes'],
      coalitions: ['id', 'name', 'status', 'tags', 'organizationIds', 'organizationNames', 'description']
    };
    var base = defaults[storeName] || [];
    var extra = [];
    (rows || []).forEach(function (row) {
      Object.keys(row || {}).forEach(function (key) {
        if (base.indexOf(key) === -1 && extra.indexOf(key) === -1) extra.push(key);
      });
    });
    return base.concat(extra);
  }

  function csvFromRows(rows, columns) {
    var data = workspace();
    var out = [columns.map(csvCell).join(',')];
    (rows || []).forEach(function (row) {
      out.push(columns.map(function (column) {
        return csvCell(valueForColumn(row, column, data));
      }).join(','));
    });
    return out.join('\n');
  }

  function valueForColumn(row, column, data) {
    if (column === 'organizationName') return nameById(row.organizationId, data.organizations || []);
    if (column === 'organizationNames') return namesFromIds(row.organizationIds || row.orgIds || row.organizations, data.organizations || []);
    if (column === 'contactNames') return namesFromIds(row.contactIds || row.contacts, data.contacts || []);
    if (column === 'fromOrgName') return nameById(row.fromOrgId || row.sourceOrgId, data.organizations || []);
    if (column === 'toOrgName') return nameById(row.toOrgId || row.targetOrgId, data.organizations || []);
    if (column === 'organizationIds' && Array.isArray(row.organizationIds)) return row.organizationIds.join('; ');
    if (column === 'contactIds' && Array.isArray(row.contactIds)) return row.contactIds.join('; ');
    if (column === 'organizationNames') return namesFromIds(row.organizationIds || row.organizationId || row.organizationIds, data.organizations || []);
    return row[column] == null ? '' : row[column];
  }

  function nameById(id, rows) {
    var found = (rows || []).find(function (row) { return row.id === id; });
    return found ? (found.name || '') : '';
  }

  function namesFromIds(ids, rows) {
    if (!Array.isArray(ids)) ids = ids ? String(ids).split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
    return ids.map(function (id) { return nameById(id, rows) || id; }).filter(Boolean).join('; ');
  }

  function csvCell(value) {
    var text = Array.isArray(value) ? value.join('; ') : String(value == null ? '' : value);
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function downloadJson(filename, payload) {
    downloadText(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function downloadText(filename, text, type) {
    var href = 'data:' + (type || 'text/plain') + ',' + encodeURIComponent(text || '');
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  document.addEventListener('DOMContentLoaded', function () {
    install();
    document.getElementById('countySelect') && document.getElementById('countySelect').addEventListener('change', function () {
      setTimeout(install, 150);
    });
    document.body.addEventListener('click', function (event) {
      var nav = event.target && event.target.closest && event.target.closest('.nav-btn[data-view="backupView"]');
      if (nav) setTimeout(install, 150);
    }, true);
  });
})();