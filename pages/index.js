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
        { id: Date.now() + Math.random(), x: Math.random() * 100, size: 8 + Math.random() * 12, duration: 1.5 + Math.random() * 1.5 }
      ]);
      setTimeout(() => { setParticles(prev => prev.filter(p => p.id !== prev[0]?.id)); }, 2500);
    }, 500);
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
    }, 2000);
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

  // --- UI Components ---
  const Mascot = ({ mood }) => (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: mood === 'wave' ? [0, -10, 0] : 0, opacity: 1 }}
      transition={{ y: { repeat: Infinity, duration: 2 }, opacity: { duration: 0.5 } }}
      className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-4 pointer-events-none"
    >
      <img src={`/mascot-${mood}.png`} alt="Liyu the Lion" className="w-full h-full object-contain" 
           onError={(e) => e.target.src = "https://cdn-icons-png.flaticon.com/512/1998/1998713.png"} /> 
    </motion.div>
  );

  const Card = ({ card, onClick, isPreview = false }) => {
    const showFront = card.isFlipped || card.isMatched || isPreview;
    return (
      <div className="relative aspect-square cursor-pointer perspective-1000" onClick={onClick}>
        <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${showFront ? 'rotate-y-180' : ''}`}>
          <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-[#FFD966] text-3xl font-bold opacity-20">?</span>
          </div>
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] to-[#d4af37] border-2 border-white/20 rounded-2xl flex items-center justify-center p-2 text-center shadow-2xl">
            <span className={`leading-tight font-black text-black ${card.type === 'ref' ? 'text-sm' : 'text-[9px]'}`}>{card.content}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#090909] text-white font-inter overflow-hidden relative selection:bg-[#FFD966] selection:text-black">
      <Head>
        <title>የመጽሐፍ ቅዱስ ትውስታ</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .font-inter { font-family: 'Inter', sans-serif; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* Background Particles */}
      <div className="fixed inset-0 pointer-events-none">
        {particles.map(p => (
          <motion.div key={p.id} initial={{ y: '110vh', x: `${p.x}%`, opacity: 0.5 }} animate={{ y: '-10vh', opacity: 0 }}
            transition={{ duration: p.duration, ease: 'linear' }} className="absolute text-[#FFD966]" style={{ fontSize: p.size }}>🪙</motion.div>
        ))}
      </div>

      <main className="relative z-10 max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center p-6">
        
        {/* START SCREEN */}
        {!gameActive && !gameFinished && !previewMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Mascot mood="wave" />
            <h1 className="text-5xl md:text-6xl font-black text-[#FFD966] mb-4 tracking-tighter">የመጽሐፍ ቅዱስ<br/>ትውስታ</h1>
            <p className="text-white/40 text-lg mb-10">ቃሉን በልብህ ለመያዝ ተዘጋጅተሃል?</p>
            <button onClick={initGame} className="bg-[#FFD966] hover:bg-[#ffe28a] text-black px-12 py-5 rounded-full font-black text-2xl shadow-[0_0_30px_rgba(255,217,102,0.3)] transition-all active:scale-95">ጀምር</button>
          </motion.div>
        )}

        {/* PREVIEW MODE */}
        {previewMode && (
          <div className="w-full text-center">
            <h2 className="text-[#FFD966] text-xl font-black mb-8 tracking-widest uppercase">ጥንቃቄ! ጥቅሶቹን አስታውስ...</h2>
            <div className="grid grid-cols-4 gap-3">{cards.map((c, i) => <Card key={i} card={c} isPreview />)}</div>
          </div>
        )}

        {/* GAMEPLAY */}
        {gameActive && !previewMode && (
          <div className="w-full">
            <div className="flex justify-between mb-8">
              <div className="bg-white/5 px-5 py-2 rounded-full border border-white/10 text-sm">🏃 እንቅስቃሴ: <b className="text-[#FFD966]">{moves}</b></div>
              <div className="bg-white/5 px-5 py-2 rounded-full border border-white/10 text-sm">⏱️ ጊዜ: <b className="text-[#FFD966]">{formatTime(time)}</b></div>
            </div>
            <div className="grid grid-cols-4 gap-3">{cards.map((c, i) => <Card key={i} card={c} onClick={() => handleCardClick(i)} />)}</div>
          </div>
        )}

        {/* FINISHED SCREEN */}
        {gameFinished && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full bg-white/[0.03] backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/10 text-center shadow-2xl">
            <Mascot mood="success" />
            <h2 className="text-4xl font-black text-[#FFD966] mb-8">ድንቅ ነው!</h2>
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
                <input type="text" placeholder="ስምህን አስገባ..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} 
                       className="w-full bg-black/60 border border-white/10 p-4 rounded-2xl text-center text-lg outline-none focus:border-[#FFD966] transition-all" />
                <button onClick={saveScore} className="w-full bg-[#FFD966] text-black py-4 rounded-2xl font-black shadow-lg">ውጤቴን አስቀምጥ</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-[#FFD966] font-bold">ውጤትህ በደረጃ ሰንጠረዥ ላይ ተቀምጧል! ✅</div>
                <button onClick={initGame} className="w-full bg-white text-black py-4 rounded-2xl font-black">እንደገና ተጫወት</button>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}