import React, { useState } from "react";
import axios from "axios";
import GameViewer from "./GameViewer";

export default function App() {
  const [username, setUsername] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPgn, setSelectedPgn] = useState(null);

  async function fetchGames() {
    if (!username) return;
    setLoading(true);
    setGames([]);
    try {
      const archivesResp = await axios.get(`https://api.chess.com/pub/player/${username}/games/archives`);
      const archives = archivesResp.data.archives; // array of urls newest last
      // fetch latest months until we have up to 20 qualifying games
      let collected = [];
      for (let i = archives.length - 1; i >= 0 && collected.length < 20; i--) {
        const url = archives[i];
        const monthResp = await axios.get(url);
        const monthGames = monthResp.data.games || [];
        // filter only chess rules + time_class blitz/rapid/classical
        for (const g of monthGames) {
          if (collected.length >= 20) break;
          if (g.rules !== "chess") continue;
          if (!["blitz","rapid","classical"].includes(g.time_class)) continue;
          collected.push(g);
        }
      }
      setGames(collected);
    } catch (err) {
      console.error(err);
      alert("Could not fetch games. Check username and network.");
    } finally {
      setLoading(false);
    }
  }

  function viewGame(game) {
    // chess.com gives pgn in game.pgn
    setSelectedPgn(game.pgn);
  }

  return (
    <div className="container">
      <h1>Chessworld — Internship Assignment (demo)</h1>
      <div className="fetch-row">
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Chess.com username" />
        <button onClick={fetchGames} disabled={loading}>{loading ? "Loading..." : "Fetch"}</button>
      </div>

      <table className="games-table">
        <thead>
          <tr><th>Opponent</th><th>Result</th><th>Time Class</th><th>Opening</th><th>Date</th><th>View</th></tr>
        </thead>
        <tbody>
          {games.map((g, idx) => {
            const userIsWhite = (g.white && g.white.username && g.white.username.toLowerCase() === username.toLowerCase());
            const opp = userIsWhite ? g.black.username : g.white.username;
            const result = userIsWhite ? g.white.result : g.black.result;
            const opening = (g.pgn && g.pgn.includes("Opening")) ? "" : (g.opening?.name || "");
            const date = new Date(g.end_time * 1000).toLocaleString();
            return (
              <tr key={idx}>
                <td>{opp}</td>
                <td>{result}</td>
                <td>{g.time_class}</td>
                <td>{opening}</td>
                <td>{date}</td>
                <td><button onClick={() => viewGame(g)}>View</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedPgn && (
        <GameViewer pgn={selectedPgn} onClose={() => setSelectedPgn(null)} />
      )}
    </div>
  );
}
