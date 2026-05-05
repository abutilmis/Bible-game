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

      <main className="relative z-10 w-full min-h-screen flex flex-col items-center p-6 md:p-12">
        
        {/* START SCREEN */}
        {!gameActive && !gameFinished && !previewMode && (
          <div className="my-auto w-full flex flex-col items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-center w-full max-w-2xl py-10 px-8 sm:px-12 rounded-[4rem] glass-panel relative overflow-hidden"
            >
              {/* Floating Sparkles */}
              {[...Array(6)].map((_, i) => (
                 <motion.div 
                    key={i} 
                    animate={{ 
                        opacity: [0, 1, 0], 
                        y: [0, -40],
                        x: [0, (i % 2 === 0 ? 10 : -10)] 
                    }} 
                    transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.7 }} 
                    className="absolute text-[#FFD966]/40 text-lg select-none" 
                    style={{ top: `${20 + Math.random()*60}%`, left: `${10 + Math.random()*80}%` }}
                >
                    ✨
                </motion.div>
              ))}

              <div className="relative mb-10 flex justify-center items-center h-72">
                 <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }} 
                    className="absolute w-64 h-64 border border-[#FFD966]/10 rounded-full flex items-center justify-center"
                 >
                    {ringIcons.map((icon, i) => (
                      <div 
                        key={i} 
                        className="absolute text-2xl filter drop-shadow-[0_0_8px_rgba(255,217,102,0.4)]" 
                        style={{ transform: `rotate(${i * 45}deg) translateY(-145px)` }}
                      >
                        {icon}
                      </div>
                    ))}
                 </motion.div>
                 
                 <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: 'spring', damping: 15 }}
                    className="relative z-20"
                 >
                    <img 
                        src="/vent logo.png" 
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-[#FFD966] shadow-[0_0_60px_rgba(255,217,102,0.25)] object-cover" 
                        alt="Logo"
                    />
                 </motion.div>
              </div>

              <div className="mb-8">
                <Mascot mood="wave" />
              </div>
              
              <div className="space-y-4 mb-12">
                <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] via-[#fceabb] to-[#d4af37] drop-shadow-xl leading-[1.1]">
                   {titleWords.join(' ')}
                </h1>
                <p className="text-[#FFD966]/70 text-lg sm:text-xl font-medium tracking-wide">
                    ቃሉን በልብህ ለመያዝ የተዘጋጀ ጨዋታ
                </p>
              </div>

              <motion.button 
                onClick={initGame} 
                whileHover={{ scale: 1.05, translateY: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-20 py-6 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black font-black rounded-3xl text-2xl shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)] transition-all overflow-hidden"
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
           <div className="my-auto w-full flex justify-center">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-10 sm:p-14 rounded-[4rem] text-center max-w-lg w-full shadow-2xl">
                <div className="mb-6 scale-125">
                    <Mascot mood="success" />
                </div>
                <h2 className="text-5xl font-black text-[#FFD966] mb-3">ድንቅ ነው!</h2>
                <p className="text-white/40 mb-10 text-sm font-bold uppercase tracking-[0.3em]">Game Complete</p>
                
                <div className="space-y-4 mb-10">
                  <input 
                    type="text" 
                    placeholder="ስምዎን ያስገቡ..." 
                    value={playerName} 
                    onChange={e => setPlayerName(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-center outline-none focus:border-[#FFD966]/50 focus:bg-white/10 transition-all text-white font-bold text-lg" 
                  />
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={saveScore} 
                    className="w-full bg-[#FFD966] text-black py-5 rounded-3xl font-black text-xl shadow-lg shadow-[#FFD966]/10"
                  >
                    ውጤት አስቀምጥ
                  </motion.button>
                </div>

                <div className="text-left bg-black/40 border border-white/5 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                    <p className="text-[11px] opacity-40 font-black uppercase tracking-widest">Leaderboard</p>
                    <p className="text-[11px] opacity-40 font-black uppercase tracking-widest">Top Scores</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {leaderboard.map((l, i) => (
                      <div key={i} className="flex justify-between items-center py-1 group">
                        <span className="font-bold text-sm sm:text-base flex items-center gap-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] ${i < 3 ? 'bg-[#FFD966] text-black' : 'bg-white/10 text-white/50'}`}>
                                {i + 1}
                            </span>
                            {l.name}
                        </span>
                        <span className="text-[#FFD966] font-bold text-sm opacity-80">
                            {l.moves} <span className="text-[10px] opacity-40 ml-1">moves</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button onClick={initGame} className="mt-10 text-[#FFD966] text-sm font-black uppercase tracking-widest hover:tracking-[0.25em] transition-all duration-300">
                    እንደገና ተጫወት
                </button>
             </motion.div>
           </div>
        )}

        <footer className="mt-auto pt-12 pb-4 opacity-30 text-[10px] sm:text-xs uppercase tracking-[0.4em] font-black text-center">
           © {new Date().getFullYear()} Vent Brand • Bible Memory Match
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
    className="w-32 h-32 sm:w-44 sm:h-44 mx-auto pointer-events-none drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
  >
    <img 
      src={mood === 'wave' ? '/mascot-wave.png' : '/mascot-success.png'} 
      onError={(e) => e.target.src = "https://cdn-icons-png.flaticon.com/512/1998/1998713.png"} 
      className="w-full h-full object-contain"
      alt="Mascot"
    />
  </motion.div>
);