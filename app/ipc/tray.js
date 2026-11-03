function registerTrayIpc(ipcMain, trayController) {
  ipcMain.on('tray-action', (_, action) => trayController.handleAction(action));
}

module.exports = { registerTrayIpc };
