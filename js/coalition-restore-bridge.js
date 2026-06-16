(function () {
  if (window.__conveneCoalitionRestoreBridgeLoaded) return;
  window.__conveneCoalitionRestoreBridgeLoaded = true;

  function install() {
    if (!window.ConveneStorage || window.ConveneStorage.__coalitionRestoreBridgeInstalled) return;

    var storage = window.ConveneStorage;
    var originalFromBackup = storage.workspaceFromBackup;
    var originalSave = storage.saveWorkspace;
    var pendingCoalitions = null;

    storage.workspaceFromBackup = function (data) {
      if (data && Array.isArray(data.coalitions)) pendingCoalitions = data.coalitions;
      return originalFromBackup.apply(storage, arguments);
    };

    storage.saveWorkspace = function (county, workspace) {
      if (pendingCoalitions && workspace && !Array.isArray(workspace.coalitions)) {
        workspace = Object.assign({}, workspace, { coalitions: pendingCoalitions });
        pendingCoalitions = null;
      }
      return originalSave.call(storage, county, workspace);
    };

    storage.__coalitionRestoreBridgeInstalled = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 250);
})();
