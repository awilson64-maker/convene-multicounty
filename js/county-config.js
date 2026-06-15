window.CONVENE_COUNTIES = {
  fdl: {
    id: 'fdl',
    name: 'Fond du Lac County',
    state: 'Wisconsin',
    stateCode: '55',
    countyCode: '039',
    mapCenter: [43.773, -88.447],
    mapZoom: 10,
    storagePrefix: 'convene:fdl',
    censusFile: 'data/fdl/census-tracts.json',
    boundaryFile: 'data/fdl/boundary.geojson',
    description: 'Fond du Lac County profile for testing the multi-county framework without touching the working FDL CRM.'
  },
  waupaca: {
    id: 'waupaca',
    name: 'Waupaca County',
    state: 'Wisconsin',
    stateCode: '55',
    countyCode: '135',
    mapCenter: [44.47, -88.96],
    mapZoom: 10,
    storagePrefix: 'convene:waupaca',
    censusFile: 'data/waupaca/census-tracts.json',
    boundaryFile: 'data/waupaca/boundary.geojson',
    description: 'Waupaca County profile for the first external educator/county test case.'
  }
};

window.CONVENE_DEFAULT_COUNTY = 'fdl';
