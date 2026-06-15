window.ConveneCensus = (() => {
  async function loadCountyCensus(county) {
    try {
      const response = await fetch(county.censusFile, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      return { configured: false, error: err.message, features: [] };
    }
  }

  async function renderCountyCensus(county, panel) {
    const data = await loadCountyCensus(county);
    const features = Array.isArray(data.features) ? data.features : [];
    if (!features.length) {
      panel.innerHTML = `<div class="notice"><strong>${county.name} census data is not configured yet.</strong><p>The multi-county shell is ready, but this county needs a tract-level census JSON file before the gap lens can calculate priority signals.</p><p>Expected file: <code>${county.censusFile}</code></p></div>`;
      return;
    }
    panel.innerHTML = `<h3>${county.name} census file loaded</h3><p>${features.length} tract records found. Priority scoring logic will be ported from the FDL working edition into this reusable module.</p>`;
  }

  return { loadCountyCensus, renderCountyCensus };
})();
