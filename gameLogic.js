const path = require('path');
const fs = require('fs');

/**
 * Count the number of directory levels in a file path
 * @param {string} filePath - The file path
 * @returns {number} - The directory depth
 */
function getDirectoryDepth(filePath) {
  const normalized = path.normalize(filePath);
  const parts = normalized.split(path.sep).filter(part => part.length > 0);
  // Subtract 1 because the last part is the filename
  return Math.max(0, parts.length - 1);
}

/**
 * Get the parent directory of a file path
 * @param {string} filePath - The file path
 * @returns {string} - The parent directory path
 */
function getParentDirectory(filePath) {
  return path.dirname(filePath);
}

/**
 * Calculate the distance between two file paths
 * @param {string} guessPath - The guessed file path
 * @param {string} targetPath - The target file path
 * @returns {object} - Object with distance info and comparison method
 */
function calculateDistance(guessPath, targetPath) {
  const guessParent = getParentDirectory(guessPath);
  const targetParent = getParentDirectory(targetPath);
  
  // If files are in the same folder, use alphabetical comparison
  if (guessParent.toLowerCase() === targetParent.toLowerCase()) {
    const guessName = path.basename(guessPath).toLowerCase();
    const targetName = path.basename(targetPath).toLowerCase();
    
    // Calculate alphabetical distance
    const guessChar = guessName.charCodeAt(0) || 0;
    const targetChar = targetName.charCodeAt(0) || 0;
    const alphabeticalDistance = Math.abs(guessChar - targetChar);
    
    return {
      method: 'alphabetical',
      distance: alphabeticalDistance,
      guessParent: guessParent,
      targetParent: targetParent
    };
  }
  
  // Otherwise, use directory depth difference
  const guessDepth = getDirectoryDepth(guessPath);
  const targetDepth = getDirectoryDepth(targetPath);
  const depthDifference = Math.abs(guessDepth - targetDepth);
  
  return {
    method: 'depth',
    distance: depthDifference,
    guessDepth: guessDepth,
    targetDepth: targetDepth
  };
}

/**
 * Compare two guesses to determine if the new guess is closer or farther
 * @param {string} newGuessPath - The new guess file path
 * @param {string} previousGuessPath - The previous guess file path (or null for first guess)
 * @param {string} targetPath - The target file path
 * @returns {string} - 'closer', 'farther', 'same', or 'first'
 */
function compareGuesses(newGuessPath, previousGuessPath, targetPath) {
  if (!previousGuessPath) {
    return 'first';
  }
  
  const newDistance = calculateDistance(newGuessPath, targetPath);
  const previousDistance = calculateDistance(previousGuessPath, targetPath);
  
  // If both use the same comparison method
  if (newDistance.method === previousDistance.method) {
    if (newDistance.distance < previousDistance.distance) {
      return 'closer';
    } else if (newDistance.distance > previousDistance.distance) {
      return 'farther';
    } else {
      return 'same';
    }
  }
  
  // If methods differ, we need a way to compare them
  // For now, if we're in the same folder as target, that's closer
  if (newDistance.method === 'alphabetical') {
    return 'closer';
  }
  if (previousDistance.method === 'alphabetical') {
    return 'farther';
  }
  
  // Both are depth-based, compare distances
  if (newDistance.distance < previousDistance.distance) {
    return 'closer';
  } else if (newDistance.distance > previousDistance.distance) {
    return 'farther';
  } else {
    return 'same';
  }
}

/**
 * Recursively scan directories to collect file paths
 * @param {string} dirPath - Directory to scan
 * @param {number} maxDepth - Maximum depth to scan (default: 10)
 * @param {number} currentDepth - Current depth (default: 0)
 * @param {Array} fileList - Array to store file paths (default: [])
 * @param {number} maxFiles - Maximum files to collect (default: 5000)
 * @param {Function} progressCallback - Callback function for progress updates (currentPath, fileCount)
 * @returns {Promise<Array>} - Promise that resolves to array of file paths
 */
