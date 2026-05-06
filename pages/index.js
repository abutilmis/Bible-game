import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import verses from '../data/verses.json';
import Head from 'next/head';

const TOTAL_TIME = 120;
const LEVEL_CONFIGS = [3, 4, 5, 6, 7, 8]; // pairs per level
const MAX_LEVEL = LEVEL_CONFIGS.length; // 6 levels total

// ─── Helper: build a shuffled deck for a given pair count ───
const buildDeck = (pairCount) => {
  const deck = [];
  verses.slice(0, pairCount).forEach((pair, idx) => {
    deck.push({ id: idx * 2,     pairId: idx, type: 'ref',  content: pair.reference, isFlipped: false, isMatched: false });
    deck.push({ id: idx * 2 + 1, pairId: idx, type: 'text', content: pair.text,      isFlipped: false, isMatched: false });
  });
  return deck.sort(() => Math.random() - 0.5);
};

// ─── Tilt + Sheen Card ───
const InteractiveCard = ({ card, onClick, isPreview }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['15deg', '-15deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-15deg', '15deg']);
  const sheenX  = useTransform(mouseXSpring, [-0.5, 0.5], ['0%', '100%']);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width  - 0.5);
    y.set((e.clientY - rect.top)  / rect.height - 0.5);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  const showFront = card.isFlipped || card.isMatched || isPreview;

  return (
    <motion.div
      className="relative aspect-square cursor-pointer perspective-1000"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
    >
      <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${showFront ? 'rotate-y-180' : ''}`}>
        {/* Back */}
        <div className="absolute inset-0 backface-hidden bg-[#121212] border-2 border-[#FFD966]/20 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#222_0%,_transparent_70%)] opacity-50" />
          <span className="text-[#FFD966] text-4xl font-black opacity-10">?</span>
          <motion.div style={{ left: sheenX, opacity: 0.05 }} className="absolute top-0 w-1/2 h-full bg-white skew-x-12 blur-xl pointer-events-none" />
        </div>
        {/* Front */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-[#FFD966] via-[#f7e4a1] to-[#d4af37] rounded-2xl flex items-center justify-center p-3 text-center shadow-[0_10px_30px_rgba(212,175,55,0.3)] overflow-hidden ${card.isMatched ? 'ring-4 ring-white ring-opacity-50' : ''}`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <motion.div style={{ left: sheenX, opacity: 0.6 }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-25" />
          <span className={`relative z-10 font-black text-black leading-tight drop-shadow-sm select-none ${card.type === 'ref' ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[11px]'}`}>
            {card.content}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Level Banner overlay ───
const LevelBanner = ({ level, pairCount, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      key={`banner-${level}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      <div className="glass-panel px-16 py-10 rounded-[3rem] text-center shadow-2xl border border-[#FFD966]/30">
        <p className="text-[#FFD966]/60 text-sm font-black uppercase tracking-[0.4em] mb-2">
          {level === 1 ? 'Game Start' : 'Level Up!'}
        </p>
        <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] to-[#d4af37] mb-3">
          Level {level}
        </h2>
        <p className="text-white/50 font-bold text-lg tracking-wide">
          {pairCount} pairs · {pairCount * 2} cards
        </p>
      </div>
    </motion.div>
  );
};

export default function Home() {
  const [cards, setCards]               = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [moves, setMoves]               = useState(0);
  const [timeLeft, setTimeLeft]         = useState(TOTAL_TIME);
  const [gameActive, setGameActive]     = useState(false);
  const [level, setLevel]               = useState(1);
  // screen: 'start' | 'playing' | 'levelup' | 'finished' | 'gameover'
  const [screen, setScreen]             = useState('start');
  const [playerName, setPlayerName]     = useState('');
  const [saved, setSaved]               = useState(false);
  const [leaderboard, setLeaderboard]   = useState([]);
  const [isSaving, setIsSaving]         = useState(false);
  const [previewMode, setPreviewMode]   = useState(false);
  const [shake, setShake]               = useState(false);
  const [bursts, setBursts]             = useState([]);
  const [showBanner, setShowBanner]     = useState(false);
  const [cardsVisible, setCardsVisible] = useState(true);

  const timerRef      = useRef(null);
  const gameActiveRef = useRef(false);
  // Store final time used when game ends, so display is stable on finish screen
  const finalTimeRef  = useRef(0);
  const finalMovesRef = useRef(0);

  // ─── Sound ───
  const playSound = (type) => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.value = 0.05;
      if (type === 'flip')  { osc.frequency.value = 600;  osc.start(); osc.stop(ctx.currentTime + 0.1); }
      if (type === 'match') { osc.frequency.value = 1000; osc.start(); osc.stop(ctx.currentTime + 0.2); }
      if (type === 'level') {
        // two-tone fanfare
        [800, 1200].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          g.gain.value = 0.04;
          o.frequency.value = freq;
          o.start(ctx.currentTime + i * 0.12);
          o.stop(ctx.currentTime + i * 0.12 + 0.15);
        });
      }
    } catch (e) {}
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  // ─── Countdown ───
  useEffect(() => {
    if (!gameActive) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          gameActiveRef.current = false;
          setGameActive(false);
          setScreen('gameover');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameActive]);

  const stopTimer = () => clearInterval(timerRef.current);

  const fetchLeaderboard = async () => {
    try {
      const res  = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch { setLeaderboard([]); }
  };

  // ─── Start the whole game (level 1) ───
  const initGame = () => {
    stopTimer();
    const lv = 1;
    setLevel(lv);
    setMoves(0);
    setTimeLeft(TOTAL_TIME);
    setSaved(false);
    setPlayerName('');
    setFlippedIndices([]);
    setGameActive(false);
    gameActiveRef.current = false;
    setScreen('playing');
    setCardsVisible(false);

    // Brief banner, then preview, then play
    setShowBanner(true);
    setTimeout(() => {
      setShowBanner(false);
      const deck = buildDeck(LEVEL_CONFIGS[lv - 1]);
      setCards(deck);
      setCardsVisible(true);
      setPreviewMode(true);
      setTimeout(() => {
        setPreviewMode(false);
        setGameActive(true);
        gameActiveRef.current = true;
      }, 2000);
    }, 1200);
  };

  // ─── Advance to next level (timer + moves keep running) ───
  const advanceLevel = (currentMoves) => {
    playSound('level');
    stopTimer();
    gameActiveRef.current = false;
    setGameActive(false);

    const nextLevel = level + 1;

    // Fade out cards
    setCardsVisible(false);

    setTimeout(() => {
      setLevel(nextLevel);
      setFlippedIndices([]);
      setShowBanner(true);

      setTimeout(() => {
        setShowBanner(false);
        const deck = buildDeck(LEVEL_CONFIGS[nextLevel - 1]);
        setCards(deck);
        setCardsVisible(true);
        // No preview for level 2+; cards show face-down immediately
        setGameActive(true);
        gameActiveRef.current = true;
      }, 1200);
    }, 350); // wait for card fade-out
  };

  // ─── Burst particles ───
  const triggerBurst = (bx, by) => {
    const id        = Date.now();
    const particles = Array.from({ length: 20 }).map((_, i) => ({
      id:    i,
      angle: (Math.PI * 2 * i) / 20 + Math.random(),
      speed: 3 + Math.random() * 4,
      size:  4 + Math.random() * 6,
      type:  Math.random() > 0.5 ? 'star' : 'dot',
    }));
    setBursts(prev => [...prev, { id, x: bx, y: by, particles }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 1000);
  };

  // ─── Card click ───
  const handleCardClick = (idx, e) => {
    if (!gameActiveRef.current || previewMode || cards[idx].isFlipped || cards[idx].isMatched || flippedIndices.length === 2) return;

    playSound('flip');
    const newCards = [...cards];
    newCards[idx].isFlipped = true;
    setCards(newCards);
    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const newMoves = moves + 1;
      setMoves(newMoves);
      const [i1, i2] = newFlipped;

      if (newCards[i1].pairId === newCards[i2].pairId) {
        playSound('match');
        setShake(true);
        setTimeout(() => setShake(false), 200);
        const rect = e.currentTarget.getBoundingClientRect();
        triggerBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);

        newCards[i1].isMatched = true;
        newCards[i2].isMatched = true;
        setCards([...newCards]);
        setFlippedIndices([]);

        const allMatched = newCards.every(c => c.isMatched);
        if (allMatched) {
          stopTimer();
          gameActiveRef.current = false;
          setGameActive(false);

          if (level >= MAX_LEVEL) {
            // Final level complete → finished screen
            finalTimeRef.current  = TOTAL_TIME - timeLeft;
            finalMovesRef.current = newMoves;
            setTimeout(() => setScreen('finished'), 400);
          } else {
            setTimeout(() => advanceLevel(newMoves), 400);
          }
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

  // ─── Save score ───
  const saveScore = async () => {
    if (!playerName.trim()) { alert('እባክዎ ስምዎን ያስገቡ'); return; }
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-score', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: playerName.trim(), moves: finalMovesRef.current, time: finalTimeRef.current }),
      });
      if (res.ok) { setSaved(true); await fetchLeaderboard(); }
      else        { alert(`ውጤት ማስቀመጥ አልተቻለም: ${await res.text()}`); }
    } catch { alert('የአውታረ መረብ ስህተት ተከስቷል'); }
    finally  { setIsSaving(false); }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const countdownDanger  = timeLeft <= 30;
  const currentPairCount = LEVEL_CONFIGS[level - 1] ?? LEVEL_CONFIGS[MAX_LEVEL - 1];
  const titleWords       = 'የመጽሐፍ ቅዱስ ትውስታ ጨዋታ'.split(' ');

  // Column count for grid: 3 cols for ≤6 cards, else 4
  const gridCols = cards.length <= 6 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className={`min-h-screen bg-[#050505] text-white font-inter overflow-x-hidden selection:bg-[#FFD966] selection:text-black transition-all duration-100 ${shake ? 'rotate-[-0.5deg] scale-[1.01]' : ''}`}>
      <Head>
        <title>Bible Match 2.0</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .rotate-y-180    { transform: rotateY(180deg); }
        .preserve-3d     { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .perspective-1000 { perspective: 1200px; }
        .glass-panel {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,217,102,0.15);
          box-shadow: inset 0 0 20px rgba(255,255,255,0.02), 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .custom-scrollbar::-webkit-scrollbar       { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,217,102,0.3); border-radius: 10px; }
        .danger-pulse { animation: danger-pulse 0.8s ease-in-out infinite; }
        @keyframes danger-pulse {
          0%,100% { color: #ef4444; opacity: 1; }
          50%     { color: #ff0000; opacity: 0.7; }
        }
        @keyframes spin-slow    { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes spin-reverse { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        .logo-arc-outer { animation: spin-slow    12s linear infinite; }
        .logo-arc-inner { animation: spin-reverse  8s linear infinite; }
        @keyframes glow-pulse {
          0%,100% { opacity: 0.35; transform: scale(1);    }
          50%     { opacity: 0.65; transform: scale(1.08); }
        }
        .logo-glow { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale:[1,1.2,1], opacity:[0.2,0.3,0.2] }} transition={{ duration:10, repeat:Infinity }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-[#d4af37]/10 blur-[120px] rounded-full" />
        <motion.div animate={{ scale:[1.2,1,1.2], opacity:[0.1,0.2,0.1] }} transition={{ duration:12, repeat:Infinity }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-[#d4af37]/5 blur-[120px] rounded-full" />
      </div>

      {/* ── Particle bursts ── */}
      {bursts.map(b => (
        <div key={b.id} className="fixed pointer-events-none z-50" style={{ left: b.x, top: b.y }}>
          {b.particles.map(p => (
            <motion.div key={p.id}
              initial={{ scale:0, x:0, y:0, opacity:1 }}
              animate={{ scale:[0,1,0], x: Math.cos(p.angle)*(p.speed*40), y: Math.sin(p.angle)*(p.speed*40), opacity:0 }}
              transition={{ duration:0.9, ease:'easeOut' }}
              className={`absolute rounded-full shadow-[0_0_12px_#FFD966] ${p.type==='star'?'bg-white':'bg-[#FFD966]'}`}
              style={{ width:p.size, height:p.size }}
            />
          ))}
        </div>
      ))}

      {/* ── Level-up / start banner (sits above everything) ── */}
      <AnimatePresence>
        {showBanner && screen === 'playing' && (
          <LevelBanner
            level={level}
            pairCount={LEVEL_CONFIGS[level - 1]}
            onDone={() => {}} // timer handled internally
          />
        )}
      </AnimatePresence>

      <main className="relative z-10 w-full min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-12">
        <AnimatePresence mode="wait">

          {/* ════ START SCREEN ════ */}
          {screen === 'start' && (
            <motion.div key="start"
              initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              transition={{ duration:0.35 }}
              className="my-auto w-full flex flex-col items-center"
            >
              <div className="text-center w-full max-w-lg py-8 sm:py-10 px-6 sm:px-12 rounded-[3rem] sm:rounded-[4rem] glass-panel relative overflow-hidden">
                {[...Array(5)].map((_,i) => (
                  <motion.div key={i}
                    animate={{ opacity:[0,1,0], y:[0,-30], x:[0,(i%2===0?8:-8)] }}
                    transition={{ duration:2.5+i*0.6, repeat:Infinity, delay:i*0.8 }}
                    className="absolute text-[#FFD966]/30 text-base select-none pointer-events-none"
                    style={{ top:`${25+i*12}%`, left:`${8+i*18}%` }}
                  >✦</motion.div>
                ))}

                {/* Logo */}
                <div className="relative flex justify-center items-center mb-6 sm:mb-8" style={{ height:'180px' }}>
                  <div className="logo-glow absolute w-44 h-44 rounded-full bg-[#d4af37]/20 blur-2xl" />
                  <div className="logo-glow absolute w-36 h-36 rounded-full bg-[#FFD966]/15 blur-xl" style={{ animationDelay:'0.5s' }} />
                  <svg className="logo-arc-outer absolute" width="176" height="176" viewBox="0 0 176 176" fill="none">
                    <circle cx="88" cy="88" r="82" stroke="#FFD966" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="6 10" strokeLinecap="round"/>
                  </svg>
                  <svg className="logo-arc-inner absolute" width="148" height="148" viewBox="0 0 148 148" fill="none">
                    <circle cx="74" cy="74" r="68" stroke="#FFD966" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 14" strokeLinecap="round"/>
                  </svg>
                  {[0,90,180,270].map((deg,i) => (
                    <motion.div key={i}
                      animate={{ opacity:[0.2,1,0.2], scale:[0.6,1.2,0.6] }}
                      transition={{ duration:2, repeat:Infinity, delay:i*0.5 }}
                      className="absolute w-1.5 h-1.5 rounded-full bg-[#FFD966]"
                      style={{
                        top:  `calc(50% + ${Math.round(Math.sin((deg*Math.PI)/180)*88)}px - 3px)`,
                        left: `calc(50% + ${Math.round(Math.cos((deg*Math.PI)/180)*88)}px - 3px)`,
                      }}
                    />
                  ))}
                  <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:'spring', damping:15, delay:0.1 }} className="relative z-20">
                    <img src="/vent logo.png" className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-[#FFD966]/60 shadow-[0_0_40px_rgba(255,217,102,0.3),0_0_80px_rgba(212,175,55,0.15)] object-cover" alt="Logo" />
                  </motion.div>
                </div>

                <div className="mb-6 sm:mb-8"><Mascot mood="wave" /></div>

                <div className="space-y-3 mb-8 sm:mb-10">
                  <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFD966] via-[#fceabb] to-[#d4af37] drop-shadow-xl leading-[1.1]">
                    {titleWords.join(' ')}
                  </h1>
                  <p className="text-[#FFD966]/70 text-base sm:text-lg font-medium tracking-wide">ቃሉን በልብህ ለመያዝ የተዘጋጀ ጨዋታ</p>
                  <p className="text-white/30 text-xs font-bold tracking-widest uppercase">
                    {MAX_LEVEL} levels · {Math.floor(TOTAL_TIME/60)} min · 3→8 pairs
                  </p>
                </div>

                <motion.button onClick={initGame}
                  whileHover={{ scale:1.05, translateY:-2 }} whileTap={{ scale:0.95 }}
                  className="group relative w-full sm:w-auto px-16 py-5 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black font-black rounded-3xl text-xl sm:text-2xl shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)] overflow-hidden"
                >
                  <span className="relative z-10">ጀምር</span>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ════ PLAYING SCREEN ════ */}
          {screen === 'playing' && (
            <motion.div key="playing"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.3 }}
              className="w-full max-w-2xl flex flex-col my-auto"
            >
              {/* ── Stats bar ── */}
              <div className="flex justify-center gap-3 mb-8 flex-wrap">
                {/* Level pill */}
                <div className="glass-panel px-5 py-3 rounded-3xl flex flex-col items-center min-w-[80px]">
                  <span className="text-[11px] opacity-40 uppercase font-black tracking-[0.2em] mb-1">Level</span>
                  <span className="text-[#FFD966] font-black text-3xl tabular-nums">{level}</span>
                </div>
                {/* Moves */}
                <div className="glass-panel px-5 py-3 rounded-3xl flex flex-col items-center min-w-[80px]">
                  <span className="text-[11px] opacity-40 uppercase font-black tracking-[0.2em] mb-1">Moves</span>
                  <span className="text-[#FFD966] font-black text-3xl tabular-nums">{moves}</span>
                </div>
                {/* Countdown */}
                <div className={`glass-panel px-5 py-3 rounded-3xl flex flex-col items-center min-w-[110px] transition-colors duration-500 ${countdownDanger ? 'border-red-500/40 bg-red-900/10' : ''}`}>
                  <span className="text-[11px] opacity-40 uppercase font-black tracking-[0.2em] mb-1">Time Left</span>
                  <span className={`font-black text-3xl tabular-nums ${countdownDanger ? 'danger-pulse' : 'text-[#FFD966]'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Level progress dots */}
              <div className="flex justify-center gap-2 mb-6">
                {LEVEL_CONFIGS.map((_, i) => (
                  <motion.div key={i}
                    animate={{ scale: i + 1 === level ? 1.3 : 1, opacity: i + 1 <= level ? 1 : 0.25 }}
                    className={`rounded-full ${i + 1 === level ? 'w-4 h-4 bg-[#FFD966] shadow-[0_0_10px_#FFD966]' : i + 1 < level ? 'w-3 h-3 bg-[#d4af37]' : 'w-3 h-3 bg-white/20'}`}
                  />
                ))}
              </div>

              {/* Preview hint */}
              {previewMode && (
                <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
                  className="text-center mb-4 text-[#FFD966]/70 text-sm font-bold uppercase tracking-widest"
                >
                  ቁርጥቁሮቹን ተመልከት…
                </motion.div>
              )}

              {/* ── Cards grid ── */}
              <motion.div
                animate={{ opacity: cardsVisible ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className={`grid ${gridCols} gap-4 sm:gap-5 p-2`}
              >
                {cards.map((card, i) => (
                  <InteractiveCard key={`${level}-${card.id}`} card={card} isPreview={previewMode} onClick={(e) => handleCardClick(i, e)} />
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* ════ FINISHED SCREEN ════ */}
          {screen === 'finished' && (
            <motion.div key="finished"
              initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.4, ease:'easeOut' }}
              className="my-auto w-full flex justify-center px-2 sm:px-0"
            >
              <div className="glass-panel p-6 sm:p-10 md:p-14 rounded-[2.5rem] sm:rounded-[4rem] text-center w-full max-w-lg shadow-2xl">
                <div className="mb-5 scale-110"><Mascot mood="success" /></div>
                <h2 className="text-4xl sm:text-5xl font-black text-[#FFD966] mb-1">ድንቅ ነው!</h2>
                <p className="text-white/40 mb-1 text-xs font-bold uppercase tracking-[0.3em]">All {MAX_LEVEL} Levels Complete!</p>
                <p className="text-white/20 text-xs mb-8 tracking-widest">3 → 4 → 5 → 6 → 7 → 8 pairs</p>

                <div className="flex gap-3 justify-center mb-8">
                  <div className="glass-panel px-5 py-3 rounded-2xl flex flex-col items-center flex-1">
                    <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1">Total Moves</span>
                    <span className="text-[#FFD966] font-black text-2xl">{finalMovesRef.current}</span>
                  </div>
                  <div className="glass-panel px-5 py-3 rounded-2xl flex flex-col items-center flex-1">
                    <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1">Time Used</span>
                    <span className="text-[#FFD966] font-black text-2xl">{formatTime(finalTimeRef.current)}</span>
                  </div>
                </div>

                {!saved ? (
                  <div className="space-y-3 mb-8 w-full">
                    <input type="text" placeholder="ስምዎን ያስገቡ..." value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-center outline-none focus:border-[#FFD966]/50 focus:bg-white/10 transition-all text-white font-bold text-base sm:text-lg"
                    />
                    <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                      onClick={saveScore} disabled={isSaving}
                      className="w-full bg-[#FFD966] text-black py-4 sm:py-5 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl shadow-lg shadow-[#FFD966]/10 disabled:opacity-50"
                    >
                      {isSaving ? 'በማስቀመጥ ላይ...' : 'ውጤት አስቀምጥ'}
                    </motion.button>
                  </div>
                ) : (
                  <>
                    <div className="bg-green-500/20 border border-green-500/30 text-green-400 py-4 rounded-2xl font-bold mb-6">
                      ✅ ውጤትዎ በተሳካ ሁኔታ ተቀምጧል!
                    </div>
                    <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                      onClick={initGame}
                      className="w-full bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black py-5 rounded-3xl font-black text-2xl shadow-lg shadow-[#FFD966]/20 mb-6"
                    >
                      🔄 እንደገና ተጫወት
                    </motion.button>
                  </>
                )}

                {/* Leaderboard */}
                <div className="text-left bg-black/40 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full">
                  <div className="flex justify-between items-center mb-3 sm:mb-4 border-b border-white/10 pb-2">
                    <p className="text-[10px] sm:text-[11px] opacity-40 font-black uppercase tracking-widest">Leaderboard</p>
                    <p className="text-[10px] sm:text-[11px] opacity-40 font-black uppercase tracking-widest">Top Scores</p>
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-2 sm:space-y-3 pr-1">
                    {leaderboard.length === 0 ? (
                      <p className="text-white/40 text-sm text-center py-4">No scores yet. Be the first!</p>
                    ) : leaderboard.map((l, i) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span className="font-bold text-sm flex items-center gap-2 sm:gap-3 truncate mr-2">
                          <span className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center rounded-full text-[9px] sm:text-[10px] ${i<3?'bg-[#FFD966] text-black':'bg-white/10 text-white/50'}`}>
                            {i + 1}
                          </span>
                          <span className="truncate">{l.name}</span>
                        </span>
                        <span className="text-[#FFD966] font-bold text-xs sm:text-sm opacity-80 flex-shrink-0">
                          {l.moves} <span className="text-[9px] sm:text-[10px] opacity-40 ml-0.5">moves</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {!saved && (
                  <button onClick={initGame}
                    className="mt-6 text-white/50 text-xs sm:text-sm font-black uppercase tracking-widest hover:text-white/80 transition-all duration-300 touch-manipulation"
                  >
                    እንደገና ተጫወት (ያለ ማስቀመጥ)
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ════ GAME OVER SCREEN ════ */}
          {screen === 'gameover' && (
            <motion.div key="gameover"
              initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.4, ease:'easeOut' }}
              className="my-auto w-full flex justify-center px-2 sm:px-0"
            >
              <div className="glass-panel p-8 sm:p-14 rounded-[2.5rem] sm:rounded-[4rem] text-center w-full max-w-md shadow-2xl border border-red-500/20">
                <motion.div
                  animate={{ rotate:[0,-8,8,-8,0], scale:[1,1.05,1] }}
                  transition={{ duration:1.5, repeat:Infinity, ease:'easeInOut' }}
                  className="text-7xl mb-6 select-none"
                >⏰</motion.div>

                <h2 className="text-4xl sm:text-5xl font-black text-red-400 mb-3">ጊዜው አለቀ!</h2>
                <p className="text-white/40 mb-2 text-xs sm:text-sm font-bold uppercase tracking-[0.3em]">Time's Up — Level {level}</p>
                <p className="text-white/30 text-sm mb-10">
                  You completed <span className="text-[#FFD966] font-black">{level - 1}</span> of <span className="text-[#FFD966] font-black">{MAX_LEVEL}</span> levels
                  {' '}in <span className="text-[#FFD966] font-black">{moves}</span> moves.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <motion.button whileHover={{ scale:1.05, translateY:-2 }} whileTap={{ scale:0.95 }}
                    onClick={initGame}
                    className="group relative w-full px-10 py-5 bg-gradient-to-r from-[#FFD966] to-[#d4af37] text-black font-black rounded-3xl text-xl shadow-[0_20px_40px_-10px_rgba(212,175,55,0.4)] overflow-hidden"
                  >
                    <span className="relative z-10">🔄 እንደገና ተጫወት</span>
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                  </motion.button>

                  <button onClick={() => setScreen('start')}
                    className="w-full py-4 rounded-3xl border border-white/10 text-white/50 font-black text-sm uppercase tracking-widest hover:border-white/20 hover:text-white/70 transition-all duration-300"
                  >
                    ← ወደ መጀመሪያ ተመለስ
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

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
      y:      mood === 'wave'    ? [0,-20,0]     : [0,-10,0],
      rotate: mood === 'success' ? [0,8,-8,0]   : [0,2,-2,0],
      scale:  mood === 'success' ? [1,1.1,1]    : 1,
    }}
    transition={{ repeat:Infinity, duration: mood==='wave'?3:2, ease:'easeInOut' }}
    className="w-28 h-28 sm:w-36 sm:h-36 mx-auto pointer-events-none drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]"
  >
    <img
      src={mood === 'wave' ? '/mascot-wave.png' : '/mascot-success.png'}
      onError={e => e.target.src = 'https://cdn-icons-png.flaticon.com/512/1998/1998713.png'}
      className="w-full h-full object-contain"
      alt="Mascot"
    />
  </motion.div>
);