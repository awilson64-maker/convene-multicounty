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
