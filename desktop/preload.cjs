const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arduOS', {
  desktop: true,
  platform: process.platform,
  windowControl: (action) => ipcRenderer.send('ardu-os:window', action),
});
