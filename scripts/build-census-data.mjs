import fs from 'node:fs/promises';
import path from 'node:path';

const COUNTIES = {
  fdl: { id: 'fdl', name: 'Fond du Lac County', state: '55', county: '039', out: 'data/fdl/census-tracts.json' },
  waupaca: { id: 'waupaca', name: 'Waupaca County', state: '55', county: '135', out: 'data/waupaca/census-tracts.json' }
};

const REQUESTED_ACS_YEAR = process.env.ACS_YEAR || '2023';
const CENSUS_API_KEY = process.env.CENSUS_API_KEY || '';
const ACS_CHUNK_SIZE = 24;

const CORE_VARS = ['NAME'];
const DATA_VARS = [
  'B01001_001E',
  'B01001_003E', 'B01001_004E', 'B01001_005E', 'B01001_006E',
  'B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E',
  'B01001_027E', 'B01001_028E', 'B01001_029E', 'B01001_030E',
  'B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E',
  'B17001_001E', 'B17001_002E',
  'B17001_004E', 'B17001_005E', 'B17001_006E', 'B17001_007E', 'B17001_008E', 'B17001_009E',
  'B17001_018E', 'B17001_019E', 'B17001_020E', 'B17001_021E', 'B17001_022E', 'B17001_023E',
  'B17010_001E', 'B17010_002E',
  'B19013_001E',
  'B08201_001E', 'B08201_002E',
  'B23025_003E', 'B23025_005E',
  'B25070_001E', 'B25070_007E', 'B25070_008E', 'B25070_009E', 'B25070_010E',
  'B22010_001E', 'B22010_002E',
  'B28002_001E', 'B28002_013E',
  'C16002_001E', 'C16002_004E', 'C16002_007E', 'C16002_010E', 'C16002_013E'
];

const METADATA = {
  poverty: 'B17001_002E / B17001_001E',
  income: 'B19013_001E',
  noVehicle: 'B08201_002E / B08201_001E',
  senior: 'B01001 age 65+ cells / B01001_001E',
  children: 'B01001 under age 18 cells / B01001_001E',
  childPoverty: 'B17001 child below-poverty cells / B01001 under age 18 cells',
  familiesPovertyChildren: 'B17010_002E / B17010_001E proxy',
  unemployment: 'B23025_005E / B23025_003E',
  rentBurden: 'B25070 gross rent 30%+ of income cells / B25070_001E',
  snap: 'B22010_002E / B22010_001E',
  noInternet: 'B28002_013E / B28002_001E',
  limitedEnglish: 'C16002 limited-English household cells / C16002_001E',
  compositePovertyChildren: 'Composite score: poverty, children, child poverty',
  compositePovertyNoVehicle: 'Composite score: poverty and no-vehicle households',
  compositeSeniorAccess: 'Composite score: age 65+ and no-vehicle households',
  compositeHousingPressure: 'Composite score: rent burden, poverty, and SNAP households',
  compositeDigitalAccess: 'Composite score: no internet access and poverty',
  compositeLanguagePoverty: 'Composite score: limited-English households and poverty'
};

const DIRECT_METRICS = [
  'poverty', 'childPoverty', 'familiesPovertyChildren', 'income', 'noVehicle', 'senior', 'children',
  'unemployment', 'rentBurden', 'snap', 'noInternet', 'limitedEnglish'
];

const COMPOSITES = {
  compositePovertyChildren: ['poverty', 'children', 'childPoverty'],
  compositePovertyNoVehicle: ['poverty', 'noVehicle'],
  compositeSeniorAccess: ['senior', 'noVehicle'],
  compositeHousingPressure: ['rentBurden', 'poverty', 'snap'],
  compositeDigitalAccess: ['noInternet', 'poverty'],
  compositeLanguagePoverty: ['limitedEnglish', 'poverty']
};

async function main() {
  const choice = process.argv[2] || 'all';
  const selected = choice === 'all' ? Object.values(COUNTIES) : [COUNTIES[choice]].filter(Boolean);
  if (!selected.length) throw new Error(`Unknown county choice: ${choice}`);

  if (!CENSUS_API_KEY) {
    console.warn('Warning: CENSUS_API_KEY is not set. The Census API may reject GitHub Actions requests with a Missing Key error. Add a repository secret named CENSUS_API_KEY.');
  }

  for (const county of selected) {
    console.log(`Building ${county.name}; requested ACS ${REQUESTED_ACS_YEAR}...`);
    const { rows: acsRows, year: acsYear } = await fetchAcsWithFallback(county);
    console.log(`Fetched ACS rows: ${acsRows.length} from ACS ${acsYear}`);
    const tracts = await fetchTracts(county);
    console.log(`Fetched tract geometries: ${tracts.features?.length || 0}`);
    const payload = buildPayload(county, acsRows, tracts, acsYear);
    await fs.mkdir(path.dirname(county.out), { recursive: true });
    await fs.writeFile(county.out, JSON.stringify(payload));
    console.log(`Wrote ${county.out} with ${payload.geojson.features.length} tracts and ${payload.matchedTracts} ACS matches.`);
  }
}

