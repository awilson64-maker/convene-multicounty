(function () {
  if (!window.CONVENE_COUNTIES) return;

  Object.keys(window.CONVENE_COUNTIES).forEach(function (countyId) {
    var county = window.CONVENE_COUNTIES[countyId];
    if (!county) return;

    if (county.censusFile && county.censusFile.indexOf('../') !== 0 && county.censusFile.indexOf('http') !== 0) {
      county.censusFile = '../' + county.censusFile;
    }

    if (county.boundaryFile && county.boundaryFile.indexOf('../') !== 0 && county.boundaryFile.indexOf('http') !== 0) {
      county.boundaryFile = '../' + county.boundaryFile;
    }
  });
})();
