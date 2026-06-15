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

  function csvToRows(text) {
    const rows = [];
    let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; i++; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === ',' && !quoted) { row.push(value.trim()); value = ''; continue; }
      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(value.trim());
        if (row.some(cell => cell !== '')) rows.push(row);
        row = []; value = '';
        continue;
      }
      value += char;
    }
    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
    return rows;
  }

  function parseCsv(text) {
    const rows = csvToRows(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.toLowerCase().trim());
    return rows.slice(1).map(row => {
      const record = {};
      headers.forEach((header, index) => {
        const mapped = headerMap(header);
        if (mapped) record[mapped] = row[index] || '';
      });
      return normalizeOrg(record);
    }).filter(org => org.name);
  }

  function headerMap(header) {
    const map = {
      organization: 'name', org: 'name', name: 'name',
      category: 'type', service_type: 'type', type: 'type',
      status: 'status', reach: 'reach', confidence: 'confidence',
      phone: 'phone', website: 'website', url: 'website', email: 'email',
      address: 'address', latitude: 'lat', lat: 'lat', longitude: 'lng', lng: 'lng', lon: 'lng', long: 'lng',
      focus: 'focus', tags: 'focus', mission: 'mission', description: 'mission', notes: 'notes'
    };
    return map[header] || null;
  }

  return { fields, normalizeOrg, parseCsv };
})();
