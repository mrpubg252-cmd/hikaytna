import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Play } from 'lucide-react';

interface SolitaireProps {
  onGameEnd: (pts: number) => void;
}

interface Card {
  id: number;
  symbol: string;
  suit: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function Solitaire({ onGameEnd }: { onGameEnd: (pts: number) => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [movesCount, setMovesCount] = useState(0);
  const [narrator, setNarrator] = useState('انقر على "ابدأ غزل الغرفة" لبدء تحدي مطابقة ورق سوليتير الملوكي!');

  const suitsAndSymbols = [
    { symbol: 'A', suit: '♠' },
    { symbol: 'K', suit: '♦' },
    { symbol: 'Q', suit: '♥' },
    { symbol: 'J', suit: '♣' },
    { symbol: '10', suit: '♠' },
    { symbol: 'A', suit: '♥' }
  ];

  const initializeCards = () => {
    // Creating pairs of 12 cards representing elite casino shapes
    const paired = [...suitsAndSymbols, ...suitsAndSymbols].map((item, index) => ({
      id: index,
      symbol: item.symbol,
      suit: item.suit,
      isFlipped: false,
      isMatched: false
    }));

    // Shuffle
    setCards(paired.sort(() => Math.random() - 0.5));
    setSelectedCards([]);
    setMovesCount(0);
    setNarrator('انطلقت الجولة! انقر على الأوراق لقلبها ومطابقة الأشكال المتطابقة بأقل من 15 محاولة!');
    setGameState('playing');
  };

  const handleCardClick = (id: number) => {
    if (gameState !== 'playing' || cards[id].isMatched || cards[id].isFlipped || selectedCards.length >= 2) return;

    // Flip the clicked card
    const updatedCards = [...cards];
    updatedCards[id].isFlipped = true;
    setCards(updatedCards);

    const nextSelected = [...selectedCards, id];
    setSelectedCards(nextSelected);

    if (nextSelected.length === 2) {
      setMovesCount(prev => prev + 1);
      const [firstId, secondId] = nextSelected;

      // Check Match
      if (cards[firstId].symbol === cards[secondId].symbol && cards[firstId].suit === cards[secondId].suit) {
        // Matched
        setTimeout(() => {
          const matchedCards = [...cards];
          matchedCards[firstId].isMatched = true;
          matchedCards[secondId].isMatched = true;
          setCards(matchedCards);
          setSelectedCards([]);
          setNarrator('🔥 تطابق باهر! تذوق متعة تصفية الأوراق بنجاح!');

          // Check win condition
          if (matchedCards.every(c => c.isMatched)) {
            setGameState('won');
            setNarrator('أستاذ السوليتير! كشفت كل الأوراق وربحت التحدي الثمين بنقطتين بريميوم مذهلتين! 🏆♠');
            onGameEnd(2);
          }
        }, 500);
      } else {
        // No match: Flip cards back after some delay
        setNarrator('❌ عذراً! الورقتان مختلفتان. ركز الذاكرة وحاول قلب أخريين!');
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[firstId].isFlipped = false;
          resetCards[secondId].isFlipped = false;
          setCards(resetCards);
          setSelectedCards([]);
        }, 1100);
      }
    }
  };

