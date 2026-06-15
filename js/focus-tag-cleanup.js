(() => {
  if (window.__conveneFocusTagCleanupLoaded) return;
  window.__conveneFocusTagCleanupLoaded = true;

  const CANONICAL_TAGS = [
    'Basic Needs',
    'Food Security',
    'Housing',
    'Transportation',
    'Health Care',
    'Behavioral Health',
    'Substance Use / Recovery',
    'Aging / Disability',
    'Youth / Family',
    'Education / Employment',
    'Financial Stability',
    'Legal / Advocacy',
    'Veterans',
    'Community Engagement',
    'Civic / Government',
    'Disability Services',
    'Immigration / Newcomer Support',
    'Domestic Violence / Safety',
    'Child Care',
    'Arts / Culture'
  ];

  const state = {
    preview: null,
    selected: new Set(),
    filter: ''
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    installStyles();
    installTool();
    bindEvents();
    setTimeout(renderTagList, 350);
    document.getElementById('countySelect')?.addEventListener('change', () => {
      state.selected.clear();
      state.preview = null;
      setTimeout(renderTagList, 250);
    });
  }

  function installTool() {
    if (document.getElementById('focusTagCleanupCard')) return;
    const backup = document.getElementById('backupView');
    if (!backup) return;

    const card = document.createElement('div');
    card.id = 'focusTagCleanupCard';
    card.className = 'card focus-cleanup-card';
    card.innerHTML = `
      <div class="cleanup-header">
        <div>
          <h3>Focus Tag Cleanup</h3>
          <p>Merge, rename, or delete messy focus tags across the active county workspace. Preview changes before applying.</p>
        </div>
        <button id="refreshFocusTagsBtn" type="button">Refresh tags</button>
      </div>

      <div class="cleanup-grid">
        <section>
          <div class="cleanup-toolbar">
            <input id="focusTagSearch" type="search" placeholder="Search existing tags..." />
            <button id="selectVisibleTagsBtn" type="button">Select visible</button>
            <button id="clearSelectedTagsBtn" type="button">Clear selection</button>
          </div>
          <div id="focusTagSummary" class="muted small"></div>
          <div id="focusTagList" class="focus-tag-list"></div>
        </section>

        <section>
          <label class="cleanup-label">Merge / rename selected tags into
            <input id="focusTagTarget" list="canonicalFocusTags" placeholder="Example: Food Security" />
          </label>
          <datalist id="canonicalFocusTags">
            ${CANONICAL_TAGS.map(tag => `<option value="${escapeAttr(tag)}"></option>`).join('')}
          </datalist>

          <div class="canonical-tags">
            ${CANONICAL_TAGS.map(tag => `<button type="button" class="canonical-tag-btn" data-canonical-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join('')}
          </div>

          <div class="cleanup-actions">
            <button id="previewMergeTagsBtn" type="button" class="primary">Preview merge / rename</button>
            <button id="previewDeleteTagsBtn" type="button">Preview delete selected tags</button>
            <button id="applyFocusTagChangesBtn" type="button" class="danger" disabled>Apply Previewed Changes</button>
          </div>
          <p class="muted small">Tip: select several messy variants like “Food”, “Food pantry”, and “food security”, then merge them into “Food Security”.</p>
        </section>
      </div>

      <div id="focusTagPreview" class="focus-tag-preview"></div>
    `;

    const csvCard = backup.querySelector('#csvPreview')?.closest('.card');
    if (csvCard?.parentNode) csvCard.parentNode.insertBefore(card, csvCard.nextSibling);
    else backup.appendChild(card);
  }

  function installStyles() {
    if (document.getElementById('focusTagCleanupStyles')) return;
    const style = document.createElement('style');
    style.id = 'focusTagCleanupStyles';
    style.textContent = `
      .focus-cleanup-card { margin-top: 16px; }
      .cleanup-header { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
      .cleanup-header h3 { margin-bottom: 4px; }
      .cleanup-header p { margin-top: 0; color: var(--muted); }
      .cleanup-grid { display: grid; grid-template-columns: minmax(300px, 1.15fr) minmax(280px, .85fr); gap: 18px; align-items: start; }
      .cleanup-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
      .cleanup-toolbar input { flex: 1 1 210px; }
      .cleanup-label { display: grid; gap: 6px; font-weight: 700; }
      .cleanup-label input { font-weight: 400; }
      .focus-tag-list { max-height: 340px; overflow-y: auto; border: 1px solid var(--line); border-radius: 14px; background: #fff; padding: 8px; display: grid; gap: 6px; }
      .focus-tag-row { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; border: 1px solid #edf0f2; border-radius: 12px; padding: 8px 10px; background: #fafafa; }
      .focus-tag-row strong { font-size: .92rem; }
      .focus-tag-row span { color: var(--muted); font-size: .82rem; }
      .canonical-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; max-height: 150px; overflow-y: auto; padding-right: 4px; }
      .canonical-tag-btn { border: 1px solid var(--line); background: #f8fafc; border-radius: 999px; padding: 5px 9px; font-size: .8rem; font-weight: 700; }
      .canonical-tag-btn:hover { background: #fff5f5; border-color: var(--brand); }
      .cleanup-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
      .focus-tag-preview { margin-top: 14px; }
      .preview-summary { border-left: 5px solid var(--brand); background: #fff7f7; padding: 10px 12px; border-radius: 12px; margin-bottom: 10px; }
      .preview-table-wrap { max-height: 340px; overflow: auto; border: 1px solid var(--line); border-radius: 12px; }
      .preview-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
      .preview-table th, .preview-table td { border-bottom: 1px solid var(--line); padding: 8px; text-align: left; vertical-align: top; }
      .preview-table th { background: #f8fafc; position: sticky; top: 0; }
      .tag-before { color: #7f1d1d; }
      .tag-after { color: #166534; font-weight: 700; }
      @media (max-width: 900px) { .cleanup-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function bindEvents() {
    document.body.addEventListener('input', event => {
      if (event.target.matches('#focusTagSearch')) {
        state.filter = event.target.value.toLowerCase().trim();
        renderTagList();
      }
    });

    document.body.addEventListener('change', event => {
      const box = event.target.closest('[data-focus-cleanup-tag]');
      if (!box) return;
      const tag = box.dataset.focusCleanupTag;
      if (box.checked) state.selected.add(tag);
      else state.selected.delete(tag);
      state.preview = null;
      renderPreview();
      updateApplyButton();
      updateSummary();
    });

    document.body.addEventListener('click', event => {
      const canonical = event.target.closest('[data-canonical-tag]');
      if (canonical) {
        document.getElementById('focusTagTarget').value = canonical.dataset.canonicalTag;
        return;
      }

      if (event.target.closest('#refreshFocusTagsBtn')) {
        state.preview = null;
        renderTagList();
        renderPreview();
        return;
      }

      if (event.target.closest('#selectVisibleTagsBtn')) {
        visibleTags().forEach(row => state.selected.add(row.tag));
        state.preview = null;
        renderTagList();
        renderPreview();
        return;
      }

      if (event.target.closest('#clearSelectedTagsBtn')) {
        state.selected.clear();
        state.preview = null;
        renderTagList();
        renderPreview();
        return;
      }

      if (event.target.closest('#previewMergeTagsBtn')) {
        previewTagAction('merge');
        return;
      }

      if (event.target.closest('#previewDeleteTagsBtn')) {
        previewTagAction('delete');
        return;
      }

      if (event.target.closest('#applyFocusTagChangesBtn')) {
        applyPreview();
      }
    });
  }

  function renderTagList() {
    installTool();
    const list = document.getElementById('focusTagList');
    if (!list) return;

    const rows = visibleTags();
    list.innerHTML = rows.length ? rows.map(row => `
      <label class="focus-tag-row">
        <input type="checkbox" data-focus-cleanup-tag="${escapeAttr(row.tag)}" ${state.selected.has(row.tag) ? 'checked' : ''} />
        <strong>${escapeHtml(row.tag)}</strong>
        <span>${row.count} record${row.count === 1 ? '' : 's'}</span>
      </label>
    `).join('') : '<p class="muted">No focus tags match the current filter.</p>';

    updateSummary();
    updateApplyButton();
  }

  function visibleTags() {
    const rows = tagCounts();
    if (!state.filter) return rows;
    return rows.filter(row => row.tag.toLowerCase().includes(state.filter));
  }

  function updateSummary() {
    const summary = document.getElementById('focusTagSummary');
    if (!summary) return;
    const total = tagCounts().length;
    const selected = state.selected.size;
    const shown = visibleTags().length;
    summary.textContent = `${total} unique focus tag${total === 1 ? '' : 's'} found. ${shown} shown. ${selected} selected.`;
  }

  function tagCounts() {
    const counts = new Map();
    workspace().organizations.forEach(org => {
      splitTags(org).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  function previewTagAction(action) {
    const selected = [...state.selected];
    const target = cleanTag(document.getElementById('focusTagTarget')?.value || '');

    if (!selected.length) {
      alert('Select at least one focus tag first.');
      return;
    }
    if (action === 'merge' && !target) {
      alert('Enter the cleaned-up tag name you want to merge into.');
      return;
    }

    const selectedSet = new Set(selected);
    const rows = [];
    const data = workspace();
    data.organizations.forEach(org => {
      const beforeTags = splitTags(org);
      if (!beforeTags.some(tag => selectedSet.has(tag))) return;
      const afterTags = action === 'delete'
        ? dedupeTags(beforeTags.filter(tag => !selectedSet.has(tag)))
        : dedupeTags(beforeTags.map(tag => selectedSet.has(tag) ? target : tag));
      const before = beforeTags.join(', ');
      const after = afterTags.join(', ');
      if (before !== after) rows.push({ id: org.id, name: org.name || 'Unnamed organization', before, after });
    });

    state.preview = { action, target, selected, rows };
    renderPreview();
    updateApplyButton();
  }

  function renderPreview() {
    const box = document.getElementById('focusTagPreview');
    if (!box) return;
    const preview = state.preview;
    if (!preview) {
      box.innerHTML = '<p class="muted small">No preview yet. Select tags, choose an action, and preview the cleanup before applying.</p>';
      return;
    }

    if (!preview.rows.length) {
      box.innerHTML = '<div class="preview-summary">No organization records would change from this action.</div>';
      return;
    }

    const actionLabel = preview.action === 'delete'
      ? `Delete selected tag${preview.selected.length === 1 ? '' : 's'}`
      : `Merge ${preview.selected.length} selected tag${preview.selected.length === 1 ? '' : 's'} into “${escapeHtml(preview.target)}”`;

    box.innerHTML = `
      <div class="preview-summary"><strong>${actionLabel}</strong><br>${preview.rows.length} organization record${preview.rows.length === 1 ? '' : 's'} would change.</div>
      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead><tr><th>Organization</th><th>Before</th><th>After</th></tr></thead>
          <tbody>${preview.rows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td class="tag-before">${escapeHtml(row.before || 'No tags')}</td><td class="tag-after">${escapeHtml(row.after || 'No tags')}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  }

  function updateApplyButton() {
    const button = document.getElementById('applyFocusTagChangesBtn');
    if (!button) return;
    button.disabled = !state.preview || !state.preview.rows.length;
  }

  function applyPreview() {
    const preview = state.preview;
    if (!preview || !preview.rows.length) return;

    const ok = confirm(`Apply focus tag cleanup to ${preview.rows.length} organization record${preview.rows.length === 1 ? '' : 's'}? Export a backup first if you have not already.`);
    if (!ok) return;

    const data = workspaceRaw();
    const byId = new Map(preview.rows.map(row => [row.id, row.after]));
    data.organizations = (data.organizations || []).map(org => {
      if (!byId.has(org.id)) return org;
      const updated = { ...org, focus: byId.get(org.id) };
      if (Object.prototype.hasOwnProperty.call(updated, 'tags')) updated.tags = byId.get(org.id);
      return updated;
    });

    ConveneStorage.saveWorkspace(activeCounty(), data);
    state.preview = null;
    state.selected.clear();
    document.getElementById('focusTagTarget').value = '';
    renderTagList();
    renderPreview();

    const select = document.getElementById('countySelect');
    select?.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(renderTagList, 350);
    alert('Focus tag cleanup applied. The active county workspace has been refreshed.');
  }

  function activeCounty() {
    const id = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES?.[id] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY] || { id, storagePrefix: `convene:${id}`, name: id };
  }

  function workspaceRaw() {
    return ConveneStorage?.loadWorkspace ? ConveneStorage.loadWorkspace(activeCounty()) : { organizations: [], contacts: [], activities: [], relationships: [] };
  }

  function workspace() {
    const raw = workspaceRaw();
    return {
      ...raw,
      organizations: (raw.organizations || []).map(org => ({
        ...org,
        id: org.id || '',
        name: org.name || org.organization || '',
        focus: org.focus || org.tags || ''
      }))
    };
  }

  function splitTags(org) {
    return dedupeTags(String(org.focus || org.tags || '').split(',').map(cleanTag).filter(Boolean));
  }

  function cleanTag(tag) {
    return String(tag || '').replace(/\s+/g, ' ').trim();
  }

  function dedupeTags(tags) {
    const seen = new Set();
    const output = [];
    tags.forEach(tag => {
      const cleaned = cleanTag(tag);
      const key = cleaned.toLowerCase();
      if (!cleaned || seen.has(key)) return;
      seen.add(key);
      output.push(cleaned);
    });
    return output;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }
})();