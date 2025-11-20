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

def score_to_cp_white_pov(score):
    """Convert a python-chess Score to centipawns from WHITE's perspective.
       If mate detected, returns large magnitude with sign.
    """
    if score is None:
        return 0
    try:
        if score.is_mate():
            # Get mate in moves from white's perspective
            mate_moves = score.pov(chess.WHITE).mate()
            if mate_moves is None:
                return 100000
            # Positive mate = white is mating, negative = black is mating
            return 100000 if mate_moves > 0 else -100000
        else:
            # Get centipawn score from white's perspective
            return score.pov(chess.WHITE).score(mate_score=100000)
    except Exception:
        # Fallback
        try:
            return score.white().score(mate_score=100000)
        except Exception:
            return 0

def format_eval(cp_value):
    """Format evaluation for display"""
    if cp_value >= 100000:
        return "M+"
    elif cp_value <= -100000:
        return "M-"
    else:
        # Convert centipawns to pawns
        pawns = cp_value / 100.0
        return f"{pawns:+.2f}"

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
                # Get engine's best move from 'before' position
                best = engine.play(before, chess.engine.Limit(depth=depth))
                best_move = best.move
            except Exception:
                best_move = None

            # Evaluate position after best move (from WHITE's perspective)
            try:
                if best_move is not None:
                    tmp = before.copy()
                    tmp.push(best_move)
                    best_info = engine.analyse(tmp, chess.engine.Limit(depth=depth))
                    cp_best_white_pov = score_to_cp_white_pov(best_info.get("score"))
                else:
                    # fallback: evaluate before position as 'best'
                    info_before = engine.analyse(before, chess.engine.Limit(depth=depth))
                    cp_best_white_pov = score_to_cp_white_pov(info_before.get("score"))
            except Exception:
                cp_best_white_pov = 0.0

            # Apply the actual played move
            try:
                board.push(move)
            except Exception:
                # invalid move
                break

            # Evaluate position after played move (from WHITE's perspective)
            try:
                info_played = engine.analyse(board, chess.engine.Limit(depth=depth))
                cp_played_white_pov = score_to_cp_white_pov(info_played.get("score"))
            except Exception:
                cp_played_white_pov = 0.0

            # Calculate centipawn loss from the mover's perspective
            # If white moved: loss = best - played (both from white's POV)
            # If black moved: loss = played - best (because black wants negative scores)
            if mover == chess.WHITE:
                cp_loss = cp_best_white_pov - cp_played_white_pov
            else:
                cp_loss = cp_played_white_pov - cp_best_white_pov
            
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
            
            # Store best move in SAN notation
            best_move_san = ""
            if best_move is not None:
                try:
                    best_move_san = before.san(best_move)
                except:
                    best_move_san = str(best_move)
            
            moves_out.append({
                "ply": ply_count,
                "san": san,
                "deltaCp": int(round(cp_loss)),
                "tag": tag,
                "evalAfterPlayed": format_eval(cp_played_white_pov),
                "evalAfterBest": format_eval(cp_best_white_pov),
                "bestMove": best_move_san
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