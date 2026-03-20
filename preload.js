const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getSubtitle: (videoId) => ipcRenderer.invoke('get-subtitle', videoId),
  openAdmin: () => ipcRenderer.invoke('open-admin'),
  openIndex: () => ipcRenderer.invoke('open-index'),

  // 자동 업데이트
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (e, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (e, pct) => callback(pct)),
});
