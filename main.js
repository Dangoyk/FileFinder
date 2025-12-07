const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const gameLogic = require('./gameLogic');

let mainWindow;
let fileList = [];
let targetFile = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  const fs = require('fs');
  
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    ...(fs.existsSync(iconPath) && { icon: iconPath })
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development (comment out for production)
  // mainWindow.webContents.openDevTools();
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

// IPC Handlers

// Scan files and select target
ipcMain.handle('initialize-game', async () => {
  try {
    // Show loading in renderer
    mainWindow.webContents.send('scanning-started');
    
    // Scan common directories
    fileList = await gameLogic.scanCommonDirectories();
    
    if (fileList.length === 0) {
      throw new Error('No files found. Please ensure you have accessible files.');
    }
    
    // Select random target
    targetFile = gameLogic.selectTargetFile(fileList);
    
    // Hide loading
    mainWindow.webContents.send('scanning-complete', {
      fileCount: fileList.length
    });
    
    return {
      success: true,
      fileCount: fileList.length
    };
  } catch (error) {
    mainWindow.webContents.send('scanning-complete', {
      fileCount: 0
    });
    return {
      success: false,
      error: error.message
    };
  }
});

// Get target file (for reveal at end)
ipcMain.handle('get-target-file', () => {
  return targetFile;
});

// Validate and check guess
ipcMain.handle('check-guess', async (event, guessPath, previousGuessPath) => {
  const fs = require('fs');
  
  try {
    // Validate file exists
    if (!fs.existsSync(guessPath)) {
      return {
        valid: false,
        error: 'File does not exist'
      };
    }
    
    // Check if it's a file (not a directory)
    const stats = fs.statSync(guessPath);
    if (!stats.isFile()) {
      return {
        valid: false,
        error: 'Path is not a file'
      };
    }
    
    // Check if it's the target
    if (guessPath === targetFile) {
      return {
        valid: true,
        correct: true,
        message: 'You found it!'
      };
    }
    
    // Compare with previous guess
    const comparison = gameLogic.compareGuesses(guessPath, previousGuessPath, targetFile);
    
    // Get distance info for display
    const distanceInfo = gameLogic.calculateDistance(guessPath, targetFile);
    
    return {
      valid: true,
      correct: false,
      comparison: comparison,
      distanceInfo: distanceInfo
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
});

// Browse for file
ipcMain.handle('browse-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select a file to guess'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return {
      success: true,
      filePath: result.filePaths[0]
    };
  }
  
  return {
    success: false
  };
});

// Reset game
ipcMain.handle('reset-game', async () => {
  try {
    // Select new random target
    if (fileList.length > 0) {
      targetFile = gameLogic.selectTargetFile(fileList);
      return {
        success: true
      };
    } else {
      // Re-scan if file list is empty
      fileList = await gameLogic.scanCommonDirectories();
      if (fileList.length > 0) {
        targetFile = gameLogic.selectTargetFile(fileList);
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: 'No files available'
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

