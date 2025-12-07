# File Finder Game

A desktop game built with Electron where you try to find a randomly selected target file on your computer by guessing files and receiving "closer" or "farther" feedback.

## How It Works

The game randomly selects a target file from your computer. Your goal is to find it by guessing files. After each guess, you'll receive feedback:

- **Closer!** - Your guess is closer to the target than your previous guess
- **Farther!** - Your guess is farther from the target than your previous guess
- **Same folder, alphabetically closer/farther** - If your guess is in the same folder as the target, the game uses alphabetical order

### Distance Calculation

- **Same folder**: Files are compared alphabetically (A-Z = closer)
- **Different folders**: Files are compared by directory depth (fewer folder levels difference = closer)

## Features

- Random target file selection from accessible files on your computer
- File path input or file browser to select guesses
- Limited guesses to add challenge
- Clear feedback after each guess
- Modern, clean user interface

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the game in development mode:
   ```bash
   npm start
   ```

4. Build the executable (.exe):
   ```bash
   npm run build
   ```

The built .exe file will be in the `dist` folder.

## How to Play

1. The game randomly selects a target file (you won't know which one!)
2. Enter a file path or browse to select a file as your guess
3. Click "Guess" to submit
4. Read the feedback: "Closer!" or "Farther!"
5. Use the feedback to make your next guess
6. Try to find the target file before running out of guesses!

## Project Structure

```
FileFinder/
├── main.js           # Electron main process
├── index.html        # Game UI structure
├── renderer.js       # UI logic and game state
├── gameLogic.js      # Core game mechanics
├── styles.css        # UI styling
├── package.json      # Project configuration
└── README.md         # This file
```

## Technologies Used

- **Electron** - Desktop application framework
- **Node.js** - File system operations
- **HTML/CSS/JavaScript** - User interface

## License

This project is open source and available for personal use.

## Notes

- The game scans accessible directories on your computer to build a list of files
- Some system files may be inaccessible due to permissions
- File scanning may take a moment on first load
- The target file path is kept secret until you find it or run out of guesses!

