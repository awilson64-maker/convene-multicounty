window.ConveneCRM = (() => {
  const fields = ['name','type','status','reach','confidence','phone','website','email','address','lat','lng','focus','mission','notes'];

  function newId() {
    return `org_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function normalizeOrg(raw = {}) {
    const org = { id: raw.id || newId() };
    fields.forEach(field => { org[field] = raw[field] || ''; });
    org.lat = org.lat === '' ? '' : Number(org.lat);
    org.lng = org.lng === '' ? '' : Number(org.lng);
    return org;
  }

  function parseCsv(text) {
    if (window.ConveneBulkCsvImporter?.parseOrganizations) {
      return window.ConveneBulkCsvImporter.parseOrganizations(text).map(normalizeOrg).filter(org => org.name);
    }

    console.warn('CONVENE CSV import is handled by js/bulk-csv-import-aliases.js. Legacy simple parser fallback is disabled.');
    return [];
  }

  return { fields, normalizeOrg, parseCsv };
})();
