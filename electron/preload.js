const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('uploaderApi', {
  openPicker: () => ipcRenderer.invoke('open-picker'),
  startUploadItem: (payload) => ipcRenderer.invoke('start-upload-item', payload),
  inspectPaths: (paths) => ipcRenderer.invoke('inspect-paths', paths),
  cancelUpload: () => ipcRenderer.invoke('cancel-upload'),
  onUploadLog: (callback) => on('upload-log', callback),
  onUploadErrorLog: (callback) => on('upload-error-log', callback),
  onUploadProgress: (callback) => on('upload-progress', callback),
  onUploadFinished: (callback) => on('upload-finished', callback)
});
