#!/usr/bin/env python3
# backend/analyze_game.py
import os
import sys
import json
import io
import chess
import chess.pgn
import chess.engine
import traceback

# Read JSON from stdin
try:
    raw = sys.stdin.read()
    data = json.loads(raw)
    pgn_text = data.get("pgn", "")
    depth = int(data.get("depth", 15))
except Exception as e:
    print(json.dumps({"error": "Invalid input JSON", "detail": str(e)}))
    sys.exit(1)

STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "/usr/bin/stockfish")

def score_to_cp_for_side(score, side):
    """Convert a python-chess Score to centipawns from 'side' perspective.
       If mate detected, returns large magnitude with sign.
    """
    if score is None:
        return 0
    try:
        if score.is_mate():
            m = score.pov(chess.WHITE).mate()
            # m positive => white mates, negative => black mates
            # But we want from side's perspective:
            # use sign * large value
            side_mate = score.pov(side).mate()
            if side_mate is None:
                return 100000
            return 100000 if side_mate > 0 else -100000
        else:
            # score.pov(side).score() gives centipawn from that side
            return score.pov(side).score(mate_score=100000)
    except Exception:
        # Fallback
        try:
            return score.white().score(mate_score=100000)
        except Exception:
            return 0

def analyze_pgn(pgn_text, depth):
    pgn_io = io.StringIO(pgn_text)
    try:
        game = chess.pgn.read_game(pgn_io)
    except Exception as e:
        return {"error": "Could not parse PGN", "detail": str(e)}

    if game is None:
        return {"error": "No game in PGN"}

    # start engine
    try:
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    except FileNotFoundError:
        return {"error": f"Stockfish not found at {STOCKFISH_PATH}"}
    except Exception as e:
        return {"error": "Failed to start Stockfish", "detail": str(e)}

    board = game.board()
    moves_out = []
    inaccuracies = mistakes = blunders = 0
    total_cp_loss = 0.0
    ply_count = 0

    try:
        for move in game.mainline_moves():
            ply_count += 1
            before = board.copy()
            mover = before.turn  # True for white to move
            try:
                # get engine's best move from 'before' position
                best = engine.play(before, chess.engine.Limit(depth=depth))
                best_move = best.move
            except Exception:
                best_move = None

            # Evaluate position after best move (from mover's perspective)
            try:
                if best_move is not None:
                    tmp = before.copy()
                    tmp.push(best_move)
                    best_info = engine.analyse(tmp, chess.engine.Limit(depth=depth))
                    cp_best_for_side = score_to_cp_for_side(best_info.get("score"), mover)
                else:
                    # fallback: evaluate before position as 'best'
                    info_before = engine.analyse(before, chess.engine.Limit(depth=depth))
                    cp_best_for_side = score_to_cp_for_side(info_before.get("score"), mover)
            except Exception:
                cp_best_for_side = 0.0

            # apply the actual played move
            try:
                board.push(move)
            except Exception:
                # invalid move
                break

            # Evaluate position after played move
            try:
                info_played = engine.analyse(board, chess.engine.Limit(depth=depth))
                cp_played_for_side = score_to_cp_for_side(info_played.get("score"), mover)
            except Exception:
                cp_played_for_side = 0.0

            # Centipawn loss from mover's perspective: best - played
            cp_loss = cp_best_for_side - cp_played_for_side
            if cp_loss < 0:
                cp_loss = 0  # player did as good or better than engine's best
            total_cp_loss += cp_loss

            tag = "OK"
            if cp_loss >= 300:
                tag = "Blunder"
                blunders += 1
            elif cp_loss >= 100:
                tag = "Mistake"
                mistakes += 1
            elif cp_loss >= 50:
                tag = "Inaccuracy"
                inaccuracies += 1

            san = before.san(move)
            moves_out.append({
                "ply": ply_count,
                "san": san,
                "deltaCp": int(round(cp_loss)),
                "tag": tag
            })
    finally:
        try:
            engine.quit()
        except Exception:
            pass

    acpl = (total_cp_loss / ply_count) if ply_count > 0 else 0.0

    return {
        "summary": {
            "inaccuracies": inaccuracies,
            "mistakes": mistakes,
            "blunders": blunders,
            "acpl": round(acpl, 2)
        },
        "moves": moves_out
    }

result = analyze_pgn(pgn_text, depth)
print(json.dumps(result))
sys.stdout.flush()
