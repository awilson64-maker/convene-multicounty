window.ConveneStorage = (() => {
  const STORES = ['organizations', 'contacts', 'activities', 'relationships'];

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

  function saveWorkspace(county, workspace) {
    STORES.forEach(store => saveStore(county, store, workspace[store] || []));
  }

  function exportBackup(county, workspace) {
    return {
      system: 'CONVENE',
      edition: 'multi-county',
      countyId: county.id,
      countyName: county.name,
      exportDate: new Date().toISOString(),
      stores: STORES,
      organizations: workspace.organizations || [],
      contacts: workspace.contacts || [],
      activities: workspace.activities || [],
      relationships: workspace.relationships || []
    };
  }

  function workspaceFromBackup(data) {
    return {
      organizations: Array.isArray(data.organizations) ? data.organizations : [],
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      activities: Array.isArray(data.activities) ? data.activities : [],
      relationships: Array.isArray(data.relationships) ? data.relationships : []
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
