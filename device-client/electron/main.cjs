// Membungkus device client sebagai aplikasi desktop.
// Jalankan: npm run electron   (tambahkan --kiosk untuk mode kiosk penuh)
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Video boleh autoplay tanpa interaksi pengguna (layar signage tidak disentuh).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    kiosk: process.argv.includes('--kiosk'),
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);

  // ELECTRON_START_URL berguna saat development (mis. http://localhost:5174)
  if (process.env.ELECTRON_START_URL) win.loadURL(process.env.ELECTRON_START_URL);
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) win.focus();
});
app.on('window-all-closed', () => app.quit());
