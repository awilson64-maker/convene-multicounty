(() => {
  if (window.__conveneOrgTypeControlLoaded) return;
  window.__conveneOrgTypeControlLoaded = true;

  const NEW_VALUE = '__convene_add_new_type__';
  const CANONICAL_TYPES = [
    'Aging / Disability',
    'Aging & Disability Resource Center',
    'Basic Needs',
    'Behavioral Health',
    'Civic / Government',
    'Community Engagement',
    'Education / Employment',
    'Financial Stability',
    'Food Security',
    'Health Care',
    'Housing',
    'Legal / Advocacy',
    'Substance Use / Recovery',
    'Transportation',
    'Veterans',
    'Youth / Family'
  ];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function init() {
    installStyles();
    installTypeControl();
    bindEvents();
    setInterval(refreshTypeOptions, 1500);
  }

  function installTypeControl() {
    const field = document.getElementById('type');
    if (!field) return;

    if (field.tagName === 'SELECT') {
      refreshTypeOptions();
      return;
    }

    const current = field.value || '';
    const select = document.createElement('select');
    select.id = 'type';
    select.name = field.name || 'type';
    select.className = field.className || '';
    select.dataset.conveneTypeDropdown = 'true';

    field.replaceWith(select);

    const custom = document.createElement('input');
    custom.id = 'orgTypeCustom';
    custom.type = 'text';
    custom.placeholder = 'Enter new organization type...';
    custom.className = 'org-type-custom-input';
    custom.hidden = true;
    select.insertAdjacentElement('afterend', custom);

    refreshTypeOptions(current);
  }

  function bindEvents() {
    document.body.addEventListener('click', event => {
      if (event.target.closest('#addOrgBtn') || event.target.closest('.edit-org') || event.target.closest('[data-action="edit-org"]')) {
        setTimeout(() => refreshTypeOptions(), 75);
        setTimeout(() => refreshTypeOptions(), 250);
      }
      if (event.target.closest('#saveOrgBtn')) commitCustomType();
    }, true);

    document.body.addEventListener('change', event => {
      if (event.target && event.target.id === 'type') handleTypeChange();
      if (event.target && event.target.id === 'countySelect') setTimeout(() => refreshTypeOptions(), 150);
    });

    document.body.addEventListener('submit', event => {
      if (event.target && event.target.id === 'orgForm') commitCustomType();
    }, true);

    document.body.addEventListener('keydown', event => {
      if (event.target && event.target.id === 'orgTypeCustom' && event.key === 'Enter') {
        event.preventDefault();
        commitCustomType();
        document.getElementById('saveOrgBtn')?.focus();
      }
    });
  }

  function handleTypeChange() {
    const select = document.getElementById('type');
    const custom = document.getElementById('orgTypeCustom');
    if (!select || !custom) return;
    const isNew = select.value === NEW_VALUE;
    custom.hidden = !isNew;
    if (isNew) {
      custom.value = '';
      setTimeout(() => custom.focus(), 0);
    }
  }

  function commitCustomType() {
    const select = document.getElementById('type');
    const custom = document.getElementById('orgTypeCustom');
    if (!select || !custom || select.value !== NEW_VALUE) return;

    const cleaned = cleanType(custom.value);
    if (!cleaned) {
      custom.focus();
      return;
    }

    ensureOption(select, cleaned);
    select.value = cleaned;
    custom.hidden = true;
  }

  function refreshTypeOptions(preferredValue) {
    installTypeControl();
    const select = document.getElementById('type');
    if (!select || select.tagName !== 'SELECT') return;

    const currentValue = preferredValue || select.value || '';
    const types = getTypeList(currentValue);

    select.innerHTML = '';
    select.appendChild(option('', 'Select type...'));
    types.forEach(type => select.appendChild(option(type, type)));
    select.appendChild(option(NEW_VALUE, '+ Add new type...'));

    if (currentValue && types.includes(currentValue)) select.value = currentValue;
    else if (currentValue && currentValue !== NEW_VALUE) {
      ensureOption(select, currentValue);
      select.value = currentValue;
    }

    handleTypeChange();
  }

  function getTypeList(extra) {
    const values = new Set(CANONICAL_TYPES);
    getOrganizations().forEach(org => {
      const value = cleanType(org.type || org.organizationType || org.category || '');
      if (value) values.add(value);
    });
    const cleanedExtra = cleanType(extra);
    if (cleanedExtra && cleanedExtra !== NEW_VALUE) values.add(cleanedExtra);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  function getOrganizations() {
    try {
      const county = activeCounty();
      if (window.ConveneStorage?.loadWorkspace) {
        return ConveneStorage.loadWorkspace(county).organizations || [];
      }
    } catch (error) {
      console.warn('Could not read organizations for type dropdown.', error);
    }
    return [];
  }

  function activeCounty() {
    const id = document.getElementById('countySelect')?.value || window.CONVENE_DEFAULT_COUNTY || 'fdl';
    return window.CONVENE_COUNTIES?.[id] || { id, storagePrefix: `convene:${id}` };
  }

  function ensureOption(select, value) {
    if (!Array.from(select.options).some(opt => opt.value === value)) {
      const addNew = Array.from(select.options).find(opt => opt.value === NEW_VALUE);
      select.insertBefore(option(value, value), addNew || null);
    }
  }

  function option(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
  }

  function cleanType(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function installStyles() {
    if (document.getElementById('orgTypeControlStyles')) return;
    const style = document.createElement('style');
    style.id = 'orgTypeControlStyles';
    style.textContent = `
      .org-type-custom-input {
        margin-top: 6px;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
})();