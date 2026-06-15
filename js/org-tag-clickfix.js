(() => {
  if (window.__conveneOrgTagClickFixLoaded) return;
  window.__conveneOrgTagClickFixLoaded = true;

  let activeTag = '';

  document.addEventListener('pointerdown', handleTagActivation, true);
  document.addEventListener('mousedown', handleTagActivation, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#orgClearFiltersBtn')) {
      activeTag = '';
      setTimeout(syncFilterBar, 80);
    }
  }, true);

  function handleTagActivation(event) {
    const chip = event.target.closest('.org-focus-tag-chip, [data-org-focus-tag]');
    if (!chip || !document.getElementById('orgView')?.contains(chip)) return;
    const tag = chip.getAttribute('data-org-focus-tag') || chip.textContent || '';
    if (!tag.trim()) return;
    activeTag = tag.trim();
    const search = document.getElementById('orgSearchBox');
    const type = document.getElementById('orgTypeFilter');
    if (type) {
      type.value = '';
      type.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (search) {
      search.value = activeTag;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(syncFilterBar, 120);
  }

  function syncFilterBar() {
    const active = document.getElementById('orgFocusActive');
    const count = document.getElementById('orgFocusCount');
    const clear = document.getElementById('orgClearFiltersBtn');
    const visibleCount = [...document.querySelectorAll('#orgList .record-item')]
      .filter(item => item.offsetParent !== null && !item.classList.contains('org-focus-hidden')).length;
    if (active) {
      active.style.display = activeTag ? '' : 'none';
      active.textContent = activeTag ? `Tag: ${activeTag}` : '';
    }
    if (count && activeTag) count.textContent = `${visibleCount} organization${visibleCount === 1 ? '' : 's'} matching this focus tag`;
    if (clear) clear.style.display = activeTag || document.getElementById('orgSearchBox')?.value || document.getElementById('orgTypeFilter')?.value ? '' : 'none';
  }
})();