async function scanDirectory(dirPath, maxDepth = 10, currentDepth = 0, fileList = [], maxFiles = 20000, progressCallback = null) {
  if (currentDepth >= maxDepth || fileList.length >= maxFiles) {
    return fileList;
  }
  
  // Report current directory being scanned
  if (progressCallback && currentDepth === 0) {
    progressCallback(dirPath, fileList.length);
  }
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (fileList.length >= maxFiles) {
        break; // Stop if we've collected enough files
      }
      
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        if (entry.isFile()) {
          fileList.push(fullPath);
          // Report progress more frequently (every 5 files or at root level)
          if (progressCallback && (fileList.length % 5 === 0 || currentDepth === 0)) {
            progressCallback(fullPath, fileList.length);
          }
        } else if (entry.isDirectory()) {
          // Skip certain system directories that might cause issues
          const skipDirs = ['$Recycle.Bin', 'System Volume Information', 'Windows', 'node_modules', '.git'];
          if (!skipDirs.includes(entry.name)) {
            await scanDirectory(fullPath, maxDepth, currentDepth + 1, fileList, maxFiles, progressCallback);
          }
        }
      } catch (err) {
        // Skip files/directories we can't access
        continue;
      }
    }
  } catch (err) {
    // Skip directories we can't access
  }
  
  return fileList;
}

/**
 * Scan all common directories to build a file list
 * @param {Function} progressCallback - Callback function for progress updates (currentPath, fileCount)
 * @returns {Promise<Array>} - Promise that resolves to array of file paths from all directories
 */
async function scanCommonDirectories(progressCallback = null) {
  const userProfile = process.env.HOME || process.env.USERPROFILE || 'C:\\';
  
  const commonDirs = [
    path.join(userProfile, 'Documents'),
    path.join(userProfile, 'Desktop'),
    path.join(userProfile, 'Downloads'),
    path.join(userProfile, 'Pictures'),
    path.join(userProfile, 'Music'),
    path.join(userProfile, 'Videos'),
  ];
  
  // Filter to only existing directories
  const existingDirs = commonDirs.filter(dir => fs.existsSync(dir));
  
  if (existingDirs.length === 0) {
    throw new Error('No accessible directories found');
  }
  
  let allFiles = [];
  const totalMaxFiles = 20000; // Total limit across all directories
  
  for (let i = 0; i < existingDirs.length; i++) {
    const dir = existingDirs[i];
    const dirName = path.basename(dir);
    
    if (progressCallback) {
      progressCallback(`Scanning ${dirName}... (${i + 1}/${existingDirs.length})`, allFiles.length);
    }
    
    if (allFiles.length >= totalMaxFiles) {
      break; // Stop if we've collected enough files total
    }
    
    try {
      const remainingSlots = totalMaxFiles - allFiles.length;
      const files = await scanDirectory(dir, 7, 0, [], remainingSlots, progressCallback);
      allFiles = allFiles.concat(files);
      
      if (progressCallback) {
        progressCallback(`Completed ${dirName} - Found ${files.length} files`, allFiles.length);
      }
    } catch (err) {
      // Skip directories that fail
      if (progressCallback) {
        progressCallback(`Skipped ${dirName} (access denied)`, allFiles.length);
      }
      continue;
    }
  }
  
  if (allFiles.length === 0) {
    throw new Error('No files found in any accessible directories');
  }
  
  return allFiles;
}

/**
 * Randomly select a target file from the file list
 * @param {Array<string>} fileList - Array of file paths
 * @returns {string} - Randomly selected file path
 */
function selectTargetFile(fileList) {
  if (fileList.length === 0) {
    throw new Error('No files available to select as target');
  }
  const randomIndex = Math.floor(Math.random() * fileList.length);
  return fileList[randomIndex];
}

module.exports = {
  getDirectoryDepth,
  getParentDirectory,
  calculateDistance,
  compareGuesses,
  scanDirectory,
  scanCommonDirectories,
  selectTargetFile
};

