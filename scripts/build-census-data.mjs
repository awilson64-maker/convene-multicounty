import fs from 'node:fs/promises';
import path from 'node:path';

const COUNTIES = {
  fdl: { id: 'fdl', name: 'Fond du Lac County', state: '55', county: '039', out: 'data/fdl/census-tracts.json' },
  waupaca: { id: 'waupaca', name: 'Waupaca County', state: '55', county: '135', out: 'data/waupaca/census-tracts.json' }
};

const ACS_YEAR = process.env.ACS_YEAR || '2024';

const VARS = [
  'NAME',
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

  for (const county of selected) {
    console.log(`Building ${county.name}...`);
    const acsRows = await fetchAcs(county);
    const tracts = await fetchTracts(county);
    const payload = buildPayload(county, acsRows, tracts);
    await fs.mkdir(path.dirname(county.out), { recursive: true });
    await fs.writeFile(county.out, JSON.stringify(payload));
    console.log(`Wrote ${county.out} with ${payload.geojson.features.length} tracts.`);
  }
}

async function fetchAcs(county) {
  const get = VARS.join(',');
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=${encodeURIComponent(get)}&for=tract:*&in=state:${county.state}%20county:${county.county}`;
  const json = await fetchJson(url);
  const [header, ...rows] = json;
  return rows.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
}

async function fetchTracts(county) {
  const where = encodeURIComponent(`STATE='${county.state}' AND COUNTY='${county.county}'`);
  const outFields = encodeURIComponent('GEOID,STATE,COUNTY,TRACT,NAME');
  const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/8/query?where=${where}&outFields=${outFields}&outSR=4326&f=geojson`;
  const json = await fetchJson(url);
  if (!json.features?.length) throw new Error(`No TIGERweb tract features returned for ${county.name}.`);
  return json;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'CONVENE census builder' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fetch failed ${response.status}: ${url}\n${text.slice(0, 500)}`);
  }
  return response.json();
}

function buildPayload(county, rows, tractGeojson) {
  const acsByGeoid = new Map();
  for (const row of rows) {
    const geoid = `${row.state}${row.county}${row.tract}`;
    acsByGeoid.set(geoid, computeDirectMetrics(row));
  }

  addCompositeMetrics([...acsByGeoid.values()]);

  const features = tractGeojson.features.map(feature => {
    const props = feature.properties || {};
    const geoid = String(props.GEOID || props.geoid || `${props.STATE || county.state}${props.COUNTY || county.county}${props.TRACT || ''}`);
    const acs = acsByGeoid.get(geoid) || {};
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

  return {
    source: 'U.S. Census Bureau ACS 5-year and TIGERweb',
    acsYear: ACS_YEAR,
    state: county.state,
    county: county.county,
    countyId: county.id,
    countyName: county.name,
    generatedAt: new Date().toISOString(),
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
    ranges[metric] = { min: Math.min(...values), max: Math.max(...values) };
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

main().catch(error => {
  console.error(error);
  process.exit(1);
});
