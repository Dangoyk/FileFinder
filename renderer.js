const { ipcRenderer } = require('electron');

// Game state
let gameState = {
  guessesRemaining: 10,
  previousGuess: null,
  guesses: [],
  gameActive: false,
  targetFile: null
};

// DOM elements
const fileInput = document.getElementById('file-input');
const guessBtn = document.getElementById('guess-btn');
const browseBtn = document.getElementById('browse-btn');
const feedbackMessage = document.getElementById('feedback-message');
const guessesRemaining = document.getElementById('guesses-remaining');
const gameStatus = document.getElementById('game-status');
const guessList = document.getElementById('guess-list');
const winMessage = document.getElementById('win-message');
const loseMessage = document.getElementById('lose-message');
const restartBtn = document.getElementById('restart-btn');
const restartBtnLose = document.getElementById('restart-btn-lose');
const loadingOverlay = document.getElementById('loading-overlay');
const targetReveal = document.getElementById('target-reveal');
const loadingStatus = document.getElementById('loading-status');
const progressBar = document.getElementById('progress-bar');
const loadingTime = document.getElementById('loading-time');

// Initialize game
async function initializeGame() {
  showLoading();
  gameState.gameActive = false;
  guessBtn.disabled = true;
  
  const result = await ipcRenderer.invoke('initialize-game');
  
  if (result.success) {
    gameState.gameActive = true;
    gameState.guessesRemaining = 10;
    gameState.previousGuess = null;
    gameState.guesses = [];
    gameState.targetFile = await ipcRenderer.invoke('get-target-file');
    
    updateUI();
    hideLoading();
    guessBtn.disabled = false;
  } else {
    hideLoading();
    alert('Failed to initialize game: ' + result.error);
  }
}

// Show loading overlay
function showLoading() {
  loadingOverlay.classList.remove('hidden');
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Update UI elements
function updateUI() {
  guessesRemaining.textContent = gameState.guessesRemaining;
  gameStatus.textContent = gameState.gameActive ? 'Playing' : 'Game Over';
  
  // Update guess list
  guessList.innerHTML = '';
  gameState.guesses.forEach((guess, index) => {
    const guessItem = document.createElement('div');
    guessItem.className = 'guess-item';
    
    const pathSpan = document.createElement('span');
    pathSpan.className = 'guess-path';
    pathSpan.textContent = guess.path;
    
    const feedbackSpan = document.createElement('span');
    feedbackSpan.className = `guess-feedback ${guess.feedback}`;
    
    if (index === 0) {
      feedbackSpan.textContent = 'First guess';
    } else {
      feedbackSpan.textContent = guess.feedback === 'closer' ? 'Closer!' : 
                                  guess.feedback === 'farther' ? 'Farther!' : 'Same distance';
    }
    
    guessItem.appendChild(pathSpan);
    guessItem.appendChild(feedbackSpan);
    guessList.appendChild(guessItem);
  });
}

// Handle guess submission
async function handleGuess() {
  if (!gameState.gameActive) {
    return;
  }
  
  const guessPath = fileInput.value.trim();
  
  if (!guessPath) {
    showFeedback('Please enter a file path', 'first');
    return;
  }
  
  // Check the guess
  const result = await ipcRenderer.invoke('check-guess', guessPath, gameState.previousGuess);
  
  if (!result.valid) {
    showFeedback('Error: ' + result.error, 'first');
    return;
  }
  
  if (result.correct) {
    // Win!
    gameState.gameActive = false;
    gameState.guessesRemaining = 0;
    showFeedback('🎉 You found it! 🎉', 'closer');
    winMessage.classList.remove('hidden');
    guessBtn.disabled = true;
    fileInput.disabled = true;
    browseBtn.disabled = true;
    return;
  }
  
  // Update game state
  gameState.guessesRemaining--;
  gameState.guesses.push({
    path: guessPath,
    feedback: result.comparison
  });
  gameState.previousGuess = guessPath;
  
  // Show feedback
  let feedbackText = '';
  if (result.comparison === 'first') {
    feedbackText = 'First guess! Keep going...';
  } else if (result.comparison === 'closer') {
    feedbackText = '🔥 Closer! 🔥';
  } else if (result.comparison === 'farther') {
    feedbackText = '❄️ Farther! ❄️';
  } else {
    feedbackText = 'Same distance';
  }
  
  showFeedback(feedbackText, result.comparison);
  
  // Check if out of guesses
  if (gameState.guessesRemaining <= 0) {
    gameState.gameActive = false;
    const target = await ipcRenderer.invoke('get-target-file');
    targetReveal.textContent = `Target file was: ${target}`;
    loseMessage.classList.remove('hidden');
    guessBtn.disabled = true;
    fileInput.disabled = true;
    browseBtn.disabled = true;
  }
  
  updateUI();
  fileInput.value = '';
}

// Show feedback message
function showFeedback(message, type) {
  feedbackMessage.textContent = message;
  feedbackMessage.className = `feedback-message ${type}`;
}

// Handle browse button
async function handleBrowse() {
  const result = await ipcRenderer.invoke('browse-file');
  
  if (result.success) {
    fileInput.value = result.filePath;
  }
}

// Reset game
async function resetGame() {
  winMessage.classList.add('hidden');
  loseMessage.classList.add('hidden');
  feedbackMessage.textContent = '';
  feedbackMessage.className = 'feedback-message';
  fileInput.value = '';
  fileInput.disabled = false;
  browseBtn.disabled = false;
  
  await initializeGame();
}

// Event listeners
guessBtn.addEventListener('click', handleGuess);
browseBtn.addEventListener('click', handleBrowse);
restartBtn.addEventListener('click', resetGame);
restartBtnLose.addEventListener('click', resetGame);

fileInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleGuess();
  }
});