async function fetchAcsWithFallback(county) {
  const years = fallbackYears(REQUESTED_ACS_YEAR);
  const errors = [];

  for (const year of years) {
    try {
      const rows = await fetchAcs(county, year);
      return { rows, year };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`ACS ${year}: ${message}`);
      console.warn(`ACS ${year} failed for ${county.name}. Trying next available year if possible.`);
    }
  }

  throw new Error(`Could not fetch ACS data for ${county.name}. Attempts:\n${errors.join('\n\n')}`);
}

function fallbackYears(requestedYear) {
  const requested = Number(requestedYear);
  const candidates = Number.isFinite(requested)
    ? [requested, requested - 1, requested - 2]
    : [2023, 2022, 2021];
  return [...new Set(candidates.filter(year => year >= 2019).map(String))];
}

async function fetchAcs(county, year) {
  const mergedByGeoid = new Map();
  const chunks = chunk(DATA_VARS, ACS_CHUNK_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    const get = [...CORE_VARS, ...chunks[index]].join(',');
    const url = new URL(`https://api.census.gov/data/${year}/acs/acs5`);
    url.searchParams.set('get', get);
    url.searchParams.set('for', 'tract:*');
    url.searchParams.set('in', `state:${county.state} county:${county.county}`);
    if (CENSUS_API_KEY) url.searchParams.set('key', CENSUS_API_KEY);

    console.log(`Fetching ACS ${year} chunk ${index + 1}/${chunks.length} for ${county.name}...`);
    const json = await fetchJson(url, `ACS ${year} chunk ${index + 1} for ${county.name}`, { redactKey: true });
    const [header, ...rows] = json;

    if (!Array.isArray(header) || !header.includes('state') || !header.includes('county') || !header.includes('tract')) {
      throw new Error(`Unexpected ACS response header for ${county.name} in ${year}.`);
    }

    for (const row of rows) {
      const record = Object.fromEntries(header.map((key, columnIndex) => [key, row[columnIndex]]));
      const geoid = `${record.state}${record.county}${record.tract}`;
      const existing = mergedByGeoid.get(geoid) || {};
      mergedByGeoid.set(geoid, { ...existing, ...record });
    }
  }

  const rows = [...mergedByGeoid.values()];
  if (!rows.length) throw new Error(`ACS returned zero tract rows for ${county.name} in ${year}.`);
  return rows;
}

async function fetchTracts(county) {
  // TIGERweb Tracts_Blocks layer 0 is current Census Tracts. Layer 8 is ACS 2024 Block Groups, which is too granular for tract-level ACS joins.
  const url = new URL('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query');
  url.searchParams.set('where', `STATE='${county.state}' AND COUNTY='${county.county}'`);
  url.searchParams.set('outFields', 'GEOID,STATE,COUNTY,TRACT,BASENAME,NAME');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'geojson');

  const json = await fetchJson(url, `TIGERweb tract geometries for ${county.name}`);
  if (!json.features?.length) throw new Error(`No TIGERweb tract features returned for ${county.name}.`);
  return json;
}

async function fetchJson(urlLike, label, options = {}) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike);
  const response = await fetch(url, { headers: { 'User-Agent': 'CONVENE census builder' } });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const safeUrl = options.redactKey ? redactSensitiveUrl(url) : url.toString();

  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}. URL: ${safeUrl}\n${text.slice(0, 700)}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 700);
    throw new Error(`${label} returned non-JSON content. Content-Type: ${contentType || 'unknown'}. URL: ${safeUrl}\n${snippet}`);
  }
}

function redactSensitiveUrl(urlLike) {
  const url = new URL(urlLike.toString());
  if (url.searchParams.has('key')) url.searchParams.set('key', 'REDACTED');
  return url.toString();
}

