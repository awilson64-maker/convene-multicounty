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
    const rows = csvToRows(String(text || '').replace(/^\uFEFF/, ''));
    if (rows.length < 2) return [];
    const headers = rows[0].map(normalizeHeader);
    return rows.slice(1).map(row => {
      const record = {};
      headers.forEach((header, index) => {
        const mapped = headerMap(header);
        if (mapped) record[mapped] = row[index] || '';
      });
      return normalizeOrg(record);
    }).filter(org => org.name);
  }

  function normalizeHeader(header) {
    return String(header || '')
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[\/\\-]+/g, ' ')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function headerMap(header) {
    const map = {
      id: 'id',
      organization: 'name', org: 'name', name: 'name', agency: 'name', nonprofit: 'name',
      'organization name': 'name', 'org name': 'name', 'agency name': 'name', 'nonprofit name': 'name',
      category: 'type', type: 'type', 'service type': 'type', 'organization type': 'type', 'org type': 'type',
      status: 'status', 'organization status': 'status', reach: 'reach', 'geographic reach': 'reach', confidence: 'confidence', 'reach confidence': 'confidence',
      phone: 'phone', telephone: 'phone', 'phone number': 'phone', website: 'website', url: 'website', 'web site': 'website', email: 'email', 'e mail': 'email',
      address: 'address', 'street address': 'address', 'physical address': 'address', 'full address': 'address',
      latitude: 'lat', lat: 'lat', longitude: 'lng', lng: 'lng', lon: 'lng', long: 'lng',
      focus: 'focus', tags: 'focus', 'focus tags': 'focus', 'focus areas': 'focus', 'focus areas tags': 'focus',
      mission: 'mission', description: 'mission', 'mission description': 'mission', 'mission and description': 'mission',
      notes: 'notes', note: 'notes'
    };
    return map[header] || null;
  }

  return { fields, normalizeOrg, parseCsv };
})();
