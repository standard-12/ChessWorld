
## What
Small web app: fetch a Chess.com user's recent games, view a game interactively and run Stockfish analysis (inaccuracies/mistakes/blunders).

## Prereqs
- Node.js 
- Python 3.9+
- pip
- Stockfish engine installed locally
  - On Ubuntu: `sudo apt install stockfish`
  - Or download binary and note its path.

## Setup Backend
   - cd backend
   - npm install
   - python3 -m venv .venv
   - source .venv/bin/activate
   - pip install -r requirements.txt
   - export STOCKFISH_PATH=/path/to/stockfish (or create a .env file with config details)
   - npm start

## Setup frontend
   - cd frontend
   - npm install
   - npm start
   - Open localhost:3000

## Notes
- Backend `/api/analyze` uses Stockfish. Adjust `depth` param to trade accuracy vs time.
- Chess.com API is used directly from the browser to fetch games archives.

## Tech Stack

- Frontend

    - React (Create React App)

    - react-chessboard (interactive board UI)

    - chess.js (move logic, PGN/FEN handling)

    - Axios (HTTP requests)

    - JavaScript (ES6)`

- Backend

    - Node.js + Express (REST API server)

    - Python (executed via child_process)

    - python-chess (PGN parsing + Stockfish integration)

    - Stockfish (UCI engine)

    - CORS (frontend ↔ backend communication)

-  Additional Tools

    - dotenv (environment variables)

    - Python venv (virtual environment)

    - morgan (request logging)

    - Git & GitHub (version control)