function buildPayload(county, rows, tractGeojson, acsYear) {
  const acsByGeoid = new Map();
  for (const row of rows) {
    const geoid = `${row.state}${row.county}${row.tract}`;
    acsByGeoid.set(geoid, computeDirectMetrics(row));
  }

  addCompositeMetrics([...acsByGeoid.values()]);

  let matchedTracts = 0;
  const features = tractGeojson.features.map(feature => {
    const props = feature.properties || {};
    const geoid = String(props.GEOID || props.geoid || `${props.STATE || county.state}${props.COUNTY || county.county}${props.TRACT || ''}`);
    const acs = acsByGeoid.get(geoid) || {};
    if (Object.keys(acs).length) matchedTracts += 1;
    return {
      ...feature,
      id: geoid,
      properties: {
        ...props,
        GEOID: geoid,
        acs
      }
    };
  });

  if (features.length && matchedTracts === 0) {
    const sampleGeoids = features.slice(0, 5).map(feature => feature.properties?.GEOID).join(', ');
    const sampleAcs = [...acsByGeoid.keys()].slice(0, 5).join(', ');
    throw new Error(`TIGERweb geometry did not match ACS tract GEOIDs for ${county.name}. Geometry sample: ${sampleGeoids}. ACS sample: ${sampleAcs}.`);
  }

  return {
    source: 'U.S. Census Bureau ACS 5-year and TIGERweb',
    requestedAcsYear: REQUESTED_ACS_YEAR,
    acsYear,
    state: county.state,
    county: county.county,
    countyId: county.id,
    countyName: county.name,
    generatedAt: new Date().toISOString(),
    matchedTracts,
    metrics: METADATA,
    geojson: { type: 'FeatureCollection', features }
  };
}

function computeDirectMetrics(row) {
  const population = num(row.B01001_001E);
  const childrenCount = sum(row, ['B01001_003E', 'B01001_004E', 'B01001_005E', 'B01001_006E', 'B01001_027E', 'B01001_028E', 'B01001_029E', 'B01001_030E']);
  const seniorCount = sum(row, ['B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E', 'B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E']);
  const childPovertyCount = sum(row, ['B17001_004E', 'B17001_005E', 'B17001_006E', 'B17001_007E', 'B17001_008E', 'B17001_009E', 'B17001_018E', 'B17001_019E', 'B17001_020E', 'B17001_021E', 'B17001_022E', 'B17001_023E']);
  const rentBurdened = sum(row, ['B25070_007E', 'B25070_008E', 'B25070_009E', 'B25070_010E']);
  const limitedEnglish = sum(row, ['C16002_004E', 'C16002_007E', 'C16002_010E', 'C16002_013E']);

  return {
    population,
    poverty: pct(row.B17001_002E, row.B17001_001E),
    childPoverty: pct(childPovertyCount, childrenCount),
    familiesPovertyChildren: pct(row.B17010_002E, row.B17010_001E),
    income: clean(row.B19013_001E),
    noVehicle: pct(row.B08201_002E, row.B08201_001E),
    senior: pct(seniorCount, population),
    children: pct(childrenCount, population),
    unemployment: pct(row.B23025_005E, row.B23025_003E),
    rentBurden: pct(rentBurdened, row.B25070_001E),
    snap: pct(row.B22010_002E, row.B22010_001E),
    noInternet: pct(row.B28002_013E, row.B28002_001E),
    limitedEnglish: pct(limitedEnglish, row.C16002_001E)
  };
}

function addCompositeMetrics(records) {
  const ranges = {};
  for (const metric of DIRECT_METRICS) {
    const values = records.map(record => record[metric]).filter(Number.isFinite);
    ranges[metric] = values.length
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: null, max: null };
  }

  for (const record of records) {
    for (const [composite, parts] of Object.entries(COMPOSITES)) {
      const scores = parts.map(metric => normalize(record[metric], ranges[metric], metric === 'income')).filter(Number.isFinite);
      record[composite] = scores.length ? average(scores) : null;
    }
  }
}

function normalize(value, range, inverse = false) {
  if (!Number.isFinite(value) || !range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return null;
  const span = Math.max(0.0001, range.max - range.min);
  let score = ((value - range.min) / span) * 100;
  if (inverse) score = 100 - score;
  return Math.max(0, Math.min(100, score));
}

function pct(numerator, denominator) {
  const n = num(numerator);
  const d = num(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return (n / d) * 100;
}

function sum(row, keys) {
  return keys.reduce((total, key) => total + (num(row[key]) || 0), 0);
}

function clean(value) {
  const n = num(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
