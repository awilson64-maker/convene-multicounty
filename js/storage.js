window.ConveneStorage = (() => {
  const STORES = ['organizations', 'contacts', 'activities', 'relationships', 'coalitions'];
  let restoreCoalitions = null;

  function key(county, name) {
    return `${county.storagePrefix}:${name}`;
  }

  function loadStore(county, name) {
    try {
      return JSON.parse(localStorage.getItem(key(county, name)) || '[]');
    } catch (err) {
      console.warn(`Could not read ${name} from storage`, err);
      return [];
    }
  }

  function saveStore(county, name, records) {
    localStorage.setItem(key(county, name), JSON.stringify(records || []));
  }

  function loadWorkspace(county) {
    const workspace = {};
    STORES.forEach(store => { workspace[store] = loadStore(county, store); });
    return workspace;
  }

  function saveWorkspace(county, workspace = {}) {
    STORES.forEach(store => saveStore(county, store, storeRecords(county, workspace, store)));
  }

  function storeRecords(county, workspace, store) {
    if (Object.prototype.hasOwnProperty.call(workspace, store)) return workspace[store] || [];
    if (store === 'coalitions' && restoreCoalitions !== null) {
      const rows = restoreCoalitions;
      restoreCoalitions = null;
      return rows;
    }
    return loadStore(county, store);
  }

  function exportBackup(county, workspace = {}) {
    return {
      system: 'CONVENE',
      edition: 'multi-county',
      countyId: county.id,
      countyName: county.name,
      exportDate: new Date().toISOString(),
      stores: STORES,
      organizations: storeRecords(county, workspace, 'organizations'),
      contacts: storeRecords(county, workspace, 'contacts'),
      activities: storeRecords(county, workspace, 'activities'),
      relationships: storeRecords(county, workspace, 'relationships'),
      coalitions: storeRecords(county, workspace, 'coalitions')
    };
  }

  function workspaceFromBackup(data = {}) {
    const coalitions = Array.isArray(data.coalitions) ? data.coalitions : [];
    if (Array.isArray(data.coalitions)) restoreCoalitions = coalitions;
    return {
      organizations: Array.isArray(data.organizations) ? data.organizations : [],
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      activities: Array.isArray(data.activities) ? data.activities : [],
      relationships: Array.isArray(data.relationships) ? data.relationships : [],
      coalitions
    };
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { STORES, key, loadStore, saveStore, loadWorkspace, saveWorkspace, exportBackup, workspaceFromBackup, downloadJson };
})();