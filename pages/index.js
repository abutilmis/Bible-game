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

  // --- Sound effects (unchanged logic) ---
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
          delay: 0,
        }
      ]);
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== prev[0]?.id));
      }, 2500);
    }, 500);
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

  // --- Animation Variants ---
  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const dropIn = {
    hidden: { y: -50, opacity: 0 },
    visible: (i) => ({
      y: 0, opacity: 1,
      transition: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }
    })
  };

  const puzzleIcons = ['🧩', '🔑', '✨', '💎', '🪙', '📖', '⛪', '🌟'];
  const ringStyle = {
    position: 'absolute',
    width: '280px',
    height: '280px',
    left: 'calc(50% - 140px)',
    top: 'calc(50% - 140px)',
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
      fontSize: '24px',
      filter: 'drop-shadow(0 0 8px #FFD966)',
    };
  };

  // --- Reusable Components ---
  const Card = ({ card, onClick, isPreview = false }) => (
    <motion.div
      whileHover={!card.isMatched && !isPreview ? { scale: 1.05, y: -5 } : {}}
      whileTap={!card.isMatched && !isPreview ? { scale: 0.95 } : {}}
      className="relative aspect-square cursor-pointer perspective-1000"
      onClick={onClick}
    >
      <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${(card.isFlipped || card.isMatched || isPreview) ? 'rotate-y-180' : ''}`}>
        {/* Back */}
        <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-xl">
          <div className="text-[#FFD966] text-4xl font-bold opacity-30 select-none">?</div>
          <div className="absolute inset-2 border border-[#FFD966]/5 rounded-xl"></div>
        </div>
        {/* Front */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] to-[#d4af37] border-2 border-white/20 rounded-2xl flex items-center justify-center p-3 text-center shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50"></div>
          <span className={`relative z-10 leading-tight font-bold ${card.type === 'ref' ? 'text-black text-sm sm:text-base' : 'text-black/80 text-[10px] sm:text-xs'}`}>
            {card.content}
          </span>
        </div>
      </div>
    </motion.div>
  );

  // ========== SCREEN RENDERING ==========

  if (previewMode) {
    return (
      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#151515] to-[#090909] flex flex-col items-center justify-center p-6 font-inter">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h2 className="text-[#FFD966] text-2xl font-bold tracking-widest uppercase">ማስታወሻ ጊዜ</h2>
          <div className="h-1 w-24 bg-[#FFD966] mx-auto mt-2 rounded-full shadow-[0_0_10px_#FFD966]"></div>
        </motion.div>
        <div className="grid grid-cols-4 gap-3 max-w-2xl w-full">
          {cards.map((card, idx) => (
            <Card key={idx} card={card} isPreview={true} />
          ))}
        </div>
      </div>
    );
  }

  if (gameActive) {
    return (
      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#151515] to-[#090909] flex flex-col items-center justify-center p-4 font-inter">
        <div className="flex justify-between w-full max-w-2xl mb-8 px-2">
          <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-full flex items-center gap-3 backdrop-blur-sm">
            <span className="text-[#FFD966] text-lg">🏃</span>
            <span className="text-white/70 text-sm font-medium">እንቅስቃሴ: <b className="text-white text-base ml-1">{moves}</b></span>
          </div>
          <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-full flex items-center gap-3 backdrop-blur-sm">
            <span className="text-[#FFD966] text-lg">⏱️</span>
            <span className="text-white/70 text-sm font-medium">ጊዜ: <b className="text-white text-base ml-1">{formatTime(time)}</b></span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-2xl w-full">
          {cards.map((card, idx) => (
            <Card key={idx} card={card} onClick={() => handleCardClick(idx)} />
          ))}
        </div>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center p-6 font-inter">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="bg-white/[0.03] backdrop-blur-xl rounded-[2rem] p-8 md:p-12 max-w-lg w-full text-center border border-white/10 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FFD966] to-transparent"></div>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-6xl mb-6">🏆</motion.div>
          <h2 className="text-4xl font-black text-[#FFD966] mb-8 tracking-tight">እንኳን ደስ አለዎት!</h2>
          
          <div className="flex gap-4 mb-8">
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1">እንቅስቃሴ</div>
              <div className="text-3xl font-black text-white">{moves}</div>
            </div>
            <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1">ጊዜ</div>
              <div className="text-3xl font-black text-white">{formatTime(time)}</div>
            </div>
          </div>

          {!saved ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="ስምዎን ያስገቡ..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-4 rounded-2xl bg-black/40 text-white border border-white/10 focus:border-[#FFD966] outline-none transition-all text-center text-lg placeholder:text-white/20"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={saveScore} className="flex-[2] bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black py-4 rounded-2xl font-black shadow-lg shadow-[#FFD966]/20 active:scale-95 transition-transform">
                  ውጤቴን አስቀምጥ
                </button>
                <button onClick={initGame} className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/10 transition-colors">
                  እንደገና
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 py-4 rounded-2xl font-bold">
                ✅ ውጤትዎ በተሳካ ሁኔታ ተቀምጧል!
              </div>
              <div className="text-left">
                <h3 className="text-[#FFD966] font-black text-xl mb-4 flex items-center gap-2">🏆 ከፍተኛ ውጤቶች</h3>
                <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                  {leaderboard.map((entry, idx) => (
                    <div key={idx} className={`flex justify-between items-center px-6 py-4 border-b border-white/5 ${idx === 0 ? 'bg-[#FFD966]/10' : idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <span className="text-white/90 font-medium"><span className="text-[#FFD966] mr-3 font-mono">#{idx+1}</span> {entry.name}</span>
                      <span className="text-white/40 text-sm font-mono">{entry.moves} moves • {formatTime(entry.time)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={initGame} className="w-full bg-white text-black py-4 rounded-2xl font-black active:scale-95 transition-transform">እንደገና ጨዋታ</button>
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
        <meta name="description" content="Bible Memory Match - Amharic Edition" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#090909] to-[#050505] flex items-center justify-center p-6 relative overflow-hidden font-inter">
        
        {/* Particle System */}
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ y: '80vh', x: `${p.x}%`, opacity: 1, scale: 0.5 }}
            animate={{ y: '-20vh', opacity: 0, scale: 1.2 }}
            transition={{ duration: p.duration, ease: 'easeOut' }}
            className="absolute text-yellow-400 pointer-events-none z-0"
            style={{ left: `${p.x}%`, bottom: 0, fontSize: p.size }}
          >
            🪙
          </motion.div>
        ))}

        {/* Hero Background Ring */}
        <motion.div
          style={ringStyle}
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="opacity-40"
        >
          {puzzleIcons.map((icon, idx) => (
            <div key={idx} style={iconStyle(idx, puzzleIcons.length)} className="absolute">
              {icon}
            </div>
          ))}
        </motion.div>

        <div className="text-center max-w-xl w-full z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, type: 'spring' }}
            className="mb-10"
          >
            <div className="relative inline-block">
              <div className="absolute inset-0 rounded-full blur-2xl bg-[#FFD966]/20"></div>
              <img src="/vent logo.png" alt="Logo" className="relative w-32 h-32 mx-auto rounded-full shadow-2xl border-4 border-[#FFD966]/30 object-cover" />
            </div>
          </motion.div>

          <div className="mb-10">
            <h1 className="text-5xl md:text-6xl font-black text-[#FFD966] mb-6 flex flex-wrap justify-center gap-x-4 tracking-tighter drop-shadow-2xl">
              {titleWords.map((word, i) => (
                <motion.span key={i} custom={i} initial="hidden" animate="visible" variants={dropIn} className="inline-block">
                  {word}
                </motion.span>
              ))}
            </h1>
            <p className="text-white/40 text-lg md:text-xl font-medium tracking-wide max-w-md mx-auto">
              የጥቅሱን ጥቅስ ከይዘቱ ጋር በፍጥነት አዛምድ
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(255, 217, 102, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={initGame}
            className="bg-gradient-to-r from-[#FFD966] via-[#f7e4a1] to-[#d4af37] text-black px-16 py-5 rounded-full font-black text-2xl shadow-2xl transition-all"
          >
            ጀምር
          </motion.button>

          {/* Leaderboard Summary */}
          <div className="mt-16 text-left bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 backdrop-blur-md">
            <h3 className="text-[#FFD966] font-black text-xl mb-6 flex items-center gap-3">🏆 ከፍተኛ ውጤቶች</h3>
            {leaderboard.length === 0 ? (
              <p className="text-white/20 italic">ገና ምንም ውጤቶች አልተመዘገቡም...</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl border ${idx === 0 ? 'bg-[#FFD966]/10 border-[#FFD966]/20' : 'bg-white/5 border-transparent'}`}>
                    <span className="text-white font-bold flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${idx === 0 ? 'bg-[#FFD966] text-black' : 'bg-white/10'}`}>{idx+1}</span>
                      {entry.name}
                    </span>
                    <span className="text-white/40 font-mono text-sm">{entry.moves} moves • {formatTime(entry.time)}</span>
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