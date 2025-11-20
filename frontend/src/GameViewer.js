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
      console.log("PGN Sent : ", pgn);
      const resp = await axios.post("http://localhost:8000/api/analyze", { pgn, depth: 15 });
      setAnalysis(resp.data);
      console.log("Analysis Response  : " ,resp);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Make sure backend is running on http://localhost:8000 and STOCKFISH_PATH is set.");
    } finally {
      setLoading(false);
    }
  }

  function chipColor(tag) {
    if (!tag || tag === "OK") return "#4ade80"; // green
    if (tag === "Inaccuracy") return "#fbbf24"; // yellow
    if (tag === "Mistake") return "#fb923c"; // orange
    if (tag === "Blunder") return "#ef4444"; // red
    return "#4ade80";
  }

  return (
    <div className="modal">
      <div className="viewer">
        <div className="viewer-left">
          <div className="board-container">
              <Chessboard position={fen} boardWidth={460} />
          </div>
          <div className="controls">
            <button onClick={() => goTo(0)}>Start</button>
            <button onClick={prev}>Prev</button>
            <button onClick={next}>Next</button>
            <button onClick={() => goTo(moves.length)}>End</button>
            <button onClick={analyze} disabled={loading}>{loading ? "Analyzing..." : "Analyze"}</button>
            <button onClick={onClose}>Close</button>
          </div>
          
          {/* Display current move evaluation */}
          {analysis && index > 0 && analysis.moves[index - 1] && (
            <div className="current-move-eval">
              <h4>Move {index}: {analysis.moves[index - 1].san}</h4>
              <div className="eval-details">
                <div className="eval-row">
                  <span className="eval-label">Played Move:</span>
                  <span className="eval-value">{analysis.moves[index - 1].san}</span>
                  <span className="eval-score">{analysis.moves[index - 1].evalAfterPlayed}</span>
                </div>
                <div className="eval-row">
                  <span className="eval-label">Best Move:</span>
                  <span className="eval-value">{analysis.moves[index - 1].bestMove || "N/A"}</span>
                  <span className="eval-score">{analysis.moves[index - 1].evalAfterBest}</span>
                </div>
                <div className="eval-row">
                  <span className="eval-label">CP Loss:</span>
                  <span className="eval-value cp-loss">{analysis.moves[index - 1].deltaCp}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="viewer-right">
          <div className="move-list">
            <table className="move-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>White</th>
                  <th>Eval</th>
                  <th>#</th>
                  <th>Black</th>
                  <th>Eval</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(moves.length / 2) }, (_, moveNum) => {
                  const whiteIdx = moveNum * 2;
                  const blackIdx = moveNum * 2 + 1;
                  const whiteMv = moves[whiteIdx];
                  const blackMv = moves[blackIdx];
                  
                  const whiteTag = analysis?.moves[whiteIdx];
                  const blackTag = analysis?.moves[blackIdx];
                  
                  return (
                    <tr key={moveNum}>
                      {/* White's move number */}
                      <td className="move-num-cell">{moveNum + 1}</td>
                      
                      {/* White's move */}
                      <td 
                        className={`move-cell ${index === whiteIdx + 1 ? 'selected' : ''}`}
                        onClick={() => goTo(whiteIdx + 1)}
                      >
                        <div className="move-content">
                          <span className="move-san">{whiteMv.san || whiteMv}</span>
                          {whiteTag && (
                            <span className="chip" style={{ background: chipColor(whiteTag.tag) }}>
                              {whiteTag.tag}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* White's evaluation */}
                      <td className="eval-cell">
                        {whiteTag && (
                          <span className="eval-value">{whiteTag.evalAfterPlayed}</span>
                        )}
                      </td>
                      
                      {/* Black's move number */}
                      <td className="move-num-cell">{moveNum + 1}</td>
                      
                      {/* Black's move */}
                      <td 
                        className={`move-cell ${index === blackIdx + 1 ? 'selected' : ''}`}
                        onClick={blackMv ? () => goTo(blackIdx + 1) : undefined}
                      >
                        {blackMv && (
                          <div className="move-content">
                            <span className="move-san">{blackMv.san || blackMv}</span>
                            {blackTag && (
                              <span className="chip" style={{ background: chipColor(blackTag.tag) }}>
                                {blackTag.tag}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      
                      {/* Black's evaluation */}
                      <td className="eval-cell">
                        {blackTag && (
                          <span className="eval-value">{blackTag.evalAfterPlayed}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {analysis && (
            <div className="summary">
              <h3>Analysis Summary</h3>
              <p><strong>Inaccuracies:</strong> {analysis.summary.inaccuracies}</p>
              <p><strong>Mistakes:</strong> {analysis.summary.mistakes}</p>
              <p><strong>Blunders:</strong> {analysis.summary.blunders}</p>
              <p><strong>ACPL:</strong> {analysis.summary.acpl}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}