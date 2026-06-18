import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface ChessProps {
  onGameEnd: (pts: number) => void;
}

// Casual 8x8 Chess setup using unicode symbols representing pieces
type Piece = {
  type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
  color: 'w' | 'b';
  symbol: string;
};

type ChessBoard = (Piece | null)[][];

export default function Chess({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [board, setBoard] = useState<ChessBoard>(() => setupInitialBoard());
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [turn, setTurn] = useState<'player' | 'bot'>('player');
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [narrator, setNarrator] = useState('اختر رقعة الشطرنج لبدء المعركة الذهنية!');

  function setupInitialBoard(): ChessBoard {
    const initial: ChessBoard = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Set up Black Pieces (Top rows)
    const blackBackRow: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const blackSymbols = { r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟' };
    for (let c = 0; c < 8; c++) {
      initial[0][c] = { type: blackBackRow[c], color: 'b', symbol: blackSymbols[blackBackRow[c]] };
      initial[1][c] = { type: 'p', color: 'b', symbol: blackSymbols['p'] };
    }

    // Set up White Pieces (Bottom rows - Player)
    const whiteBackRow: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const whiteSymbols = { r: '♖', n: '♘', b: '♗', q: '♕', k: '♔', p: '♙' };
    for (let c = 0; c < 8; c++) {
      initial[6][c] = { type: 'p', color: 'w', symbol: whiteSymbols['p'] };
      initial[7][c] = { type: whiteBackRow[c], color: 'w', symbol: whiteSymbols[whiteBackRow[c]] };
    }

    return initial;
  }

  const startGame = () => {
    setBoard(setupInitialBoard());
    setSelectedCell(null);
    setTurn('player');
    setPointsAwarded(false);
    setNarrator('بدأت القمة! انقر على أي من بيادقك البيضاء أو الأحجار بالأسفل لتحريكها!');
    setGameState('playing');
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameState !== 'playing' || turn !== 'player') return;

    const piece = board[r][c];

    if (selectedCell) {
      const sr = selectedCell.r;
      const sc = selectedCell.c;

      // If clicked the same spot or another team piece, change selection
      if (piece && piece.color === 'w') {
        setSelectedCell({ r, c });
        return;
      }

      // Validating simplified casual move rules (just standard chess square movement)
      const movePiece = board[sr][sc]!;
      let isValid = false;

      const dr = Math.abs(r - sr);
      const dc = Math.abs(c - sc);

      if (movePiece.type === 'p') {
        // Pawn move (one straight forward or take diagonal)
        if (movePiece.color === 'w') {
          if (c === sc && r === sr - 1 && !piece) isValid = true;
          else if (c === sc && sr === 6 && r === 4 && !piece) isValid = true; // double step
          else if (dr === 1 && dc === 1 && piece && piece.color === 'b') isValid = true; // capturing diagonal
        }
      } else if (movePiece.type === 'r') {
        // Rook move (straight horizontal/vertical)
        if (sr === r || sc === c) isValid = true;
      } else if (movePiece.type === 'b') {
        // Bishop diagonal
        if (dr === dc) isValid = true;
      } else if (movePiece.type === 'q') {
        // Queen (Straight or diagonal)
        if (sr === r || sc === c || dr === dc) isValid = true;
      } else if (movePiece.type === 'k') {
        // King (one step around)
        if (dr <= 1 && dc <= 1) isValid = true;
      } else if (movePiece.type === 'n') {
        // Knight (L-shape)
        if ((dr === 2 && dc === 1) || (dr === 1 && dc === 2)) isValid = true;
      }

      if (isValid) {
        // Execute move
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = movePiece;
        newBoard[sr][sc] = null;
        setBoard(newBoard);
        setSelectedCell(null);
        
        // Did we take the enemy King?
        if (piece && piece.type === 'k' && piece.color === 'b') {
          setGameState('won');
          setNarrator('يا لك من نابغة شطرنج عظيم! أطحت بملك الخصم وحققت المات! 🏆👑');
          if (!pointsAwarded) {
            onGameEnd(3); // Award 3 premium points for Chess crown!
            setPointsAwarded(true);
          }
          return;
        }

        setTurn('bot');
        setNarrator('دور الغريم الاصطناعي الآن. يفكر جلياً بسلامة خطوطه... 🤖');
        setTimeout(() => makeBotMove(newBoard), 1000);
      } else {
        setNarrator('❌ خطوة غير قانونية لهذا الحجر. الرجاء تكرار التوجيه القانوني!');
      }
    } else {
      if (piece && piece.color === 'w') {
        setSelectedCell({ r, c });
        setNarrator(`تركز على ${piece.symbol === '♙' ? 'البيدق' : piece.type.toUpperCase()}. انقر على مربع التوجيه لتتحرك!`);
      }
    }
  };

  const makeBotMove = (currentBoard: ChessBoard) => {
    // Collect all valid black pieces of AI
    const botPieces: { r: number; c: number; piece: Piece }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = currentBoard[r][c];
        if (p && p.color === 'b') botPieces.push({ r, c, piece: p });
      }
    }

    if (botPieces.length === 0) {
      setGameState('won');
      return;
    }

    // Shuffle and pick a casual piece to make a move forward or take a piece
    let moved = false;
    botPieces.sort(() => Math.random() - 0.5);

    for (const b of botPieces) {
      const candidates: { r: number; c: number }[] = [];
      const steps = [-1, 0, 1, 2];

      for (const dr of steps) {
        for (const dc of steps) {
          const targetR = b.r + dr;
          const targetC = b.c + dc;

          if (targetR >= 0 && targetR < 8 && targetC >= 0 && targetC < 8) {
            const dest = currentBoard[targetR][targetC];
            if (dest && dest.color === 'w') {
              // High priority to eat player piece!
              candidates.unshift({ r: targetR, c: targetC });
            } else if (!dest && (dr !== 0 || dc !== 0)) {
              candidates.push({ r: targetR, c: targetC });
            }
          }
        }
      }

      if (candidates.length > 0) {
        // Perform Bot move
        const target = candidates[0];
        const prevTargetPiece = currentBoard[target.r][target.c];

        const nextBoard = currentBoard.map(row => [...row]);
        nextBoard[target.r][target.c] = b.piece;
        nextBoard[b.r][b.c] = null;
        setBoard(nextBoard);

        if (prevTargetPiece && prevTargetPiece.type === 'k' && prevTargetPiece.color === 'w') {
          setGameState('lost');
          setNarrator('كش ملك! أطاح الذكاء الاصطناعي بملكك. رتب غبارك وثأر ثانية!');
          return;
        }

        moved = true;
        break;
      }
    }

    if (!moved) {
      setNarrator('لم يجد المعالج أي خطوة هجومية آمنة! دورك الآن لتكسر دفاعه!');
    } else {
      setNarrator('قام المعالج بخطوة هجومية مدروسة. دورك للتسديد مجدداً ⚔️');
    }
    setTurn('player');
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-4xl mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-amber-500/15 border border-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            👑
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">شطرنج حكايتنا: القمة الذكية</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            قم بابتكار تكتيكات هجومية مذهلة للوصول وحشر ملك الخصم والانتصار عليه لتحصد 3 نقاط مباشرة للإعلانات مدى الحياة!
          </p>
          <button
            onClick={startGame}
            className="px-10 py-4 bg-amber-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-amber-550/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            صف البيادق واللعب الفوري ♟️
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-center">
          
          {/* Ludo Info column */}
          <div className="md:col-span-4 space-y-4 text-right">
            <div className="bg-[#0c0c14] border border-white/5 p-5 rounded-[2rem] shadow-xl">
              <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest block mb-1">المحكّم الكلاسيكي للشطرنج</span>
              <p className="text-sm text-zinc-100 font-extrabold leading-relaxed">{narrator}</p>
            </div>

            <div className="bg-zinc-950/60 border border-white/10 p-4 rounded-2xl text-[10px] text-zinc-500 font-bold space-y-2 leading-relaxed">
              <p>💡 <span className="text-zinc-300">التعليمات بالتلميح:</span> انقر على الحجر الأبيض لتحديده (سيظهر تظليل حوله) ثم انقر على الخلية المستهدفة للتقدم القانوني أو أكل الحجر الأسود المعارض!</p>
              <p>👑 <span className="text-zinc-300">شرط الفوز:</span> تناول الملك الأسود (♚) لتحقيق النصر الكامل وحصد 3 نقاط ذهبية!</p>
            </div>
          </div>

          {/* Majestic 8x8 Board Column */}
          <div className="md:col-span-8 bg-[#0c0c14]/50 border-2 border-white/10 rounded-[2.5rem] p-4 sm:p-6 flex items-center justify-center shadow-2xl relative">
            <div className="grid grid-cols-8 grid-rows-8 aspect-square w-full max-w-lg md:max-w-md border-4 border-zinc-950 rounded-2xl overflow-hidden shadow-2xl bg-zinc-900">
              {board.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const isBlackSquare = (rIdx + cIdx) % 2 === 1;
                  const isSelected = selectedCell && selectedCell.r === rIdx && selectedCell.c === cIdx;
                  
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      className={`w-full h-full flex items-center justify-center text-xl sm:text-2xl transition-all cursor-pointer focus:outline-none relative select-none ${
                        isBlackSquare ? 'bg-[#1a110a]' : 'bg-[#e5d4c0]'
                      } ${
                        isSelected ? 'ring-4 ring-primary ring-inset bg-primary/20 bg-opacity-40 animate-pulse' : ''
                      }`}
                    >
                      {cell && (
                        <span className={`block font-black select-none ${
                          cell.color === 'w' ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]' : 'text-zinc-950 block drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]'
                        }`}>
                          {cell.symbol}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {(gameState === 'won' || gameState === 'lost') && (
        <div className="py-12 space-y-6 max-w-sm mx-auto">
          <div className={`p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2 text-5xl shadow-2xl ${
            gameState === 'won' ? 'bg-amber-400/10 text-amber-400 border border-amber-500/20' : 'bg-red-650/15 text-primary border border-primary/20'
          }`}>
             {gameState === 'won' ? '🥇' : '💀'}
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {gameState === 'won' ? 'فوز ذهبي كاسح! 👑' : 'سقط الملك هباءً!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-xs mx-auto">
              {gameState === 'won' 
                ? 'قدمت أداء باهراً جداً يضاهي جاري كاسباروف، وتم مكافأة محفظتك بثلاث نقاط بريميوم أبدية وبلا إعلانات!'
                : 'نجح الخصم المعالج في الإيقاع بك بمصيدة المات. غسل تكتيكك والعب مجدداً للانتقام الفوري!'}
            </p>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>خوض جولة شطرنج ثانية</span>
          </button>
        </div>
      )}
    </div>
  );
}
