window.ConveneStorage = (() => {
  function key(county, name) {
    return `${county.storagePrefix}:${name}`;
  }

  function loadOrgs(county) {
    try {
      return JSON.parse(localStorage.getItem(key(county, 'organizations')) || '[]');
    } catch (err) {
      console.warn('Could not read organizations from storage', err);
      return [];
    }
  }

  function saveOrgs(county, orgs) {
    localStorage.setItem(key(county, 'organizations'), JSON.stringify(orgs));
  }

  function exportBackup(county, orgs) {
    return {
      system: 'CONVENE',
      edition: 'multi-county',
      countyId: county.id,
      countyName: county.name,
      exportDate: new Date().toISOString(),
      organizations: orgs
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

  return { key, loadOrgs, saveOrgs, exportBackup, downloadJson };
})();
