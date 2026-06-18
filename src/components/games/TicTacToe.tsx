import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Play } from 'lucide-react';

interface TicTacToeProps {
  onGameEnd: (pts: number) => void;
}

export default function TicTacToe({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost' | 'draw'>('idle');
  const [pointsAwarded, setPointsAwarded] = useState(false);

  const startNewGame = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameState('playing');
    setPointsAwarded(false);
  };

  const checkWinner = (tempBoard: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (tempBoard[a] && tempBoard[a] === tempBoard[b] && tempBoard[a] === tempBoard[c]) {
        return tempBoard[a];
      }
    }
    if (tempBoard.every(cell => cell !== null)) return 'draw';
    return null;
  };

  const handleCellClick = (index: number) => {
    if (board[index] || !isPlayerTurn || gameState !== 'playing') return;

    // Player Move
    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);

    const winner = checkWinner(newBoard);
    if (winner === 'X') {
      setGameState('won');
      if (!pointsAwarded) {
        onGameEnd(1); // 1 point for Tic Tac Toe win
        setPointsAwarded(true);
      }
      return;
    } else if (winner === 'draw') {
      setGameState('draw');
      return;
    }

    // Bot Move
    setIsPlayerTurn(false);
    setTimeout(() => {
      makeBotMove(newBoard);
    }, 600);
  };

  const makeBotMove = (currentBoard: (string | null)[]) => {
    const emptyIndices = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((val) => val !== null) as number[];

    if (emptyIndices.length === 0) return;

    // Smart choice: check if bot can win, or prevent player from winning
    let chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];

    // Check if bot can win in 1 move
    for (let i = 0; i < emptyIndices.length; i++) {
      const testBoard = [...currentBoard];
      testBoard[emptyIndices[i]] = 'O';
      if (checkWinner(testBoard) === 'O') {
        chosenIndex = emptyIndices[i];
        break;
      }
    }

    // Check if player can win in 1 move & block
    if (chosenIndex === null) {
      for (let i = 0; i < emptyIndices.length; i++) {
        const testBoard = [...currentBoard];
        testBoard[emptyIndices[i]] = 'X';
        if (checkWinner(testBoard) === 'X') {
          chosenIndex = emptyIndices[i];
          break;
        }
      }
    }

    const nextBoard = [...currentBoard];
    nextBoard[chosenIndex] = 'O';
    setBoard(nextBoard);

    const winner = checkWinner(nextBoard);
    if (winner === 'O') {
      setGameState('lost');
    } else if (winner === 'draw') {
      setGameState('draw');
    } else {
      setIsPlayerTurn(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-lg mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-red-650/15 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-pulse shadow-[0_0_30px_rgba(229,9,20,0.2)]">
            ❌
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">غرفة إكس أو التحدي المتبادل</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            لعبة XO الكلاسيكية سهلة وممتعة للغاية! العب ضد المعالج الذكي، واهزمه لتحرز نقطة إضافية ترفع بها طاقتك.
          </p>
          <button
            onClick={startNewGame}
            className="px-10 py-4 bg-primary text-white font-black text-xs rounded-2xl shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            خوض مبارزة XO ⚔️
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="space-y-6 w-full max-w-md mx-auto">
          {/* Active Turn Header */}
          <div className="bg-[#0c0c14] border border-white/5 p-4 rounded-2xl text-center">
            <span className="text-[10px] text-primary font-black uppercase tracking-widest block mb-1">منافسة إكس أو ممتعة</span>
            <p className="text-sm text-zinc-200 font-extrabold">
              {isPlayerTurn ? '⚡ دورك الآن (حركتك بـ X)' : '🤖 يفكر المعالج في مباغتتك الآن...'}
            </p>
          </div>

          {/* XO Gaming Grid Board */}
          <div className="bg-[#0c0c14]/40 border-2 border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative">
            <div className="grid grid-cols-3 gap-3 aspect-square w-full">
              {board.map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  disabled={cell !== null || !isPlayerTurn}
                  className={`w-full h-full rounded-2xl border-2 hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center text-4xl font-black cursor-pointer bg-zinc-900/60 ${
                    cell === 'X' 
                      ? 'border-primary text-primary shadow-[0_0_15px_rgba(229,9,20,0.15)]' 
                      : cell === 'O' 
                      ? 'border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                      : 'border-white/5'
                  }`}
                >
                  <AnimatePresence>
                    {cell && (
                      <motion.span
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="block font-black"
                      >
                        {cell}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(gameState === 'won' || gameState === 'lost' || gameState === 'draw') && (
        <div className="py-12 space-y-6 max-w-md mx-auto">
          <div className={`p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2 shadow-2xl ${
            gameState === 'won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : gameState === 'lost' ? 'bg-red-650/15 text-primary border border-primary/20' : 'bg-zinc-800 text-zinc-400 border border-white/5'
          }`}>
             <span className="text-5xl">{gameState === 'won' ? '🎉' : gameState === 'lost' ? '💀' : '🤝'}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {gameState === 'won' ? 'انتصرت بجدارة مطلقة! 🎉' : gameState === 'lost' ? 'تفوّق عليك المعالج!' : 'تعادل ودي ومحترم!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-xs mx-auto">
              {gameState === 'won' 
                ? 'لقد طبقت تكتيك XO لا غبار عليه وحشرت الخصم في الزاوية، وكسبت رصيد نقطة واحدة بحق!'
                : gameState === 'lost'
                ? 'المعالج الذكي وجد فجوة سريعة في دفاعاتك. لا تستسلم وحاول ثأرك في جولة حارقة ثانية!'
                : 'لقد أغلق كل منكما المنافذ على الآخر بإحكام تام. ابدأ جولة أخرى لكسر عظمة التعادل!'}
            </p>
          </div>

          <button
            onClick={startNewGame}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>خوض جولة XO أخرى ⚔️</span>
          </button>
        </div>
      )}
    </div>
  );
}
