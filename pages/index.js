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

  // --- Sound Effects Logic ---
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
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== prev[0]?.id));
      }, 2500);
    }, 500);
  };

  const initGame = () => {
    let deck = [];
    verses.forEach((pair, idx) => {
      deck.push({ id: idx * 2, pairId: idx, type: 'ref', content: pair.reference, isFlipped: false, isMatched: false });
      deck.push({ id: idx * 2 + 1, pairId: idx, type: 'text', content: pair.text, isFlipped: false, isMatched: false });
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
      const interval = setInterval(() => setTime(prev => prev + 1), 1000);
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
      if (newCards[i1].pairId === newCards[i2].pairId) {
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
    if (!playerName.trim()) return alert('እባክዎን ስምዎን ያስገቡ');
    const res = await fetch('/api/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName.trim(), moves, time })
    });
    if (res.ok) { setSaved(true); fetchLeaderboard(); }
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // --- Visual Helper Variables ---
  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const dropIn = {
    hidden: { y: -50, opacity: 0 },
    visible: (i) => ({ y: 0, opacity: 1, transition: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 } })
  };

  const puzzleIcons = ['🧩', '🔑', '✨', '💎', '🪙', '📖', '⛪', '🌟'];
  const ringStyle = { position: 'absolute', width: '280px', height: '280px', left: '50%', top: '50%', marginLeft: '-140px', marginTop: '-140px', pointerEvents: 'none' };
  
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

  // --- Sub-component: Card ---
  const Card = ({ card, onClick, isPreview = false }) => {
    const showFront = card.isFlipped || card.isMatched || isPreview;
    return (
      <div className="relative aspect-square cursor-pointer card-container" onClick={onClick}>
        <div className={`card-inner ${showFront ? 'is-flipped' : ''}`}>
          {/* Back Side */}
          <div className="card-face card-back bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-xl">
            <div className="text-[#FFD966] text-4xl font-bold opacity-30 select-none">?</div>
            <div className="absolute inset-2 border border-[#FFD966]/5 rounded-xl"></div>
          </div>
          {/* Front Side */}
          <div className="card-face card-front bg-gradient-to-br from-[#FFD966] to-[#d4af37] border-2 border-white/20 rounded-2xl flex items-center justify-center p-3 text-center shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50"></div>
            <span className={`relative z-10 leading-tight font-black text-black ${card.type === 'ref' ? 'text-sm sm:text-base' : 'text-[9px] sm:text-xs'}`}>
              {card.content}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>የመጽሐፍ ቅዱስ ትውስታ ጨዋታ</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .font-inter { font-family: 'Inter', sans-serif; }
        .card-container { perspective: 1000px; }
        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }
        .card-inner.is-flipped { transform: rotateY(180deg); }
        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 1rem;
        }
        .card-front { transform: rotateY(180deg); }
      `}</style>

      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#090909] to-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-inter">
        
        {/* Floating Particles */}
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: '80vh', x: `${p.x}%`, opacity: 1, scale: 0.5 }}
              animate={{ y: '-20vh', opacity: 0, scale: 1.2 }}
              transition={{ duration: p.duration, ease: 'easeOut' }}
              className="absolute text-yellow-400 pointer-events-none z-0"
              style={{ left: `${p.x}%`, bottom: 0, fontSize: p.size }}
            >🪙</motion.div>
          ))}
        </AnimatePresence>

        {/* Start Screen Ring */}
        {!gameActive && !gameFinished && !previewMode && (
          <motion.div style={ringStyle} animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} className="opacity-40">
            {puzzleIcons.map((icon, idx) => <div key={idx} style={iconStyle(idx, puzzleIcons.length)}>{icon}</div>)}
          </motion.div>
        )}

        {/* Content Layers */}
        <div className="z-10 w-full max-w-2xl">
          
          {/* 1. Preview Screen */}
          {previewMode && (
             <div className="flex flex-col items-center">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-[#FFD966] text-2xl font-black uppercase tracking-widest text-center">ማስታወሻ ጊዜ...</motion.div>
                <div className="grid grid-cols-4 gap-2 sm:gap-4 w-full">{cards.map((c, i) => <Card key={i} card={c} isPreview />)}</div>
             </div>
          )}

          {/* 2. Active Gameplay */}
          {gameActive && !previewMode && (
            <div className="flex flex-col items-center">
               <div className="flex justify-between w-full mb-8 px-2">
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md text-white/70 text-sm">🏃 እንቅስቃሴ: <b className="text-white ml-1">{moves}</b></div>
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md text-white/70 text-sm">⏱️ ጊዜ: <b className="text-white ml-1">{formatTime(time)}</b></div>
               </div>
               <div className="grid grid-cols-4 gap-2 sm:gap-4 w-full">{cards.map((c, i) => <Card key={i} card={c} onClick={() => handleCardClick(i)} />)}</div>
            </div>
          )}

          {/* 3. Game Finished / Leaderboard */}
          {gameFinished && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/[0.03] backdrop-blur-xl rounded-[2rem] p-8 text-center border border-white/10 shadow-2xl">
                <div className="text-6xl mb-6">🏆</div>
                <h2 className="text-3xl font-black text-[#FFD966] mb-8">ጨዋታው ተጠናቋል!</h2>
                <div className="flex gap-4 mb-8">
                  <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5"><div className="text-white/40 text-xs font-bold uppercase mb-1">እንቅስቃሴ</div><div className="text-3xl font-black text-white">{moves}</div></div>
                  <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5"><div className="text-white/40 text-xs font-bold uppercase mb-1">ጊዜ</div><div className="text-3xl font-black text-white">{formatTime(time)}</div></div>
                </div>
                {!saved ? (
                  <div className="space-y-4">
                    <input type="text" placeholder="ስምዎን ያስገቡ..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full p-4 rounded-2xl bg-black/40 text-white border border-white/10 focus:border-[#FFD966] outline-none text-center" />
                    <button onClick={saveScore} className="w-full bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black py-4 rounded-2xl font-black shadow-lg">ውጤቴን አስቀምጥ</button>
                    <button onClick={initGame} className="w-full text-white/40 hover:text-white transition-colors">እንደገና ጨዋታ</button>
                  </div>
                ) : (
                  <div className="space-y-6 text-left">
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 py-4 rounded-2xl font-bold text-center">✅ ውጤትዎ ተቀምጧል!</div>
                    <div className="bg-black/30 rounded-2xl p-5 border border-white/5">
                        <h3 className="text-[#FFD966] font-black mb-4">ከፍተኛ ውጤቶች</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                          {leaderboard.map((e, idx) => (
                            <div key={idx} className="flex justify-between text-sm py-2 border-b border-white/5 last:border-0">
                              <span className="text-white/80">{idx+1}. {e.name}</span>
                              <span className="text-white/40 font-mono">{e.moves} moves • {formatTime(e.time)}</span>
                            </div>
                          ))}
                        </div>
                    </div>
                    <button onClick={initGame} className="w-full bg-white text-black py-4 rounded-2xl font-black active:scale-95 transition-all">እንደገና ጨዋታ</button>
                  </div>
                )}
            </motion.div>
          )}

          {/* 4. Start Screen */}
          {!gameActive && !gameFinished && !previewMode && (
            <div className="text-center">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-10">
                <img src="/vent logo.png" alt="Logo" className="w-32 h-32 mx-auto rounded-full shadow-2xl border-4 border-[#FFD966]/30 object-cover bg-black" />
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-black text-[#FFD966] mb-6 flex flex-wrap justify-center gap-x-4">
                {titleWords.map((word, i) => <motion.span key={i} custom={i} initial="hidden" animate="visible" variants={dropIn}>{word}</motion.span>)}
              </h1>
              <p className="text-white/40 text-lg mb-10">የጥቅሱን ጥቅስ ከይዘቱ ጋር በፍጥነት አዛምድ</p>
              <button onClick={initGame} className="bg-gradient-to-r from-[#FFD966] via-[#f7e4a1] to-[#d4af37] text-black px-16 py-5 rounded-full font-black text-2xl shadow-2xl active:scale-95 transition-all">ጀምር</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}