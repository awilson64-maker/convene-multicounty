(() => {
  if (window.__conveneOrgTypeControlLoaded) return;
  window.__conveneOrgTypeControlLoaded = true;

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
    ensureTypeDropdown();
    refreshTypeOptions();
    bindEvents();
    setInterval(refreshTypeOptions, 1500);
  }

  function ensureTypeDropdown() {
    const field = document.getElementById('type');
    if (!field) return null;

    if (field.tagName === 'SELECT') {
      ensureAddButton(field);
      return field;
    }

    const current = field.value || '';
    const select = document.createElement('select');
    select.id = 'type';
    select.name = field.name || 'type';
    select.className = field.className || '';
    select.dataset.conveneTypeDropdown = 'true';
    select.dataset.pendingValue = current;

    field.replaceWith(select);
    ensureAddButton(select);
    return select;
  }

  function ensureAddButton(select) {
    if (!select || document.getElementById('orgTypeAddBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'orgTypeAddBtn';
    btn.type = 'button';
    btn.className = 'org-type-add-btn';
    btn.textContent = '+ Add new type';
    btn.setAttribute('aria-label', 'Add new organization type');

    select.insertAdjacentElement('afterend', btn);
  }

  function bindEvents() {
    document.body.addEventListener('click', event => {
      if (event.target.closest('#addOrgBtn') || event.target.closest('[data-edit-org]') || event.target.closest('.edit-org') || event.target.closest('[data-action="edit-org"]')) {
        setTimeout(refreshTypeOptions, 75);
        setTimeout(refreshTypeOptions, 250);
        setTimeout(refreshTypeOptions, 600);
      }

      if (event.target.closest('#orgTypeAddBtn')) {
        event.preventDefault();
        addNewType();
      }
    }, true);

    document.body.addEventListener('change', event => {
      if (event.target && event.target.id === 'countySelect') setTimeout(refreshTypeOptions, 150);
    });
  }

  function addNewType() {
    const select = document.getElementById('type');
    if (!select) return;

    const entered = window.prompt('Enter the new organization type:');
    const cleaned = cleanType(entered);
    if (!cleaned) return;

    ensureOption(select, cleaned);
    sortOptions(select);
    select.value = cleaned;
    select.dataset.pendingValue = cleaned;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function refreshTypeOptions(preferredValue) {
    const select = ensureTypeDropdown();
    if (!select || select.tagName !== 'SELECT') return;

    const currentValue = preferredValue || select.dataset.pendingValue || select.value || '';
    const types = getTypeList(currentValue);

    const previous = select.value;
    select.innerHTML = '';
    select.appendChild(option('', 'Select type...'));
    types.forEach(type => select.appendChild(option(type, type)));

    const target = cleanType(currentValue || previous);
    if (target && types.includes(target)) select.value = target;
    else if (target) {
      ensureOption(select, target);
      sortOptions(select);
      select.value = target;
    } else {
      select.value = '';
    }

    select.dataset.pendingValue = '';
    ensureAddButton(select);
  }

  function getTypeList(extra) {
    const values = new Set(CANONICAL_TYPES);
    getOrganizations().forEach(org => {
      const value = cleanType(org.type || org.organizationType || org.category || '');
      if (value) values.add(value);
    });
    const cleanedExtra = cleanType(extra);
    if (cleanedExtra) values.add(cleanedExtra);
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
    const cleaned = cleanType(value);
    if (!cleaned) return;
    if (!Array.from(select.options).some(opt => opt.value === cleaned)) {
      select.appendChild(option(cleaned, cleaned));
    }
  }

  function sortOptions(select) {
    const selectedValue = select.value;
    const placeholder = Array.from(select.options).find(opt => opt.value === '') || option('', 'Select type...');
    const options = Array.from(select.options)
      .filter(opt => opt.value !== '')
      .sort((a, b) => a.textContent.localeCompare(b.textContent));

    select.innerHTML = '';
    select.appendChild(placeholder);
    options.forEach(opt => select.appendChild(opt));
    if (selectedValue && Array.from(select.options).some(opt => opt.value === selectedValue)) {
      select.value = selectedValue;
    }
  }

  function option(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    opt.label = label;
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
      #type + .org-type-add-btn,
      #type + #orgTypeAddBtn {
        margin-top: 6px;
        width: auto;
        align-self: flex-start;
        border: 1px solid rgba(197, 5, 12, 0.35);
        background: #fff;
        color: #9b0000;
        border-radius: 8px;
        padding: 7px 10px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
      }

      #type + .org-type-add-btn:hover,
      #type + #orgTypeAddBtn:hover {
        background: #fff5f5;
      }
    `;
    document.head.appendChild(style);
  }
})();