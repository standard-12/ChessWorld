// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 8000;
const PYTHON_PATH = process.env.PYTHON_PATH || 'python3';
const ANALYZER_SCRIPT = path.join(__dirname, 'analyze_game.py');

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '5mb' }));

app.post('/api/analyze', async (req, res) => {
  const { pgn, depth } = req.body || {};
  if (!pgn || typeof pgn !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid pgn in request body' });
  }

  // Spawn python worker
  const py = spawn(PYTHON_PATH, [ANALYZER_SCRIPT], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  py.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  py.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  py.on('error', (err) => {
    console.error('Failed to start python process:', err);
    return res.status(500).json({ error: 'Failed to start analyzer' });
  });

  py.on('close', (code) => {
    if (code !== 0) {
      console.error('analyze_game.py exited with', code, 'stderr:', stderr);
      return res.status(500).json({ error: 'Analyzer failed', details: stderr });
    }
    try {
      const out = JSON.parse(stdout);
      return res.json(out);
    } catch (e) {
      console.error('Failed to parse analyzer output:', e, 'stdout:', stdout);
      return res.status(500).json({ error: 'Invalid analyzer output', details: stdout || stderr });
    }
  });

  // Send input json to python via stdin and close stdin
  const input = JSON.stringify({ pgn, depth: depth || 15 });
  py.stdin.write(input);
  py.stdin.end();
});

app.listen(PORT, () => {
  console.log(`Chess analyzer Node backend listening on port ${PORT}`);
});
