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

// IPC listeners
ipcRenderer.on('scanning-started', () => {
  showLoading();
});

ipcRenderer.on('scanning-complete', (event, data) => {
  // Loading will be hidden by initializeGame
});

// Initialize game on load
window.addEventListener('DOMContentLoaded', () => {
  initializeGame();
});

