import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import verses from '../data/verses.json';
import Head from 'next/head';

// --- Visual Juice Component: Tilt & Reflection ---
const InteractiveCard = ({ card, onClick, isPreview }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const sheenOpacity = useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.5]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const showFront = card.isFlipped || card.isMatched || isPreview;

  return (
    <motion.div 
      className="relative aspect-square cursor-pointer perspective-1000" 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
    >
      <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${showFront ? 'rotate-y-180' : ''}`}>
        
        {/* Back Side */}
        <div className="absolute inset-0 backface-hidden bg-[#121212] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#222_0%,_transparent_70%)] opacity-50"></div>
           <span className="text-[#FFD966] text-4xl font-black opacity-10">?</span>
           <motion.div style={{ left: sheenX, opacity: sheenOpacity }} className="absolute top-0 w-1/2 h-full bg-white/5 skew-x-12 blur-xl pointer-events-none" />
        </div>

        {/* Front Side (Gold Foil) */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] via-[#f7e4a1] to-[#d4af37] rounded-2xl flex items-center justify-center p-3 text-center shadow-[0_10px_30px_rgba(212,175,55,0.3)] overflow-hidden ${card.isMatched ? 'ring-4 ring-white ring-opacity-50' : ''}`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <motion.div 
            style={{ left: sheenX, opacity: 0.6 }} 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-25 translate-z-10" 
          />
          <span className={`relative z-10 font-black text-black leading-tight drop-shadow-sm select-none ${card.type === 'ref' ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[11px]'}`}>
            {card.content}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

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
  const [isSaving, setIsSaving] = useState(false); // loading state
  const [timerInterval, setTimerInterval] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [shake, setShake] = useState(false);
  const [bursts, setBursts] = useState([]);

  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.value = 0.05;
      if (type === 'flip') { osc.frequency.value = 600; osc.start(); osc.stop(ctx.currentTime + 0.1); }
      else if (type === 'match') { osc.frequency.value = 1000; osc.start(); osc.stop(ctx.currentTime + 0.2); }
    } catch (e) {}
  };

  useEffect(() => { 
    fetchLeaderboard(); 
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Leaderboard API error');
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error('Leaderboard fetch error:', e);
      setLeaderboard([]); 
    }
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
    setMoves(0); setTime(0); setGameFinished(false); setSaved(false); setPreviewMode(true);
    setTimeout(() => {
      setPreviewMode(false); setGameActive(true);
      const interval = setInterval(() => setTime(prev => prev + 1), 1000);
      setTimerInterval(interval);
    }, 3000);
  };

  const triggerBurst = (x, y) => {
    const id = Date.now();
    const particles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / 20 + Math.random(),
      speed: 3 + Math.random() * 4,
      size: 4 + Math.random() * 6,
      type: Math.random() > 0.5 ? 'star' : 'dot'
    }));
    setBursts(prev => [...prev, { id, x, y, particles }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1000);
  };

  const handleCardClick = (idx, e) => {
    if (!gameActive || previewMode || cards[idx].isFlipped || cards[idx].isMatched || flippedIndices.length === 2) return;

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
        setShake(true);
        setTimeout(() => setShake(false), 200);
        const rect = e.currentTarget.getBoundingClientRect();
        triggerBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
        newCards[i1].isMatched = true;
        newCards[i2].isMatched = true;
        setCards(newCards);
        setFlippedIndices([]);
        if (newCards.every(c => c.isMatched)) {
          setGameActive(false); setGameFinished(true);
          clearInterval(timerInterval);
        }
      } else {
        setTimeout(() => {
          newCards[i1].isFlipped = false;
          newCards[i2].isFlipped = false;
          setCards([...newCards]);
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const saveScore = async () => {
    if (!playerName.trim()) {
      alert('እባክዎ ስምዎን ያስገቡ');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), moves, time })
      });
      if (res.ok) {
        setSaved(true);
        await fetchLeaderboard(); // refresh leaderboard immediately
      } else {
        const errorText = await res.text();
        console.error('Save score failed:', errorText);
        alert(`ውጤት ማስቀመጥ አልተቻለም: ${errorText}`);
      }
    } catch (err) {
      console.error('Network error:', err);
      alert('የአውታረ መረብ ስህተት ተከስቷል');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');

  return (
    <div className={`min-h-screen bg-[#050505] text-white font-inter overflow-x-hidden selection:bg-[#FFD966] selection:text-black transition-all duration-100 ${shake ? 'rotate-[-0.5deg] scale-[1.01]' : ''}`}>
      <Head>
        <title>Bible Match 2.0</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .perspective-1000 { perspective: 1200px; }
        .glass-panel { 
            background: rgba(255, 255, 255, 0.04); 
            backdrop-filter: blur(24px); 
            border: 1px solid rgba(255, 217, 102, 0.15); 
            box-shadow: inset 0 0 20px rgba(255,255,255,0.02), 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 217, 102, 0.3); border-radius: 10px; }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        .logo-arc-outer {
          animation: spin-slow 12s linear infinite;
        }
        .logo-arc-inner {
          animation: spin-reverse 8s linear infinite;
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.08); }
        }
        .logo-glow {
          animation: glow-pulse 3s ease-in-out infinite;
        }
      `}</style>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }} 
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-[#d4af37]/10 blur-[120px] rounded-full"
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }} 
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-[#d4af37]/5 blur-[120px] rounded-full"
        />
      </div>

      {/* Particle Burst Layer */}
      {bursts.map(b => (
        <div key={b.id} className="fixed pointer-events-none z-50" style={{ left: b.x, top: b.y }}>
          {b.particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{ 
                scale: [0, 1, 0], 
                x: Math.cos(p.angle) * (p.speed * 40),
                y: Math.sin(p.angle) * (p.speed * 40),
                opacity: 0 
              }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className={`absolute rounded-full shadow-[0_0_12px_#FFD966] ${p.type === 'star' ? 'bg-white' : 'bg-[#FFD966]'}`}
              style={{ width: p.size, height: p.size }}
            />
          ))}
        </div>
      ))}

      <main className="relative z-10 w-full min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-12">
        
        {/* START SCREEN */}
        {!gameActive && !gameFinished && !previewMode && (
          <div className="my-auto w-full flex flex-col items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-center w-full max-w-lg py-8 sm:py-10 px-6 sm:px-12 rounded-[3rem] sm:rounded-[4rem] glass-panel relative overflow-hidden"
            >
              {/* Floating ambient sparkles */}
              {[...Array(5)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ opacity: [0, 1, 0], y: [0, -30], x: [0, (i % 2 === 0 ? 8 : -8)] }}
                  transition={{ duration: 2.5 + i * 0.6, repeat: Infinity, delay: i * 0.8 }}
                  className="absolute text-[#FFD966]/30 text-base select-none pointer-events-none"
                  style={{ top: `${25 + i * 12}%`, left: `${8 + i * 18}%` }}
                >
                  ✦
                </motion.div>
              ))}

              {/* ── Logo with premium glow frame ── */}
              <div className="relative flex justify-center items-center mb-6 sm:mb-8" style={{ height: '180px' }}>

                {/* Layered glow halos */}
                <div className="logo-glow absolute w-44 h-44 rounded-full bg-[#d4af37]/20 blur-2xl" />
                <div
                  className="logo-glow absolute w-36 h-36 rounded-full bg-[#FFD966]/15 blur-xl"
                  style={{ animationDelay: '0.5s' }}
                />

                {/* Outer dashed arc (clockwise) */}
                <svg
                  className="logo-arc-outer absolute"
                  width="176"
                  height="176"
                  viewBox="0 0 176 176"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="88"
                    cy="88"
                    r="82"
                    stroke="#FFD966"
                    strokeWidth="1.5"
                    strokeOpacity="0.35"
                    strokeDasharray="6 10"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Inner dashed arc (counter-clockwise, offset dash) */}
                <svg
                  className="logo-arc-inner absolute"
                  width="148"
                  height="148"
                  viewBox="0 0 148 148"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="74"
                    cy="74"
                    r="68"
                    stroke="#FFD966"
                    strokeWidth="1"
                    strokeOpacity="0.2"
                    strokeDasharray="3 14"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Four cardinal sparkle dots */}
                {[0, 90, 180, 270].map((deg, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.2, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                    className="absolute w-1.5 h-1.5 rounded-full bg-[#FFD966]"
                    style={{
                      top: `calc(50% + ${Math.round(Math.sin((deg * Math.PI) / 180) * 88)}px - 3px)`,
                      left: `calc(50% + ${Math.round(Math.cos((deg * Math.PI) / 180) * 88)}px - 3px)`,
                    }}
                  />
                ))}

                {/* Logo image */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                  className="relative z-20"
                >
                  <img 
                    src="/vent logo.png" 
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-[#FFD966]/60 shadow-[0_0_40px_rgba(255,217,102,0.3),0_0_80px_rgba(212,175,55,0.15)] object-cover"
                    alt="Logo"
                  />
                </motion.div>
              </div>

              {/* Mascot */}
              <div className="mb-6 sm:mb-8">
                <Mascot mood="wave" />
              </div>
              
              {/* Title & subtitle */}
              <div className="space-y-3 mb-8 sm:mb-10">
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] via-[#fceabb] to-[#d4af37] drop-shadow-xl leading-[1.1]">
                  {titleWords.join(' ')}
                </h1>
                <p className="text-[#FFD966]/70 text-base sm:text-lg font-medium tracking-wide">
                  ቃሉን በልብህ ለመያዝ የተዘጋጀ ጨዋታ
                </p>
              </div>

              <motion.button 
                onClick={initGame} 
                whileHover={{ scale: 1.05, translateY: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group relative w-full sm:w-auto px-16 py-5 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black font-black rounded-3xl text-xl sm:text-2xl shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)] transition-all overflow-hidden"
              >
                <span className="relative z-10">ጀምር</span>
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
              </motion.button>
            </motion.div>
          </div>
        )}

        {/* GAME GRID */}
        {(gameActive || previewMode) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl flex flex-col my-auto">
            <div className="flex justify-center gap-6 mb-10">
               <div className="glass-panel px-8 py-4 rounded-3xl flex flex-col items-center min-w-[120px]">
                 <span className="text-[11px] opacity-40 uppercase font-black tracking-[0.2em] mb-1">Moves</span>
                 <span className="text-[#FFD966] font-black text-3xl tabular-nums">{moves}</span> 
               </div>
               <div className="glass-panel px-8 py-4 rounded-3xl flex flex-col items-center min-w-[120px]">
                 <span className="text-[11px] opacity-40 uppercase font-black tracking-[0.2em] mb-1">Time</span>
                 <span className="text-[#FFD966] font-black text-3xl tabular-nums">
                    {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                 </span> 
               </div>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 sm:gap-6 p-2">
              {cards.map((card, i) => (
                <InteractiveCard key={i} card={card} isPreview={previewMode} onClick={(e) => handleCardClick(i, e)} />
              ))}
            </div>
          </motion.div>
        )}

        {/* FINISH SCREEN */}
        {gameFinished && (
          <div className="my-auto w-full flex justify-center px-2 sm:px-0">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel p-6 sm:p-10 md:p-14 rounded-[2.5rem] sm:rounded-[4rem] text-center w-full max-w-lg shadow-2xl"
            >
              <div className="mb-5 scale-110">
                <Mascot mood="success" />
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-[#FFD966] mb-2">ድንቅ ነው!</h2>
              <p className="text-white/40 mb-8 text-xs sm:text-sm font-bold uppercase tracking-[0.3em]">Game Complete</p>
              
              {/* Score summary */}
              <div className="flex gap-3 justify-center mb-8">
                <div className="glass-panel px-5 py-3 rounded-2xl flex flex-col items-center flex-1">
                  <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1">Moves</span>
                  <span className="text-[#FFD966] font-black text-2xl">{moves}</span>
                </div>
                <div className="glass-panel px-5 py-3 rounded-2xl flex flex-col items-center flex-1">
                  <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1">Time</span>
                  <span className="text-[#FFD966] font-black text-2xl">
                    {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {!saved ? (
                // Not saved yet – show input + save button
                <div className="space-y-3 mb-8 w-full">
                  <input 
                    type="text" 
                    placeholder="ስምዎን ያስገቡ..." 
                    value={playerName} 
                    onChange={e => setPlayerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-center outline-none focus:border-[#FFD966]/50 focus:bg-white/10 transition-all text-white font-bold text-base sm:text-lg"
                  />
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveScore} 
                    disabled={isSaving}
                    className="w-full bg-[#FFD966] text-black py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl shadow-lg shadow-[#FFD966]/10 active:opacity-80 touch-manipulation disabled:opacity-50"
                  >
                    {isSaving ? 'በማስቀመጥ ላይ...' : 'ውጤት አስቀምጥ'}
                  </motion.button>
                </div>
              ) : (
                // Saved – show success message and Play Again button
                <>
                  <div className="bg-green-500/20 border border-green-500/30 text-green-400 py-4 rounded-2xl font-bold mb-6">
                    ✅ ውጤትዎ በተሳካ ሁኔታ ተቀምጧል!
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={initGame}
                    className="w-full bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black py-5 rounded-3xl font-black text-2xl shadow-lg shadow-[#FFD966]/20 mb-6"
                  >
                    🔄 እንደገና ተጫወት
                  </motion.button>
                </>
              )}

              {/* Leaderboard – shown after save as well */}
              <div className="text-left bg-black/40 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
                <div className="flex justify-between items-center mb-3 sm:mb-4 border-b border-white/10 pb-2">
                  <p className="text-[10px] sm:text-[11px] opacity-40 font-black uppercase tracking-widest">Leaderboard</p>
                  <p className="text-[10px] sm:text-[11px] opacity-40 font-black uppercase tracking-widest">Top Scores</p>
                </div>
                <div className="max-h-44 overflow-y-auto -webkit-overflow-scrolling-touch custom-scrollbar space-y-2 sm:space-y-3 pr-1">
                  {leaderboard.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">No scores yet. Be the first!</p>
                  ) : (
                    leaderboard.map((l, i) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span className="font-bold text-sm flex items-center gap-2 sm:gap-3 truncate mr-2">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center rounded-full text-[9px] sm:text-[10px] ${i < 3 ? 'bg-[#FFD966] text-black' : 'bg-white/10 text-white/50'}`}>
                            {i + 1}
                          </span>
                          <span className="truncate">{l.name}</span>
                        </span>
                        <span className="text-[#FFD966] font-bold text-xs sm:text-sm opacity-80 flex-shrink-0">
                          {l.moves} <span className="text-[9px] sm:text-[10px] opacity-40 ml-0.5">moves</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* For non‑saved state, also provide a "Play Again" option (optional) */}
              {!saved && (
                <button
                  onClick={initGame}
                  className="mt-6 text-white/50 text-xs sm:text-sm font-black uppercase tracking-widest hover:text-white/80 transition-all duration-300 touch-manipulation"
                >
                  እንደገና ተጫወት (ያለ ማስቀመጥ)
                </button>
              )}
            </motion.div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto pt-10 pb-4 opacity-25 text-[10px] uppercase tracking-[0.4em] font-black text-center">
          Bible Game
        </footer>

      </main>
    </div>
  );
}

const Mascot = ({ mood }) => (
  <motion.div 
    animate={{ 
      y: mood === 'wave' ? [0, -20, 0] : [0, -10, 0],
      rotate: mood === 'success' ? [0, 8, -8, 0] : [0, 2, -2, 0],
      scale: mood === 'success' ? [1, 1.1, 1] : 1
    }} 
    transition={{ 
      repeat: Infinity, 
      duration: mood === 'wave' ? 3 : 2, 
      ease: "easeInOut" 
    }}
    className="w-28 h-28 sm:w-36 sm:h-36 mx-auto pointer-events-none drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
  >
    <img 
      src={mood === 'wave' ? '/mascot-wave.png' : '/mascot-success.png'} 
      onError={(e) => e.target.src = "https://cdn-icons-png.flaticon.com/512/1998/1998713.png"} 
      className="w-full h-full object-contain"
      alt="Mascot"
    />
  </motion.div>
);