  // Check loss condition (over 15 moves)
  useEffect(() => {
    if (gameState === 'playing' && movesCount >= 15) {
      // Check if some unmatched remains
      const currentMatched = cards.filter(c => c.isMatched).length;
      if (currentMatched < 12) {
        setGameState('lost');
        setNarrator('انتهت خطواتك المتاحة (15). حاول غسل الأوراق وترتيب ذاكرتك لتفوز ثانية!');
      }
    }
  }, [movesCount, gameState, cards]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center select-none w-full max-w-4xl mx-auto">
      {gameState === 'idle' && (
        <div className="py-12 space-y-4 max-w-sm mx-auto">
          <div className="w-20 h-20 bg-amber-500/15 border border-amber-400/20 text-amber-400  rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-bounce shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            ♠
          </div>
          <h4 className="text-xl font-black italic text-white tracking-tight">سوليتير: طابق كروت الملوك</h4>
          <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-sm">
            تمتّع بلعبة سوليتير المطابقة الذكية الرائعة! افتح أوراق اللعب الملكية وابحث عن الرموز والبدلات المتشابهة بأقل من 15 محاولة لتحرز جائزتك.
          </p>
          <button
            onClick={initializeCards}
            className="px-10 py-4 bg-amber-500 text-black font-black text-xs rounded-2xl shadow-lg shadow-amber-550/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            صف وبدء التوزيع الزمني
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-center">
          
          {/* Narrator display */}
          <div className="md:col-span-4 space-y-4 text-right">
            <div className="bg-[#0c0c14] border border-white/5 p-5 rounded-[2rem] shadow-xl">
              <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest block mb-1">شاكر أوراق السوليتير</span>
              <p className="text-sm text-zinc-200 font-extrabold leading-relaxed">{narrator}</p>
            </div>

            <div className="grid grid-cols-2 bg-[#0c0c14]/40 border border-white/5 p-4 rounded-[1.5rem] text-center text-xs font-black divide-x divide-x-reverse divide-white/5 text-zinc-400">
              <div className="px-2">المحاولات: {movesCount} / 15 ⏱️</div>
              <div className="px-2 text-amber-400">المطابقة: {cards.filter(c => c.isMatched).length} / 12</div>
            </div>
          </div>

          {/* Cards board container */}
          <div className="md:col-span-8 bg-[#0c0c14]/50 border-2 border-white/10 rounded-[2.5rem] p-4 sm:p-6 flex items-center justify-center shadow-2xl relative">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full max-w-lg md:max-w-md aspect-square select-none">
              {cards.map((card) => {
                const isRed = card.suit === '♥' || card.suit === '♦';
                
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    className="w-full h-full relative aspect-[3/4] focus:outline-none cursor-pointer"
                  >
                    <AnimatePresence initial={false}>
                      {card.isFlipped || card.isMatched ? (
                        <motion.div
                          key="front"
                          initial={{ rotateY: 90, opacity: 0 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          exit={{ rotateY: 90, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0 bg-white rounded-xl flex flex-col justify-between p-2.5 shadow-xl border-2 border-[#fbbf24]"
                        >
                          {/* Inner details */}
                          <div className={`text-base font-black text-right ${isRed ? 'text-rose-600' : 'text-zinc-950'}`}>
                            {card.symbol} <span className="text-lg">{card.suit}</span>
                          </div>
                          
                          {/* Mega Center display */}
                          <div className={`text-3xl font-black self-center text-center leading-none ${isRed ? 'text-rose-600' : 'text-zinc-950'}`}>
                            {card.suit}
                          </div>

                          <div className={`text-xs font-bold text-left self-end ${isRed ? 'text-rose-600' : 'text-zinc-950'}`}>
                            {card.symbol}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="back"
                          initial={{ rotateY: -90, opacity: 0 }}
                          animate={{ rotateY: 0, opacity: 1 }}
                          exit={{ rotateY: -90, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-[#0c0c11] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center shadow-md hover:border-amber-500/30 active:scale-95 transition-transform"
                        >
                          <span className="text-xl text-amber-500/25 font-black uppercase">♠</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {(gameState === 'won' || gameState === 'lost') && (
        <div className="py-12 space-y-6 max-w-sm mx-auto">
          <div className={`p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-2 text-5xl shadow-2xl ${
            gameState === 'won' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-red-650/15 text-primary border border-primary/20'
          }`}>
             {gameState === 'won' ? '🥇' : '💀'}
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black italic tracking-tight text-white">
              {gameState === 'won' ? 'خبير سوليتير معتمد! 👑' : 'نفذ باق أوراقك المتطابقة!'}
            </h4>
            <p className="text-xs text-zinc-400 font-bold leading-relaxed max-w-xs mx-auto">
              {gameState === 'won' 
                ? 'مستويات ذاكرة خارقة وتخمين فائق الدقة، تذوق لذة الإنجاز بكسب ورشيد جيبك نقطتين عيار بريميوم!'
                : 'لقد قاربت من جدار التحلية وعززت محاولاتك، ولكن ريبال الوقت داهمك أولاً. حاول مراراً وثانية وفز!'}
            </p>
          </div>

          <button
            onClick={initializeCards}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-white hover:bg-zinc-200 text-black font-black text-xs rounded-2xl shadow-xl transition hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>صف وتوزيع جولة سوليتير جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
}
