window.__conveneGapSortFixLoaded = window.__conveneGapSortFixLoaded || false;
if (!window.__conveneGapSortFixLoaded) {
  window.__conveneGapSortFixLoaded = true;
  setInterval(conveneSortGapReportRows, 900);
}

function conveneSortGapReportRows() {
  var output = document.getElementById('reportOutput');
  if (!output) return;
  var titleNode = output.querySelector('.report-cover h1');
  if (conveneText(titleNode) !== 'geographic access / gap report') return;

  var section = conveneFindReportSection(output, 'recommended focus order');
  if (!section) return;
  var table = section.querySelector('table');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  if (!tbody || tbody.getAttribute('data-sort-fixed') === 'yes') return;

  var rowNodes = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var rows = rowNodes.map(function(row) {
    var cells = Array.prototype.slice.call(row.children);
    return {
      row: row,
      tract: conveneText(cells[1]),
      category: conveneText(cells[2]),
      rank: conveneCategoryRank(conveneText(cells[2])),
      need: conveneNumber(cells[5]),
      access: conveneNumber(cells[6]),
      focus: conveneNumber(cells[7])
    };
  });

  rows.sort(function(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.focus !== b.focus) return b.focus - a.focus;
    if (a.access !== b.access) return b.access - a.access;
    if (a.need !== b.need) return b.need - a.need;
    return a.tract.localeCompare(b.tract);
  });

  rows.forEach(function(item, index) {
    item.row.children[0].textContent = String(index + 1);
    tbody.appendChild(item.row);
  });
  tbody.setAttribute('data-sort-fixed', 'yes');
}

function conveneCategoryRank(category) {
  if (category === 'focus first') return 1;
  if (category === 'investigate') return 2;
  if (category === 'monitor geography') return 3;
  if (category === 'capacity check') return 4;
  if (category === 'maybe someday') return 5;
  return 99;
}

function conveneFindReportSection(root, headingText) {
  var sections = Array.prototype.slice.call(root.querySelectorAll('.report-section'));
  for (var i = 0; i < sections.length; i++) {
    var h2 = sections[i].querySelector('h2');
    if (conveneText(h2) === headingText) return sections[i];
  }
  return null;
}

function conveneText(node) {
  return String(node ? node.textContent : '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function conveneNumber(node) {
  var match = String(node ? node.textContent : '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}