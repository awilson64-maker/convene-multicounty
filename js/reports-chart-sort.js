(function () {
  if (window.__conveneReportsChartSortLoaded) return;
  window.__conveneReportsChartSortLoaded = true;

  function installPolishStyles() {
    if (document.getElementById('reportsCalloutPolishStyles')) return;
    var style = document.createElement('style');
    style.id = 'reportsCalloutPolishStyles';
    style.textContent = '.report-callout b:first-child { font-weight: 400; }';
    document.head.appendChild(style);
  }

  function numberFromRow(row) {
    var strong = row.querySelector('b');
    if (!strong) return 0;
    var raw = String(strong.textContent || '').replace(/[^0-9.-]/g, '');
    var value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  function sortChartBox(box) {
    var rows = Array.prototype.slice.call(box.querySelectorAll('.bar-row'));
    if (rows.length < 2) return;
    var sorted = rows.slice().sort(function (a, b) {
      return numberFromRow(b) - numberFromRow(a);
    });
    for (var i = 0; i < sorted.length; i += 1) {
      box.appendChild(sorted[i]);
    }
  }

  function sortReportCharts() {
    var report = document.getElementById('reportOutput');
    if (!report) return;
    var boxes = report.querySelectorAll('.chart-box');
    for (var i = 0; i < boxes.length; i += 1) {
      sortChartBox(boxes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installPolishStyles();
      sortReportCharts();
    });
  } else {
    installPolishStyles();
    sortReportCharts();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.closest && target.closest('#generateReportBtn')) {
      setTimeout(sortReportCharts, 250);
      setTimeout(sortReportCharts, 800);
    }
  }, true);

  setInterval(sortReportCharts, 1500);
})();