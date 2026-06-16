(function () {
  if (window.__conveneMapBehaviorBridgeLoaded) return;
  window.__conveneMapBehaviorBridgeLoaded = true;

  var src = 'staging-phase-1/js/map-behavior-patches.js';
  if (document.querySelector('script[data-convene-map-behavior-bridge]')) return;

  var script = document.createElement('script');
  script.src = src;
  script.defer = false;
  script.setAttribute('data-convene-map-behavior-bridge', 'true');
  document.head.appendChild(script);
})();
