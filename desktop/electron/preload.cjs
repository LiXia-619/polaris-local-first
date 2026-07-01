const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('polarisDesktopLocal', {
  getState: () => ipcRenderer.invoke('polaris-desktop-local:get-state'),
  setPermissionMode: (mode) => ipcRenderer.invoke('polaris-desktop-local:set-permission-mode', mode),
  chooseRoot: () => ipcRenderer.invoke('polaris-desktop-local:choose-root'),
  removeRoot: (rootId) => ipcRenderer.invoke('polaris-desktop-local:remove-root', rootId),
  listDirectory: (input) => ipcRenderer.invoke('polaris-desktop-local:list-directory', input),
  readWorkspaceFiles: (input) => ipcRenderer.invoke('polaris-desktop-local:read-workspace-files', input),
  writeWorkspaceFiles: (input) => ipcRenderer.invoke('polaris-desktop-local:write-workspace-files', input),
  readFile: (input) => ipcRenderer.invoke('polaris-desktop-local:read-file', input),
  writeFile: (input) => ipcRenderer.invoke('polaris-desktop-local:write-file', input),
  createDirectory: (input) => ipcRenderer.invoke('polaris-desktop-local:create-directory', input),
  deletePath: (input) => ipcRenderer.invoke('polaris-desktop-local:delete-path', input),
  movePath: (input) => ipcRenderer.invoke('polaris-desktop-local:move-path', input),
  runCommand: (input) => ipcRenderer.invoke('polaris-desktop-local:run-command', input),
  runCommandSequence: (input) => ipcRenderer.invoke('polaris-desktop-local:run-command-sequence', input),
  startCommand: (input) => ipcRenderer.invoke('polaris-desktop-local:start-command', input),
  stopCommand: (input) => ipcRenderer.invoke('polaris-desktop-local:stop-command', input),
  listCommandSessions: () => ipcRenderer.invoke('polaris-desktop-local:list-command-sessions'),
  onCommandSession: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('polaris-desktop-local:command-session', wrapped);
    return () => ipcRenderer.removeListener('polaris-desktop-local:command-session', wrapped);
  }
});
