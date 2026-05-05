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

  // --- Sound Logic (Unchanged) ---
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
      } else if (type === 'win') {
        osc.frequency.value = 880;
        osc.start(now);
        osc.stop(now + 0.6);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  };

  useEffect(() => {
    fetchLeaderboard();
    startParticleEffect();
    return () => { if (particleInterval.current) clearInterval(particleInterval.current); };
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (error) { setLeaderboard([]); }
  };

  const startParticleEffect = () => {
    if (particleInterval.current) clearInterval(particleInterval.current);
    particleInterval.current = setInterval(() => {
      setParticles(prev => [
        ...prev,
        { id: Date.now() + Math.random(), x: Math.random() * 100, size: 8 + Math.random() * 12, duration: 2 }
      ]);
      setTimeout(() => { setParticles(prev => prev.filter(p => p.id !== prev[0]?.id)); }, 2500);
    }, 600);
  };

  const initGame = () => {
    let deck = [];
    verses.forEach((pair, idx) => {
      deck.push({ id: idx * 2, pairId: idx, type: 'ref', content: pair.reference, isFlipped: false, isMatched: false });
      deck.push({ id: idx * 2 + 1, pairId: idx, type: 'text', content: pair.text, isFlipped: false, isMatched: false });
    });
    deck.sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
    setTime(0);
    setGameFinished(false);
    setSaved(false);
    setPreviewMode(true);
    const allFlipped = deck.map(c => ({ ...c, isFlipped: true }));
    setCards(allFlipped);
    setTimeout(() => {
      setCards(allFlipped.map(c => ({ ...c, isFlipped: false })));
      setPreviewMode(false);
      setGameActive(true);
      if (timerInterval) clearInterval(timerInterval);
      const interval = setInterval(() => setTime(prev => prev + 1), 1000);
      setTimerInterval(interval);
    }, 2500);
  };

  const handleCardClick = (idx) => {
    if (!gameActive || previewMode) return;
    const card = cards[idx];
    if (card.isMatched || card.isFlipped || flippedIndices.length === 2) return;
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

  // --- Animation Helpers ---
  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const dropIn = {
    hidden: { y: -50, opacity: 0 },
    visible: (i) => ({ y: 0, opacity: 1, transition: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 } })
  };

  const puzzleIcons = ['🧩', '🔑', '✨', '💎', '🪙', '📖', '⛪', '🌟'];
  const ringStyle = { position: 'absolute', width: '300px', height: '300px', left: '50%', top: '50%', marginLeft: '-150px', marginTop: '-150px', pointerEvents: 'none' };
  const iconStyle = (index, total) => {
    const angle = (index / total) * 360;
    const radius = 130;
    return {
      position: 'absolute',
      left: `calc(50% + ${radius * Math.cos(angle * Math.PI / 180)}px)`,
      top: `calc(50% + ${radius * Math.sin(angle * Math.PI / 180)}px)`,
      transform: 'translate(-50%, -50%)',
      fontSize: '24px',
      filter: 'drop-shadow(0 0 10px rgba(255, 217, 102, 0.5))',
    };
  };

  return (
    <>
      <Head>
        <title>የመጽሐፍ ቅዱስ ትውስታ ጨዋታ</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .font-inter { font-family: 'Inter', sans-serif; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      <div className="min-h-screen bg-[#090909] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#090909] to-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-inter text-white">
        
        {/* Particle System */}
        <div className="fixed inset-0 pointer-events-none">
          {particles.map(p => (
            <motion.div key={p.id} initial={{ y: '110vh', x: `${p.x}%`, opacity: 0.6 }} animate={{ y: '-10vh', opacity: 0 }}
              transition={{ duration: p.duration, ease: 'linear' }} className="absolute text-[#FFD966]" style={{ fontSize: p.size }}>🪙</motion.div>
          ))}
        </div>

        {/* Puzzle Ring Animation (Visible only on Start Screen) */}
        {!gameActive && !gameFinished && !previewMode && (
          <motion.div style={ringStyle} animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="opacity-30">
            {puzzleIcons.map((icon, idx) => <div key={idx} style={iconStyle(idx, puzzleIcons.length)}>{icon}</div>)}
          </motion.div>
        )}

        <div className="z-10 w-full max-w-2xl">
          
          {/* START SCREEN */}
          {!gameActive && !gameFinished && !previewMode && (
            <div className="text-center">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 relative inline-block">
                <div className="absolute inset-0 rounded-full blur-2xl bg-[#FFD966]/20"></div>
                <img src="/vent logo.png" alt="Logo" className="relative w-28 h-28 mx-auto rounded-full border-4 border-[#FFD966]/30 object-cover shadow-2xl" />
              </motion.div>
              
              <div className="flex flex-col items-center mb-10">
                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: [0, -8, 0], opacity: 1 }} transition={{ y: { repeat: Infinity, duration: 2.5 } }} className="w-32 h-32 mb-4">
                  <img src="/mascot-wave.png" alt="Liyu" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'} />
                </motion.div>
                <h1 className="text-5xl md:text-6xl font-black text-[#FFD966] mb-4 tracking-tighter flex flex-wrap justify-center gap-x-4">
                  {titleWords.map((word, i) => <motion.span key={i} custom={i} initial="hidden" animate="visible" variants={dropIn}>{word}</motion.span>)}
                </h1>
                <p className="text-white/40 text-lg">የጥቅሱን ጥቅስ ከይዘቱ ጋር በፍጥነት አዛምድ</p>
              </div>

              <button onClick={initGame} className="bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black px-16 py-5 rounded-full font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">ጀምር</button>
            </div>
          )}

          {/* PREVIEW MODE */}
          {previewMode && (
            <div className="text-center">
              <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[#FFD966] text-2xl font-black mb-8 tracking-widest">አስታውስ!</motion.h2>
              <div className="grid grid-cols-4 gap-3">
                {cards.map((card, i) => (
                  <div key={i} className="aspect-square bg-gradient-to-br from-[#FFD966] to-[#d4af37] rounded-2xl flex items-center justify-center p-2 text-center shadow-xl">
                    <span className={`font-black text-black leading-tight ${card.type === 'ref' ? 'text-sm' : 'text-[9px]'}`}>{card.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GAMEPLAY */}
          {gameActive && !previewMode && (
            <div className="w-full">
              <div className="flex justify-between mb-8">
                <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-full text-sm">🏃 እንቅስቃሴ: <b className="text-[#FFD966]">{moves}</b></div>
                <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-full text-sm">⏱️ ጊዜ: <b className="text-[#FFD966]">{formatTime(time)}</b></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {cards.map((card, idx) => (
                  <div key={idx} className="relative aspect-square cursor-pointer perspective-1000" onClick={() => handleCardClick(idx)}>
                    <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${card.isFlipped || card.isMatched ? 'rotate-y-180' : ''}`}>
                      <div className="absolute inset-0 backface-hidden bg-[#1a1a1a] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-xl">
                        <span className="text-[#FFD966] text-2xl font-bold opacity-20">?</span>
                      </div>
                      <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] to-[#d4af37] rounded-2xl flex items-center justify-center p-2 text-center">
                        <span className={`font-black text-black leading-tight ${card.type === 'ref' ? 'text-sm' : 'text-[9px]'}`}>{card.content}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FINISHED SCREEN */}
          {gameFinished && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/[0.03] backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl">
              <motion.div animate={{ y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-40 h-40 mx-auto mb-4">
                <img src="/mascot-success.png" alt="Victory Liyu" className="w-full h-full object-contain" onError={(e) => e.target.style.display='none'} />
              </motion.div>
              <h2 className="text-4xl font-black text-[#FFD966] mb-8">እንኳን ደስ አለዎት!</h2>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div className="text-white/30 text-xs font-bold uppercase mb-1">እንቅስቃሴ</div>
                  <div className="text-3xl font-black">{moves}</div>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div className="text-white/30 text-xs font-bold uppercase mb-1">ጊዜ</div>
                  <div className="text-3xl font-black">{formatTime(time)}</div>
                </div>
              </div>

              {!saved ? (
                <div className="space-y-4">
                  <input type="text" placeholder="ስምዎን ያስገቡ..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} 
                         className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-center text-lg outline-none focus:border-[#FFD966] transition-all" />
                  <button onClick={saveScore} className="w-full bg-[#FFD966] text-black py-4 rounded-2xl font-black shadow-lg">ውጤቴን አስቀምጥ</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-green-500/20 text-green-400 py-3 rounded-xl border border-green-500/20">ውጤትዎ ተቀምጧል!</div>
                  <button onClick={initGame} className="w-full bg-white text-black py-4 rounded-2xl font-black">እንደገና ተጫወት</button>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>
    </>
  );
}