const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let uploadProc = null;


function inspectPath(targetPath) {
  const stat = fs.statSync(targetPath);
  const ext = path.extname(targetPath).slice(1).toLowerCase();
  const isDir = stat.isDirectory();
  return {
    path: targetPath,
    name: path.basename(targetPath),
    isDirectory: isDir,
    size: isDir ? 0 : stat.size,
    extension: ext,
    modifiedAt: stat.mtimeMs
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('open-picker', async () => {
  return dialog.showOpenDialog(mainWindow, {
    title: 'Select files and/or folders to upload',
    defaultPath: path.join(os.homedir(), 'Downloads'),
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [
      { name: 'All', extensions: ['*'] },
      { name: 'Videos', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }
    ]
  });
});

ipcMain.handle('start-upload-item', async (_event, payload) => {
  if (uploadProc) {
    throw new Error('An upload is already running.');
  }

  const { source, destination = 'gdrive:Videos' } = payload;
  if (!source) {
    throw new Error('No source selected.');
  }

  const args = [
    'move',
    source,
    destination,
    '--progress',
    '--use-json-log',
    '--stats=1s',
    '--drive-chunk-size=128M',
    '--transfers=8',
    '--checkers=16',
    '--retries=10',
    '--low-level-retries=20',
    '--timeout=10m',
    '--contimeout=1m',
    '--drive-stop-on-upload-limit',
    '--create-empty-src-dirs',
    '--fast-list'
  ];

  uploadProc = spawn('rclone', args, { shell: false });

  uploadProc.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => {
      mainWindow.webContents.send('upload-log', line);
      try {
        mainWindow.webContents.send('upload-progress', JSON.parse(line));
      } catch (_err) {
        // ignore non-json lines
      }
    });
  });

  uploadProc.stderr.on('data', (data) => {
    mainWindow.webContents.send('upload-error-log', data.toString());
  });

  uploadProc.on('close', (code) => {
    mainWindow.webContents.send('upload-finished', code ?? -1);
    uploadProc = null;
  });

  return { started: true };
});

ipcMain.handle('cancel-upload', async () => {
  if (!uploadProc) {
    return { cancelled: false };
  }

  uploadProc.kill('SIGINT');
  return { cancelled: true };
});


ipcMain.handle('inspect-paths', async (_event, paths) => {
  return (paths || []).map((entry) => inspectPath(entry));
});
