(() => {
  if (window.__conveneOrgFocusTagsLoaded) return;
  window.__conveneOrgFocusTagsLoaded = true;

  const state = {
    activeTag: '',
    observerStarted: false,
    applying: false,
    booted: false
  };

  bootWhenReady();

  function bootWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    installStyles();
    installFilterBar();
    bindFilterEvents();
    observeOrgList();
    setTimeout(refreshOrgTags, 150);
    setTimeout(refreshOrgTags, 550);
  }

  function installStyles() {
    if (document.getElementById('conveneOrgFocusTagStyles')) return;
    const style = document.createElement('style');
    style.id = 'conveneOrgFocusTagStyles';
    style.textContent = `
      .org-focus-filter-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
        grid-column: 1 / -1;
      }
      .org-focus-filter-label {
        font-size: .86rem;
        color: var(--muted);
        font-weight: 700;
      }
      .org-focus-active {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid #f0b6b8;
        background: #fff1f2;
        color: var(--brand-dark);
        border-radius: 999px;
        padding: 5px 10px;
        font-size: .84rem;
        font-weight: 800;
      }
      .org-focus-tag-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 9px;
        max-width: 100%;
      }
      .org-focus-tag-heading {
        color: var(--muted);
        font-size: .76rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .04em;
        margin-right: 1px;
      }
      .org-focus-tag-chip {
        border: 1px solid #d6d3d1;
        background: #fafaf9;
        color: #292524;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: .78rem;
        line-height: 1.1;
        cursor: pointer;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .org-focus-tag-chip:hover,
      .org-focus-tag-chip.active {
        border-color: var(--brand);
        background: #fff1f2;
        color: var(--brand-dark);
      }
      .org-focus-hidden { display: none !important; }
      .org-focus-count {
        color: var(--muted);
        font-size: .84rem;
      }
    `;
    document.head.appendChild(style);
  }

  function installFilterBar() {
    const filters = document.querySelector('#orgView .filters');
    if (!filters || document.getElementById('orgFocusFilterBar')) return;
    const bar = document.createElement('div');
    bar.id = 'orgFocusFilterBar';
    bar.className = 'org-focus-filter-bar';
    bar.innerHTML = `
      <span class="org-focus-filter-label">Focus tag filter</span>
      <span id="orgFocusActive" class="org-focus-active" style="display:none"></span>
      <span id="orgFocusCount" class="org-focus-count"></span>
      <button type="button" id="orgClearFiltersBtn">Clear filters</button>
    `;
    filters.appendChild(bar);
    document.getElementById('orgClearFiltersBtn')?.addEventListener('click', clearOrgFilters);
  }

  function bindFilterEvents() {
    document.getElementById('countySelect')?.addEventListener('change', () => {
      state.activeTag = '';
      setTimeout(() => {
        installFilterBar();
        observeOrgList();
        refreshOrgTags();
      }, 250);
    });

    document.querySelector('[data-view="orgView"]')?.addEventListener('click', () => setTimeout(refreshOrgTags, 250));

    ['orgSearchBox', 'orgTypeFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(id === 'orgTypeFilter' ? 'change' : 'input', () => setTimeout(refreshOrgTags, 80));
    });
  }

  function observeOrgList() {
    if (state.observerStarted) return;
    const list = document.getElementById('orgList');
    if (!list) return;
    state.observerStarted = true;
    const observer = new MutationObserver(() => {
      if (state.applying) return;
      setTimeout(refreshOrgTags, 60);
    });
    observer.observe(list, { childList: true, subtree: true });
  }

  function refreshOrgTags() {
    const list = document.getElementById('orgList');
    if (!list) return;
    state.applying = true;
    try {
      installFilterBar();
      const data = workspace();
      const orgById = new Map((data.organizations || []).map(org => [org.id, org]));
      const orgByName = new Map((data.organizations || []).map(org => [norm(org.name), org]));

      const items = [...list.querySelectorAll('.record-item')];
      let visible = 0;
      items.forEach(item => {
        const org = findOrgForItem(item, orgById, orgByName);
        const tags = focusTags(org);
        renderTagsForItem(item, tags);
        const matchesTag = !state.activeTag || tags.some(tag => norm(tag) === norm(state.activeTag));
        item.classList.toggle('org-focus-hidden', !matchesTag);
        if (matchesTag) visible += 1;
      });
      renderActiveFilter(items.length, visible);
    } finally {
      state.applying = false;
    }
  }

  function findOrgForItem(item, orgById, orgByName) {
    const editButton = item.querySelector('[data-edit-org]');
    if (editButton?.dataset?.editOrg && orgById.has(editButton.dataset.editOrg)) return orgById.get(editButton.dataset.editOrg);
    const title = item.querySelector('h3')?.textContent || '';
    return orgByName.get(norm(title));
  }

  function renderTagsForItem(item, tags) {
    let row = item.querySelector('.org-focus-tag-row');
    if (!tags.length) {
      row?.remove();
      return;
    }
    if (!row) {
      row = document.createElement('div');
      row.className = 'org-focus-tag-row';
      const content = item.querySelector('h3')?.parentElement || item.firstElementChild;
      content?.appendChild(row);
    }
    row.innerHTML = `<span class="org-focus-tag-heading">Focus</span>${tags.map(tag => `<button type="button" class="org-focus-tag-chip ${norm(tag) === norm(state.activeTag) ? 'active' : ''}" data-org-focus-tag="${escapeAttr(tag)}" title="Filter by ${escapeAttr(tag)}">${escapeHtml(tag)}</button>`).join('')}`;
    row.querySelectorAll('[data-org-focus-tag]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        applyTagFilter(btn.dataset.orgFocusTag || '');
      });
    });
  }

  function applyTagFilter(tag) {
    state.activeTag = tag;
    const search = document.getElementById('orgSearchBox');
    const type = document.getElementById('orgTypeFilter');
    let needsRerender = false;
    if (search && search.value) {
      search.value = '';
      needsRerender = true;
    }
    if (type && type.value) {
      type.value = '';
      needsRerender = true;
    }
    if (needsRerender) {
      search?.dispatchEvent(new Event('input', { bubbles: true }));
      type?.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTimeout(refreshOrgTags, 90);
  }

  function clearOrgFilters() {
    state.activeTag = '';
    const search = document.getElementById('orgSearchBox');
    const type = document.getElementById('orgTypeFilter');
    if (search) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (type) {
      type.value = '';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setTimeout(refreshOrgTags, 90);
  }

  function renderActiveFilter(total, visible) {
    const active = document.getElementById('orgFocusActive');
    const count = document.getElementById('orgFocusCount');
    const clear = document.getElementById('orgClearFiltersBtn');
    if (active) {
      active.style.display = state.activeTag ? '' : 'none';
      active.textContent = state.activeTag ? `Tag: ${state.activeTag}` : '';
    }
    if (count) {
      count.textContent = state.activeTag
        ? `${visible} organization${visible === 1 ? '' : 's'} with this focus tag`
        : total ? `${total} organization${total === 1 ? '' : 's'} in the current list` : '';
    }
    if (clear) clear.style.display = (state.activeTag || document.getElementById('orgSearchBox')?.value || document.getElementById('orgTypeFilter')?.value) ? '' : 'none';
  }

  function workspace() {
    const county = activeCounty();
    return window.ConveneStorage?.loadWorkspace(county) || { organizations: [] };
  }

  function activeCounty() {
    const selected = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY;
    return window.CONVENE_COUNTIES?.[selected] || window.CONVENE_COUNTIES?.[window.CONVENE_DEFAULT_COUNTY];
  }

  function focusTags(org) {
    const text = org?.focus || org?.tags || '';
    return [...new Set(String(text).split(/[;,|]/).map(tag => tag.trim()).filter(Boolean))];
  }

  function norm(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();