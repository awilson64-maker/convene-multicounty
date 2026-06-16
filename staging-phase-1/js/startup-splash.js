(function () {
  if (window.__conveneStartupSplashLoaded) return;
  window.__conveneStartupSplashLoaded = true;

  function byId(id) {
    return document.getElementById(id);
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-convene-splash-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../assets/splash.css';
    link.setAttribute('data-convene-splash-css', 'true');
    document.head.appendChild(link);
  }

  function ensureSplash() {
    var existing = byId('conveneSplash');
    if (existing) return existing;

    var splash = document.createElement('div');
    splash.id = 'conveneSplash';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-live', 'polite');
    splash.innerHTML = [
      '<div class="convene-splash-card">',
      '  <div class="convene-splash-mark" aria-hidden="true">',
      '    <div class="convene-splash-wi"><svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg"><path d="M65 2c12 8 12 19 22 24 9 5 20 8 23 19 4 14-11 23-14 35-4 14 8 24-4 30-13 6-28-7-42-7-16 0-27 9-38 1-10-8 2-22-3-35C5 58-4 48 4 38c8-10 24-5 35-12C49 20 51 7 65 2z" fill="#6b7280"/></svg></div>',
      '    <div class="convene-splash-network"><svg viewBox="0 0 160 96" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M25 20 72 54 119 20M72 54 132 70M72 54 48 78M72 54 92 80M25 20 48 78M119 20 92 80"/></g><g fill="#fff"><circle cx="25" cy="20" r="12"/><circle cx="119" cy="20" r="12"/><circle cx="72" cy="54" r="12"/><circle cx="132" cy="70" r="12"/><circle cx="48" cy="78" r="12"/><circle cx="92" cy="80" r="12"/></g></svg></div>',
      '    <span class="convene-splash-orbit"></span>',
      '    <span class="convene-splash-person left"></span>',
      '    <span class="convene-splash-person right"></span>',
      '    <span class="convene-splash-person center"></span>',
      '  </div>',
      '  <h1 class="convene-splash-title"><span class="black">CON</span><span class="gray">V</span><span class="red">ENE</span></h1>',
      '  <div class="convene-splash-subtitle">Community Organizations, Needs,<br>Visualization, Engagement &amp; Network Explorer</div>',
      '  <div class="convene-splash-loading"><span class="convene-splash-spinner" aria-hidden="true"></span><span>Loading CONVENE...</span></div>',
      '</div>'
    ].join('');
    document.body.insertBefore(splash, document.body.firstChild);
    return splash;
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
    window.setTimeout(hideSplash, 950);
  }

  ensureStylesheet();
  ensureSplash();

  if (document.readyState === 'complete') {
    readySoon();
  } else {
    window.addEventListener('load', readySoon);
    window.setTimeout(hideSplash, 3000);
  }
})();
