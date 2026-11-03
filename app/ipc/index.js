const { ipcMain } = require('electron');
const { registerConfigIpc } = require('./config');
const { registerTrayIpc } = require('./tray');
const { registerWindowIpc } = require('./window');

function registerFeatureIpc(services) {
  const { trayController } = services;
  registerConfigIpc(services);
  registerTrayIpc(ipcMain, trayController);
  registerWindowIpc(services);
}

module.exports = { registerFeatureIpc };
