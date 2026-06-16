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

(function loadMapBehaviorPatches() {
  if (window.__conveneMapBehaviorPatchScriptLoaded) return;
  window.__conveneMapBehaviorPatchScriptLoaded = true;
  if (!window.L) return;

  const src = 'js/map-behavior-patches.js';
  if (document.querySelector('script[data-convene-map-behavior-patches]')) return;

  if (document.currentScript && document.readyState === 'loading') {
    document.write('<script src="' + src + '" data-convene-map-behavior-patches="true"><\/script>');
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.defer = false;
  script.setAttribute('data-convene-map-behavior-patches', 'true');
  document.head.appendChild(script);
})();
