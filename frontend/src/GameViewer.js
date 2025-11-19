import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import axios from "axios";

export default function GameViewer({ pgn, onClose }) {
  const [chess] = useState(new Chess());
  const [moves, setMoves] = useState([]);
  const [index, setIndex] = useState(0);
  const [fen, setFen] = useState("start");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chess.reset();
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    // rebuild board from start
    chess.reset();
    setMoves(history);
    setIndex(0);
    setFen(chess.fen());
  }, [pgn]);

  function goTo(i) {
    chess.reset();
    for (let j = 0; j < i; j++) {
      chess.move(moves[j]);
    }
    setIndex(i);
    setFen(chess.fen());
  }
  function next() { if (index < moves.length) goTo(index + 1); }
  function prev() { if (index > 0) goTo(index - 1); }

  async function analyze() {
    setLoading(true);
    setAnalysis(null);
    try {
      const resp = await axios.post("http://localhost:8000/api/analyze", { pgn, depth: 15 });
      setAnalysis(resp.data);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Make sure backend is running on http://localhost:8000 and STOCKFISH_PATH is set.");
    } finally {
      setLoading(false);
    }
  }

  function chipColor(tag) {
    if (!tag || tag === "OK") return "#ccc";
    if (tag === "Inaccuracy") return "#ffe08a"; // yellow
    if (tag === "Mistake") return "#ffb366"; // orange
    if (tag === "Blunder") return "#ff6b6b"; // red
    return "#ccc";
  }

  return (
    <div className="modal">
      <div className="viewer">
        <div className="viewer-left">
          <Chessboard position={fen} boardWidth={460} />
          <div className="controls">
            <button onClick={() => goTo(0)}>Start</button>
            <button onClick={prev}>Prev</button>
            <button onClick={next}>Next</button>
            <button onClick={() => goTo(moves.length)}>End</button>
            <button onClick={analyze} disabled={loading}>{loading ? "Analyzing..." : "Analyze"}</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="viewer-right">
          <div className="move-list">
            {moves.map((mv, idx) => {
              const mvIndex = idx + 1;
              const tagObj = analysis ? analysis.moves[idx] : null;
              const tag = tagObj ? tagObj.tag : null;
              return (
                <div key={idx} className="move-row" onClick={() => goTo(mvIndex)}>
                  <div className="move-number">{Math.ceil(mvIndex / 2)}</div>
                  <div className="move-san">{mv.san || mv}</div>
                  <div className="chip" style={{ background: chipColor(tag) }}>{tag ? tag : "OK"}</div>
                </div>
              );
            })}
          </div>

          {analysis && (
            <div className="summary">
              <h3>Analysis Summary</h3>
              <p>Inaccuracies: {analysis.summary.inaccuracies}</p>
              <p>Mistakes: {analysis.summary.mistakes}</p>
              <p>Blunders: {analysis.summary.blunders}</p>
              <p>ACPL: {analysis.summary.acpl}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
