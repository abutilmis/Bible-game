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
  
  // Tilt angles
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);
  
  // Dynamic Gold Shine Reflection
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const sheenOpacity = useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.5]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
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
      whileTap={{ scale: 0.95 }}
    >
      <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${showFront ? 'rotate-y-180' : ''}`}>
        
        {/* Back Side */}
        <div className="absolute inset-0 backface-hidden bg-[#121212] border-2 border-[#FFD966]/30 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent opacity-50"></div>
           <span className="text-[#FFD966] text-3xl font-black opacity-20">?</span>
           {/* Moving Shine Effect on Back */}
           <motion.div style={{ left: sheenX, opacity: sheenOpacity }} className="absolute top-0 w-1/2 h-full bg-white/10 skew-x-12 blur-xl pointer-events-none" />
        </div>

        {/* Front Side (Gold Foil) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] via-[#f7e4a1] to-[#d4af37] rounded-2xl flex items-center justify-center p-2 text-center shadow-[0_0_20px_rgba(255,217,102,0.4)] overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          {/* Real-time Dynamic Light Reflection */}
          <motion.div 
            style={{ left: sheenX, opacity: 0.6 }} 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-25 translate-z-10" 
          />
          <span className={`relative z-10 font-black text-black leading-tight drop-shadow-sm ${card.type === 'ref' ? 'text-sm' : 'text-[9.5px]'}`}>
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

  // --- Core Game Logic (Unchanged) ---
  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.value = 0.1;
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
    setBursts(prev => [...prev, { id, x, y }]);
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
        // MATCH BURST 2.0 & SCREEN SHAKE
        playSound('match');
        setShake(true);
        setTimeout(() => setShake(false), 300);
        triggerBurst(e.clientX, e.clientY);

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

  // --- Animation Variants ---
  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const ringIcons = ['📖', '✨', '🙏', '🔥', '💎', '⛪', '🕊️', '👑'];

  return (
    <div className={`min-h-screen bg-[#050505] text-white font-inter overflow-hidden transition-transform duration-100 ${shake ? 'scale-[1.02] rotate-1' : ''}`}>
      <Head>
        <title>Bible Match 2.0</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .perspective-1000 { perspective: 1200px; }
      `}</style>

      {/* Particle Burst 2.0 Layer */}
      {bursts.map(b => (
        <div key={b.id} className="fixed pointer-events-none z-50" style={{ left: b.x, top: b.y }}>
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{ 
                scale: [0, 1.5, 0], 
                x: (Math.random() - 0.5) * 200, 
                y: (Math.random() - 0.5) * 200,
                opacity: 0 
              }}
              className="absolute w-2 h-2 bg-[#FFD966] rounded-full shadow-[0_0_10px_#FFD966]"
            />
          ))}
        </div>
      ))}

      <main className="relative z-10 max-w-4xl mx-auto min-h-screen flex flex-col items-center justify-center p-6">
        
        {/* START SCREEN */}
        {!gameActive && !gameFinished && !previewMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            {/* Rotating Ring with Shader Glow */}
            <div className="relative mb-12">
               <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="w-64 h-64 border border-[#FFD966]/20 rounded-full flex items-center justify-center">
                  {ringIcons.map((icon, i) => (
                    <div key={i} className="absolute" style={{ transform: `rotate(${i * 45}deg) translateY(-120px)` }}>{icon}</div>
                  ))}
               </motion.div>
               <img src="/vent logo.png" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-[#FFD966] shadow-[0_0_50px_rgba(255,217,102,0.2)]" />
            </div>

            <Mascot mood="wave" />
            
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] to-[#d4af37] mb-4">
               {titleWords.map((w, i) => <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="inline-block mr-3">{w}</motion.span>)}
            </h1>

            <button onClick={initGame} className="mt-8 px-12 py-4 bg-[#FFD966] text-black font-black rounded-full text-xl hover:shadow-[0_0_30px_#FFD966] transition-all">ጀምር</button>
          </motion.div>
        )}

        {/* GAME GRID */}
        {(gameActive || previewMode) && (
          <div className="w-full max-w-2xl">
            <div className="flex justify-between mb-8">
               <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full flex items-center gap-2">
                 <span className="text-[#FFD966] font-bold">{moves}</span> <span className="text-xs opacity-50 uppercase tracking-widest">Moves</span>
               </div>
               <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full flex items-center gap-2">
                 <span className="text-[#FFD966] font-bold">{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}</span> <span className="text-xs opacity-50 uppercase tracking-widest">Time</span>
               </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {cards.map((card, i) => (
                <InteractiveCard key={i} card={card} isPreview={previewMode} onClick={(e) => handleCardClick(i, e)} />
              ))}
            </div>
          </div>
        )}

        {/* FINISH SCREEN */}
        {gameFinished && (
           <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/5 backdrop-blur-xl p-12 rounded-[3rem] border border-white/10 text-center max-w-md w-full">
              <Mascot mood="success" />
              <h2 className="text-4xl font-black text-[#FFD966] mb-6">ጨርሰሃል!</h2>
              <div className="space-y-4 mb-8">
                <input type="text" placeholder="ስምህን አስገባ" value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center outline-none focus:border-[#FFD966]" />
                <button onClick={saveScore} className="w-full bg-[#FFD966] text-black py-4 rounded-2xl font-black">ውጤት አስቀምጥ</button>
              </div>
              <div className="text-left max-h-40 overflow-y-auto pr-2">
                {leaderboard.map((l, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-white/5 text-sm">
                    <span>{i+1}. {l.name}</span>
                    <span className="opacity-50">{l.moves} moves</span>
                  </div>
                ))}
              </div>
              <button onClick={initGame} className="mt-8 text-[#FFD966] font-bold underline">እንደገና ተጫወት</button>
           </motion.div>
        )}

      </main>
    </div>
  );
}

// Simple Mascot Component
const Mascot = ({ mood }) => (
  <motion.div 
    animate={mood === 'wave' ? { y: [0, -10, 0] } : { scale: [1, 1.1, 1] }} 
    transition={{ repeat: Infinity, duration: 2 }}
    className="w-32 h-32 mx-auto mb-4"
  >
    <img 
      src={mood === 'wave' ? '/mascot-wave.png' : '/mascot-success.png'} 
      onError={(e) => e.target.src = "https://cdn-icons-png.flaticon.com/512/1998/1998713.png"} 
      className="w-full h-full object-contain"
    />
  </motion.div>
);