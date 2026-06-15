(function () {
  if (window.__conveneReportsCalloutPolishLoaded) return;
  window.__conveneReportsCalloutPolishLoaded = true;

  function installStyle() {
    if (document.getElementById('reportsCalloutPolishStyles')) return;
    var style = document.createElement('style');
    style.id = 'reportsCalloutPolishStyles';
    style.textContent = '.report-callout b:first-child { font-weight: 400; }';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyle);
  } else {
    installStyle();
  }
})();