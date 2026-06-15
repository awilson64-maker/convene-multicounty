window.ConveneAccess = (() => {
  function readCountyFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('county');
  }

  function allowedCountyId(requestedId) {
    const counties = window.CONVENE_COUNTIES || {};
    return counties[requestedId] ? requestedId : window.CONVENE_DEFAULT_COUNTY;
  }

  function activeCountyId() {
    const urlCounty = readCountyFromUrl();
    const savedCounty = localStorage.getItem('convene:lastCounty');
    return allowedCountyId(urlCounty || savedCounty || window.CONVENE_DEFAULT_COUNTY);
  }

  function setActiveCountyId(countyId) {
    localStorage.setItem('convene:lastCounty', allowedCountyId(countyId));
  }

  return { activeCountyId, setActiveCountyId, allowedCountyId };
})();

(() => {
  if (!window.L || window.__conveneCensusFitPatchLoaded) return;
  window.__conveneCensusFitPatchLoaded = true;

  const originalMapFactory = L.map;

  L.map = function conveneCensusFitMapFactory() {
    const map = originalMapFactory.apply(this, arguments);
    const rawTarget = arguments[0];
    const targetId = typeof rawTarget === 'string' ? rawTarget : rawTarget?.id;

    if (targetId === 'censusMap' && !map.__conveneCensusFitPatched) {
      map.__conveneCensusFitPatched = true;
      const originalFitBounds = map.fitBounds;

      map.fitBounds = function conveneCensusFitBounds(bounds, options = {}) {
        const nextOptions = { ...(options || {}) };
        if (nextOptions.maxZoom == null) {
          const county = activeCounty();
          nextOptions.maxZoom = Number(county?.censusFitMaxZoom ?? county?.mapZoom ?? 10);
        }
        return originalFitBounds.call(this, bounds, nextOptions);
      };
    }

    return map;
  };

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }
})();
