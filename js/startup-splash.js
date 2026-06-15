(function () {
  if (window.__conveneStartupSplashLoaded) return;
  window.__conveneStartupSplashLoaded = true;

  function byId(id) {
    return document.getElementById(id);
  }

  function hideSplash() {
    var splash = byId('conveneSplash');
    if (!splash || splash.classList.contains('splash-hidden')) return;
    splash.classList.add('splash-hidden');
    window.setTimeout(function () {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 650);
  }

  function readySoon() {
    window.setTimeout(hideSplash, 700);
  }

  if (document.readyState === 'complete') {
    readySoon();
  } else {
    window.addEventListener('load', readySoon);
    window.setTimeout(hideSplash, 2600);
  }
})();
