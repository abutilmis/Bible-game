import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import verses from '../data/verses.json';
import Head from 'next/head';

export default function Home() {
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timerInterval, setTimerInterval] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [particles, setParticles] = useState([]);
  const particleInterval = useRef(null);

  // --- Sound effects (unchanged) ---
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 0.2;
      const osc = ctx.createOscillator();
      osc.connect(gain);
      if (type === 'flip') {
        osc.frequency.value = 800;
        gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'match') {
        osc.frequency.value = 1200;
        gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        const osc2 = ctx.createOscillator();
        osc2.connect(gain);
        osc2.frequency.value = 1500;
        osc2.start(now + 0.1);
        osc2.stop(now + 0.4);
      } else if (type === 'win') {
        osc.frequency.value = 880;
        osc.start(now);
        osc.stop(now + 0.2);
        const osc2 = ctx.createOscillator();
        osc2.connect(gain);
        osc2.frequency.value = 1100;
        osc2.start(now + 0.2);
        osc2.stop(now + 0.4);
        const osc3 = ctx.createOscillator();
        osc3.connect(gain);
        osc3.frequency.value = 1320;
        osc3.start(now + 0.4);
        osc3.stop(now + 0.6);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  };

  useEffect(() => {
    fetchLeaderboard();
    startParticleEffect();
    return () => {
      if (particleInterval.current) clearInterval(particleInterval.current);
    };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Leaderboard API failed');
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Leaderboard error:', error);
      setLeaderboard([]);
    }
  };

  const startParticleEffect = () => {
    if (particleInterval.current) clearInterval(particleInterval.current);
    particleInterval.current = setInterval(() => {
      setParticles(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          x: Math.random() * 100,
          y: 80,
          size: 8 + Math.random() * 12,
          duration: 1.5 + Math.random() * 1.5,
        }
      ]);
      setParticles(prev => prev.slice(-20)); 
    }, 600);
  };

  const initGame = () => {
    let deck = [];
    verses.forEach((pair, idx) => {
      deck.push({
        id: idx * 2,
        pairId: idx,
        type: 'ref',
        content: pair.reference,
        isFlipped: false,
        isMatched: false,
      });
      deck.push({
        id: idx * 2 + 1,
        pairId: idx,
        type: 'text',
        content: pair.text,
        isFlipped: false,
        isMatched: false,
      });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
    setTime(0);
    setGameFinished(false);
    setSaved(false);
    setGameActive(false);
    setPreviewMode(true);
    
    const allFlipped = deck.map(c => ({ ...c, isFlipped: true }));
    setCards(allFlipped);

    setTimeout(() => {
      const resetCards = allFlipped.map(c => ({ ...c, isFlipped: false }));
      setCards(resetCards);
      setPreviewMode(false);
      setGameActive(true);
      if (timerInterval) clearInterval(timerInterval);
      const interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
    }, 2000);
  };

  const handleCardClick = (idx) => {
    if (!gameActive || previewMode) return;
    const card = cards[idx];
    if (card.isMatched || card.isFlipped) return;
    if (flippedIndices.length === 2) return;

    playSound('flip');

    const newCards = [...cards];
    newCards[idx].isFlipped = true;
    setCards(newCards);
    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [i1, i2] = newFlipped;
      const card1 = newCards[i1];
      const card2 = newCards[i2];
      if (card1.pairId === card2.pairId) {
        playSound('match');
        newCards[i1].isMatched = true;
        newCards[i2].isMatched = true;
        setCards(newCards);
        setFlippedIndices([]);
        if (newCards.every(c => c.isMatched)) {
          playSound('win');
          setGameActive(false);
          setGameFinished(true);
          if (timerInterval) clearInterval(timerInterval);
        }
      } else {
        setTimeout(() => {
          const resetCards = [...cards];
          resetCards[i1].isFlipped = false;
          resetCards[i2].isFlipped = false;
          setCards(resetCards);
          setFlippedIndices([]);
        }, 800);
      }
    }
  };

  const saveScore = async () => {
    if (!playerName.trim()) {
      alert('እባክዎን ስምዎን ያስገቡ');
      return;
    }
    const res = await fetch('/api/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName.trim(), moves, time })
    });
    if (res.ok) {
      setSaved(true);
      await fetchLeaderboard();
    } else {
      alert('ውጤት ማስቀመጥ አልተቻለም');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const dropIn = {
    hidden: { y: -50, opacity: 0 },
    visible: (i) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }
    })
  };

  const puzzleIcons = ['🧩', '🔑', '✨', '💎', '🪙', '📖', '⛪', '🌟'];
  const ringStyle = {
    position: 'absolute',
    width: '280px',
    height: '280px',
    left: '50%',
    top: '50%',
    marginLeft: '-140px',
    marginTop: '-140px',
    pointerEvents: 'none',
  };
  const iconStyle = (index, total) => {
    const angle = (index / total) * 360;
    const radius = 120;
    return {
      position: 'absolute',
      left: `calc(50% + ${radius * Math.cos(angle * Math.PI / 180)}px)`,
      top: `calc(50% + ${radius * Math.sin(angle * Math.PI / 180)}px)`,
      transform: 'translate(-50%, -50%)',
      fontSize: '28px',
      filter: 'drop-shadow(0 0 8px rgba(255, 217, 102, 0.6))',
    };
  };

  const CardComponent = ({ card, idx, onClick }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={!card.isFlipped && !card.isMatched ? { scale: 1.05, translateY: -5 } : {}}
      className="relative aspect-[3/4] sm:aspect-square w-full cursor-pointer perspective-1000"
      onClick={onClick}
    >
      <motion.div
        className="w-full h-full relative preserve-3d transition-all duration-500"
        animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
      >
        {/* Back of Card */}
        <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border-2 border-[#FFD966]/30 rounded-xl flex items-center justify-center shadow-xl">
           <span className="text-4xl text-[#FFD966]/40 font-bold select-none">?</span>
           <div className="absolute inset-1 border border-[#FFD966]/10 rounded-lg pointer-events-none"></div>
        </div>
        
        {/* Front of Card */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] to-[#d4af37] rounded-xl flex items-center justify-center p-3 text-center shadow-2xl border-2 border-white/20 overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <span className={`relative z-10 font-bold leading-tight ${card.type === 'ref' ? 'text-[#1a1a1a] text-base sm:text-lg' : 'text-[#1a1a1a] text-[10px] sm:text-xs'}`}>
            {card.content}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );

  // ========== SCREEN RENDERING ==========

  if (previewMode) {
    return (
      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#151515] to-[#090909] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#FFD966]/10 border border-[#FFD966]/30 px-6 py-2 rounded-full mb-8"
        >
          <p className="text-[#FFD966] text-lg font-medium tracking-wide">✨ ጥቅሶቹን ያስታውሱ ✨</p>
        </motion.div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-2xl w-full">
          {cards.map((card, idx) => (
             <div key={idx} className="aspect-square bg-gradient-to-br from-[#FFD966] to-[#d4af37] border border-white/20 rounded-xl flex items-center justify-center text-center p-2 shadow-lg">
                <span className="text-[#1a1a1a] font-bold text-[10px] sm:text-xs leading-tight">{card.content}</span>
             </div>
          ))}
        </div>
      </div>
    );
  }

  if (gameActive) {
    return (
      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#151515] to-[#090909] flex flex-col items-center justify-center p-4">
        <div className="flex justify-between w-full max-w-2xl mb-8">
          <div className="bg-white/5 border border-white/10 backdrop-blur-md px-5 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
            <span className="text-[#FFD966] text-xl">🏃</span>
            <span className="text-white font-medium">እንቅስቃሴ: <span className="text-[#FFD966] ml-1">{moves}</span></span>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-md px-5 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
            <span className="text-[#FFD966] text-xl">⏱️</span>
            <span className="text-white font-medium">ጊዜ: <span className="text-[#FFD966] ml-1">{formatTime(time)}</span></span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl w-full">
          {cards.map((card, idx) => (
            <CardComponent key={idx} card={card} idx={idx} onClick={() => handleCardClick(idx)} />
          ))}
        </div>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[#FFD966]/40 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(255,217,102,0.15)] relative z-10"
        >
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-4xl font-extrabold text-[#FFD966] mb-6 tracking-tight">ጨዋታው ተጠናቋል!</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-white/60 text-sm mb-1 uppercase tracking-wider">እንቅስቃሴ</p>
                <p className="text-3xl font-bold text-white">{moves}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-white/60 text-sm mb-1 uppercase tracking-wider">የፈጀው ጊዜ</p>
                <p className="text-3xl font-bold text-white">{formatTime(time)}</p>
            </div>
          </div>

          {!saved ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="ስምዎን እዚህ ያስገቡ..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/50 text-white border border-white/10 focus:border-[#FFD966] outline-none transition-all text-center placeholder:text-white/20"
              />
              <div className="flex gap-3">
                <button 
                  onClick={saveScore} 
                  className="flex-1 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-[#1a1a1a] py-4 rounded-2xl font-bold hover:shadow-[0_0_20px_rgba(255,217,102,0.4)] transition-all active:scale-95"
                >
                  ውጤቴን አስቀምጥ
                </button>
                <button 
                  onClick={initGame} 
                  className="px-6 py-4 rounded-2xl bg-white/5 text-white font-semibold border border-white/10 hover:bg-white/10 transition-all"
                >
                  🔄
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 py-3 rounded-2xl font-medium">
                ✅ ውጤትዎ በተሳካ ሁኔታ ተቀምጧል!
              </div>
              
              <div className="text-left bg-black/40 rounded-2xl p-5 border border-white/5 overflow-hidden">
                <h3 className="text-[#FFD966] font-bold text-lg mb-4 flex items-center gap-2">
                  <span>🎖️</span> ከፍተኛ ውጤቶች
                </h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl ${idx === 0 ? 'bg-[#FFD966]/10 border border-[#FFD966]/20' : 'bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-[#FFD966] text-black' : 'bg-white/10 text-white'}`}>
                          {idx + 1}
                        </span>
                        <span className="text-white/90 font-medium">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-xs font-bold">{entry.moves} moves</p>
                        <p className="text-white/40 text-[10px]">{formatTime(entry.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={initGame} 
                className="w-full bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-[#1a1a1a] py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
              >
                እንደገና ጨዋታ
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>የመጽሐፍ ቅዱስ ትውስታ ጨዋታ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      
      <style jsx global>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 217, 102, 0.2); border-radius: 10px; }
      `}</style>

      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#090909] to-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        
        {/* Floating Particles */}
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: '100vh', x: `${p.x}%`, opacity: 0, scale: 0.5 }}
              animate={{ y: '-10vh', opacity: [0, 0.8, 0], scale: [0.5, 1, 0.8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.duration, ease: 'linear' }}
              className="absolute pointer-events-none z-0"
              style={{ fontSize: p.size }}
            >
              🪙
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="relative z-10 text-center max-w-xl w-full">
          {/* Logo Section */}
          <div className="relative mb-12">
            <motion.div
              style={ringStyle}
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            >
              {puzzleIcons.map((icon, idx) => (
                <div key={idx} style={iconStyle(idx, puzzleIcons.length)} className="drop-shadow-[0_0_10px_rgba(255,217,102,0.4)]">
                  {icon}
                </div>
              ))}
            </motion.div>
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, type: 'spring' }}
              className="relative z-20"
            >
              <div className="w-32 h-32 mx-auto rounded-full p-1 bg-gradient-to-tr from-[#FFD966] via-transparent to-[#FFD966] shadow-[0_0_30px_rgba(255,217,102,0.2)]">
                <img src="/vent logo.png" alt="Logo" className="w-full h-full rounded-full object-cover bg-[#090909]" />
              </div>
            </motion.div>
          </div>

          {/* Title Section */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-[#FFD966] mb-4 flex flex-wrap justify-center gap-x-3 gap-y-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              {titleWords.map((word, i) => (
                <motion.span key={i} custom={i} initial="hidden" animate="visible" variants={dropIn}>
                  {word}
                </motion.span>
              ))}
            </h1>
            <p className="text-white/60 text-lg font-light tracking-wide max-w-xs mx-auto">
              የጥቅሱን ጥቅስ ከይዘቱ ጋር በፍጥነት አዛምድ
            </p>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255, 217, 102, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={initGame}
            className="bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-[#1a1a1a] px-12 py-4 rounded-2xl font-black text-xl shadow-2xl mb-12 transition-all"
          >
            ጀምር
          </motion.button>

          {/* Leaderboard Summary */}
          <div className="bg-white/[0.03] border border-white/5 backdrop-blur-sm rounded-3xl p-6 text-left shadow-inner">
            <h3 className="text-[#FFD966] font-bold text-lg mb-4 flex items-center gap-2">
               <span>🏆</span> ከፍተኛ ውጤቶች
            </h3>
            {leaderboard.length === 0 ? (
              <p className="text-white/20 text-center py-4 italic">እስካሁን ምንም ውጤት የለም...</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {leaderboard.slice(0, 3).map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center text-white/80 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-[#FFD966] font-bold opacity-50">#0{idx+1}</span>
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <span className="text-xs font-mono text-white/40">{entry.moves} moves • {formatTime(entry.time)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}