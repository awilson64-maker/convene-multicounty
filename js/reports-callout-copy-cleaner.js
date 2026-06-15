(function () {
  if (window.__conveneReportsCalloutCopyCleanerLoaded) return;
  window.__conveneReportsCalloutCopyCleanerLoaded = true;

  function cleanCallouts() {
    var callouts = document.querySelectorAll('.report-callout p');
    for (var i = 0; i < callouts.length; i += 1) {
      var p = callouts[i];
      var text = p.textContent || '';
      if (text.indexOf('The list is now ordered by practical attention.') === -1) continue;

      var cleaned = text.replace('The list is now ordered by practical attention.', '').trim();
      p.innerHTML = escapeHtml(cleaned);
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }

  document.addEventListener('click', function () {
    setTimeout(cleanCallouts, 100);
    setTimeout(cleanCallouts, 600);
  }, true);

  setInterval(cleanCallouts, 1200);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanCallouts);
  } else {
    cleanCallouts();
  }
})();