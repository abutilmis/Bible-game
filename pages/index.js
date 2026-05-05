import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e) { setLeaderboard([]); }
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
        
        // Burst from card position
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
    if (!playerName.trim()) return alert('ስምዎን ያስገቡ');
    const res = await fetch('/api/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, moves, time })
    });
    if (res.ok) { setSaved(true); fetchLeaderboard(); }
  };

  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const ringIcons = ['📖', '✨', '🙏', '🔥', '💎', '⛪', '🕊️', '👑'];

  return (
    <div className={`min-h-screen bg-[#050505] text-white font-inter overflow-hidden transition-all duration-100 ${shake ? 'rotate-[-0.5deg] scale-[1.01]' : ''}`}>
      <Head>
        <title>Bible Match 2.0</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .perspective-1000 { perspective: 1200px; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); }
      `}</style>

      {/* Animated Background Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_#d4af37_0%,_transparent_40%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,_#d4af37_0%,_transparent_40%)]"></div>
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
                x: Math.cos(p.angle) * (p.speed * 30),
                y: Math.sin(p.angle) * (p.speed * 30),
                opacity: 0 
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`absolute rounded-full shadow-[0_0_10px_#FFD966] ${p.type === 'star' ? 'bg-white' : 'bg-[#FFD966]'}`}
              style={{ width: p.size, height: p.size }}
            />
          ))}
        </div>
      ))}

      <main className="relative z-10 max-w-4xl mx-auto min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
        
        {/* START SCREEN */}
        {!gameActive && !gameFinished && !previewMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="text-center w-full max-w-xl py-12 px-8 rounded-[3rem] glass-panel shadow-2xl relative overflow-hidden"
          >
            {/* Sparkle Decorations */}
            {[...Array(5)].map((_, i) => (
               <motion.div key={i} animate={{ opacity: [0, 1, 0], y: [0, -20] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }} className="absolute text-[#FFD966] text-xl" style={{ top: `${Math.random()*100}%`, left: `${Math.random()*100}%` }}>✨</motion.div>
            ))}

            <div className="relative mb-12 flex justify-center items-center">
               <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} className="w-64 h-64 border border-[#FFD966]/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,217,102,0.05)]">
                  {ringIcons.map((icon, i) => (
                    <motion.div key={i} animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 3, delay: i * 0.2 }} className="absolute text-xl shadow-lg" style={{ transform: `rotate(${i * 45}deg) translateY(-120px)` }}>{icon}</motion.div>
                  ))}
               </motion.div>
               <motion.div whileHover={{ scale: 1.1 }} className="absolute">
                  <img src="/vent logo.png" className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#FFD966] shadow-[0_0_50px_rgba(255,217,102,0.3)] object-cover" />
               </motion.div>
            </div>

            <Mascot mood="wave" />
            
            <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] to-[#d4af37] mb-4 drop-shadow-2xl">
               {titleWords.map((w, i) => <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="inline-block mr-2">{w}</motion.span>)}
            </h1>

            <p className="text-white/60 mb-10 text-sm sm:text-base tracking-wide">ቃሉን በልብህ ለመያዝ የተዘጋጀ ጨዋታ</p>

            <motion.button 
              onClick={initGame} 
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(255,217,102,0.5)" }}
              whileTap={{ scale: 0.95 }}
              className="px-16 py-5 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black font-black rounded-2xl text-2xl shadow-xl transition-all"
            >
              ጀምር
            </motion.button>
          </motion.div>
        )}

        {/* GAME GRID */}
        {(gameActive || previewMode) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
            <div className="flex justify-between mb-8">
               <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3">
                 <span className="text-[#FFD966] font-black text-xl">{moves}</span> 
                 <span className="text-[10px] opacity-50 uppercase font-bold tracking-widest">Moves</span>
               </div>
               <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3">
                 <span className="text-[#FFD966] font-black text-xl">{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}</span> 
                 <span className="text-[10px] opacity-50 uppercase font-bold tracking-widest">Time</span>
               </div>
            </div>
            {/* Grid-cols-3 on mobile, grid-cols-4 on desktop */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-5">
              {cards.map((card, i) => (
                <InteractiveCard key={i} card={card} isPreview={previewMode} onClick={(e) => handleCardClick(i, e)} />
              ))}
            </div>
          </motion.div>
        )}

        {/* FINISH SCREEN */}
        {gameFinished && (
           <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-10 sm:p-12 rounded-[3rem] text-center max-w-md w-full shadow-2xl relative">
              <Mascot mood="success" />
              <h2 className="text-4xl font-black text-[#FFD966] mb-2">ድንቅ ነው!</h2>
              <p className="text-white/40 mb-8 text-sm uppercase tracking-widest">ጨዋታውን ጨርሰሃል</p>
              
              <div className="space-y-4 mb-8">
                <input 
                  type="text" 
                  placeholder="ስምህን አስገባ" 
                  value={playerName} 
                  onChange={e => setPlayerName(e.target.value)} 
                  className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl text-center outline-none focus:border-[#FFD966] transition-all text-white font-bold" 
                />
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={saveScore} 
                  className="w-full bg-[#FFD966] text-black py-4 rounded-2xl font-black shadow-lg"
                >
                  ውጤት አስቀምጥ
                </motion.button>
              </div>

              <div className="text-left bg-black/20 rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar">
                <p className="text-[10px] opacity-30 font-bold mb-3 uppercase tracking-tighter">Leaderboard</p>
                {leaderboard.map((l, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-white/5 text-xs">
                    <span className="font-bold">{i+1}. {l.name}</span>
                    <span className="text-[#FFD966] opacity-70">{l.moves} moves • {Math.floor(l.time/60)}m {l.time%60}s</span>
                  </div>
                ))}
              </div>
              
              <button onClick={initGame} className="mt-8 text-[#FFD966] text-sm font-bold uppercase tracking-widest hover:opacity-100 opacity-60 transition-all">እንደገና ተጫወት</button>
           </motion.div>
        )}

        <footer className="mt-12 opacity-20 text-[10px] uppercase tracking-[0.3em] font-bold">
           © {new Date().getFullYear()} Bible Match Game
        </footer>

      </main>
    </div>
  );
}

const Mascot = ({ mood }) => (
  <motion.div 
    animate={{ 
      y: mood === 'wave' ? [0, -15, 0] : [0, -5, 0],
      rotate: mood === 'success' ? [0, 5, -5, 0] : 0 
    }} 
    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
    className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
  >
    <img 
      src={mood === 'wave' ? '/mascot-wave.png' : '/mascot-success.png'} 
      onError={(e) => e.target.src = "https://cdn-icons-png.flaticon.com/512/1998/1998713.png"} 
      className="w-full h-full object-contain"
    />
  </motion.div>
);