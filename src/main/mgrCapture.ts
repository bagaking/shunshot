import { BrowserWindow, screen } from 'electron';

export function createCaptureWindow() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  
  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width: primaryDisplay.bounds.width,
    height: primaryDisplay.bounds.height,
    frame: false,
    transparent: true,
    focusable: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    if (process.platform === 'darwin') {
      win.setAlwaysOnTop(true, 'screen-saver');
      setTimeout(() => {
        win.focus();
      }, 100);
    }
  });

  win.on('blur', () => {
    console.debug('[main] Capture window lost focus, attempting to regain...');
    if (process.platform === 'darwin') {
      win.focus();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  // Add mouse event monitoring
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && !win.isFocused()) {
      console.debug('[main] Key event received while window not focused, focusing window...');
      win.focus();
    }
  });

  return win;
} 