// Progress tracking
let progressState = {
  startTime: null,
  fileCount: 0,
  estimatedTotal: 10000 // Increased estimate
};

// IPC listeners
ipcRenderer.on('scanning-started', () => {
  progressState.startTime = Date.now();
  progressState.fileCount = 0;
  showLoading();
  updateProgress('Initializing scan...', 0, 0, 0);
});

ipcRenderer.on('scanning-progress', (event, data) => {
  progressState.fileCount = data.fileCount;
  
  // Dynamic progress calculation - update estimate based on current rate
  if (data.fileCount > 0 && data.elapsed > 0) {
    const currentRate = data.fileCount / data.elapsed;
    // Estimate total based on current rate (assume it will continue for a bit)
    progressState.estimatedTotal = Math.max(5000, Math.min(20000, data.fileCount * 3));
  }
  
  // Calculate progress percentage (cap at 95% until actually complete)
  const progressPercent = Math.min(95, (data.fileCount / progressState.estimatedTotal) * 100);
  
  // Format time remaining
  let timeText = '';
  if (data.estimatedTimeRemaining > 0) {
    if (data.estimatedTimeRemaining < 1) {
      timeText = 'Less than a second remaining';
    } else if (data.estimatedTimeRemaining < 60) {
      timeText = `~${Math.ceil(data.estimatedTimeRemaining)} seconds remaining`;
    } else {
      const minutes = Math.floor(data.estimatedTimeRemaining / 60);
      const seconds = Math.ceil(data.estimatedTimeRemaining % 60);
      timeText = `~${minutes}m ${seconds}s remaining`;
    }
  }
  
  // Update UI
  updateProgress(data.currentPath, progressPercent, data.fileCount, timeText);
});

ipcRenderer.on('scanning-complete', (event, data) => {
  // Update progress to show completion
  updateProgress('Scan complete!', 100, data.fileCount, '');
  // Note: hideLoading() will be called by initializeGame() after it receives the result
});

// Update progress display
function updateProgress(statusText, progressPercent, fileCount, timeText) {
  if (loadingStatus) {
    loadingStatus.textContent = statusText;
  }
  
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }
  
  if (loadingTime) {
    let timeDisplay = '';
    if (fileCount > 0) {
      timeDisplay = `Found ${fileCount} files`;
      if (timeText) {
        timeDisplay += ` • ${timeText}`;
      }
    }
    loadingTime.textContent = timeDisplay;
  }
}

// Initialize game on load
window.addEventListener('DOMContentLoaded', () => {
  initializeGame();
});

