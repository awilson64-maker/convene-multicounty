(function () {
  if (window.__conveneCompactListStyleLoaded) return;
  window.__conveneCompactListStyleLoaded = true;

  var CONFIGS = [
    { id: 'orgList', title: 'Organization records', action: 'Actions' },
    { id: 'contactList', title: 'Contact records', action: 'Actions' },
    { id: 'activityList', title: 'Activity records', action: 'Actions' },
    { id: 'relationshipList', title: 'Relationship records', action: 'Actions' }
  ];

  function init() {
    installStyles();
    applyCompactLists();
    bindRefreshEvents();
    setInterval(applyCompactLists, 1200);
  }

  function bindRefreshEvents() {
    document.addEventListener('click', function () {
      setTimeout(applyCompactLists, 80);
      setTimeout(applyCompactLists, 300);
    }, true);

    document.addEventListener('input', function () {
      setTimeout(applyCompactLists, 80);
    }, true);

    document.addEventListener('change', function () {
      setTimeout(applyCompactLists, 80);
      setTimeout(applyCompactLists, 300);
    }, true);
  }

  function applyCompactLists() {
    for (var i = 0; i < CONFIGS.length; i += 1) {
      applyOne(CONFIGS[i]);
    }
  }

  function applyOne(config) {
    var list = document.getElementById(config.id);
    if (!list) return;

    var rows = list.querySelectorAll('.record-item');
    var existingHeader = list.querySelector('.convene-list-header');

    if (!rows.length) {
      list.classList.remove('convene-compact-list');
      if (existingHeader) existingHeader.remove();
      return;
    }

    list.classList.add('convene-compact-list');

    if (!existingHeader) {
      existingHeader = document.createElement('div');
      existingHeader.className = 'convene-list-header';
      existingHeader.innerHTML = '<span>' + escapeHtml(config.title) + '</span><span>' + escapeHtml(config.action) + '</span>';
    }

    if (list.firstElementChild !== existingHeader) {
      list.insertBefore(existingHeader, list.firstElementChild);
    }
  }

  function installStyles() {
    if (document.getElementById('conveneCompactListStyles')) return;

    var style = document.createElement('style');
    style.id = 'conveneCompactListStyles';
    style.textContent = '\n\
      .convene-compact-list {\n\
        display: block !important;\n\
        gap: 0 !important;\n\
        border: 1px solid var(--line, #dadfe1);\n\
        border-radius: 14px;\n\
        overflow: auto;\n\
        background: #fff;\n\
        box-shadow: var(--shadow, 0 10px 25px rgba(40,39,40,.08));\n\
        max-height: calc(100vh - 300px);\n\
      }\n\
\n\
      .convene-list-header {\n\
        position: sticky;\n\
        top: 0;\n\
        z-index: 5;\n\
        display: grid;\n\
        grid-template-columns: minmax(0, 1fr) 170px;\n\
        gap: 12px;\n\
        align-items: center;\n\
        background: #282728;\n\
        color: #fff;\n\
        padding: 10px 14px;\n\
        font-size: 12px;\n\
        line-height: 1.2;\n\
        font-weight: 800;\n\
        letter-spacing: .02em;\n\
        text-transform: uppercase;\n\
      }\n\
\n\
      .convene-list-header span:last-child {\n\
        text-align: right;\n\
      }\n\
\n\
      .convene-compact-list .record-item {\n\
        display: grid;\n\
        grid-template-columns: minmax(0, 1fr) 170px;\n\
        gap: 12px;\n\
        align-items: center;\n\
        border: 0;\n\
        border-bottom: 1px solid var(--line, #dadfe1);\n\
        border-radius: 0;\n\
        box-shadow: none;\n\
        padding: 9px 14px;\n\
        min-height: 58px;\n\
      }\n\
\n\
      .convene-compact-list .record-item:last-child {\n\
        border-bottom: 0;\n\
      }\n\
\n\
      .convene-compact-list .record-item:hover {\n\
        background: #fafafa;\n\
      }\n\
\n\
      .convene-compact-list .record-item h3 {\n\
        margin: 0 0 3px;\n\
        font-size: 16px;\n\
        line-height: 1.2;\n\
      }\n\
\n\
      .convene-compact-list .record-meta {\n\
        font-size: 13px;\n\
        line-height: 1.25;\n\
      }\n\
\n\
      .convene-compact-list .small-actions {\n\
        justify-content: flex-end;\n\
        flex-wrap: nowrap;\n\
        gap: 6px;\n\
      }\n\
\n\
      .convene-compact-list .small-actions button {\n\
        padding: 5px 8px;\n\
        border-radius: 7px;\n\
        font-size: 12px;\n\
        line-height: 1.2;\n\
        white-space: nowrap;\n\
      }\n\
\n\
      .convene-compact-list .pill,\n\
      .convene-compact-list .focus-pill,\n\
      .convene-compact-list button[data-focus-tag] {\n\
        font-size: 11px;\n\
        padding: 2px 6px;\n\
        margin: 3px 3px 0 0;\n\
      }\n\
\n\
      @media (max-width: 900px) {\n\
        .convene-list-header { grid-template-columns: 1fr 110px; }\n\
        .convene-compact-list .record-item { grid-template-columns: 1fr; }\n\
        .convene-compact-list .small-actions { justify-content: flex-start; }\n\
      }\n\
    ';
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
