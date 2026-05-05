import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
    // Start particle effect on mount
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

  // --- Gold particle effect (coins flying upward) ---
  const startParticleEffect = () => {
    if (particleInterval.current) clearInterval(particleInterval.current);
    particleInterval.current = setInterval(() => {
      setParticles(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          x: Math.random() * 100, // percentage relative to container
          y: 80,
          size: 8 + Math.random() * 12,
          duration: 1 + Math.random() * 1.5,
          delay: 0,
        }
      ]);
      // Remove old particles after they finish animation
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== prev[0]?.id));
      }, 2500);
    }, 500);
  };

  // --- Game init with preview flip (unchanged) ---
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
    if (!gameActive) return;
    if (previewMode) return;
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
      alert('Please enter your name');
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
      alert('Failed to save score');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // --- Animated title (word drop) ---
  const titleWords = "የመጽሐፍ ቅዱስ ትውስታ ጨዋታ".split(' ');
  const dropIn = {
    hidden: { y: -50, opacity: 0 },
    visible: (i) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }
    })
  };

  // Start screen
  if (!gameActive && !gameFinished && !previewMode) {
    return (
      <>
        <Head>
          <title>የመጽሐፍ ቅዱስ ትውስታ ጨዋታ</title>
          <meta name="description" content="Match Bible verses with their texts – a fun memory game in Amharic" />
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Gold particles floating up */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: '80vh', x: `${p.x}%`, opacity: 1, scale: 0.5 }}
              animate={{ y: '-20vh', opacity: 0, scale: 1.2 }}
              transition={{ duration: p.duration, ease: 'easeOut' }}
              className="absolute text-yellow-400 pointer-events-none"
              style={{ left: `${p.x}%`, bottom: 0 }}
            >
              🪙
            </motion.div>
          ))}
          <div className="text-center max-w-md w-full z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <img src="/vent logo.png" alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-full shadow-lg border-2 border-[#FFD966] object-cover" />
            </motion.div>
            <div className="overflow-hidden">
              <h1 className="text-4xl font-bold text-[#FFD966] mb-2 flex flex-wrap justify-center gap-2">
                {titleWords.map((word, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={dropIn}
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>
            </div>
            <p className="text-white/70 mb-6">የጥቅሱን ጥቅስ ከይዘቱ ጋር አዛምድ</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={initGame}
              className="bg-[#FFD966] text-[#1e3c2c] px-8 py-3 rounded-full font-bold text-lg"
            >
              ጀምር
            </motion.button>
            <div className="mt-8 text-left bg-white/10 rounded-xl p-4">
              <h3 className="text-[#FFD966] font-bold text-lg">🏆 ከፍተኛ ውጤቶች</h3>
              {leaderboard.length === 0 ? (
                <p className="text-white/60">እስካሁን ምንም ውጤት የለም</p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div key={idx} className="flex justify-between text-white/80 mt-2">
                    <span>{idx+1}. {entry.name}</span>
                    <span>{entry.moves} moves • {formatTime(entry.time)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Preview screen (all cards flipped) – unchanged
  if (previewMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex flex-col items-center justify-center p-4">
        <p className="text-white/80 text-lg mb-4">✨ ማስታወሻ ጊዜ… ✨</p>
        <div className="grid grid-cols-4 gap-2 max-w-2xl w-full">
          {cards.map((card, idx) => (
            <div
              key={idx}
              className="aspect-square bg-[#FFD966]/20 border border-[#FFD966] rounded-xl flex items-center justify-center text-center p-2 text-sm"
            >
              <span className={card.type === 'ref' ? 'text-[#FFD966] font-bold' : 'text-white/90'}>{card.content}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Playing screen – unchanged
  if (gameActive || (gameFinished && !saved)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex flex-col items-center justify-center p-4">
        <div className="flex justify-between w-full max-w-2xl mb-4 text-white">
          <div>🏃 እንቅስቃሴ: {moves}</div>
          <div>⏱️ ጊዜ: {formatTime(time)}</div>
        </div>
        <div className="grid grid-cols-4 gap-2 max-w-2xl w-full">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 1 }}
              animate={{ scale: card.isMatched ? 0.95 : 1 }}
              transition={{ duration: 0.2 }}
              className={`aspect-square bg-white/10 rounded-xl cursor-pointer flex items-center justify-center text-center p-2 text-sm transition-all ${
                card.isFlipped || card.isMatched ? 'bg-[#FFD966]/20 border border-[#FFD966]' : 'hover:bg-white/20'
              }`}
              onClick={() => handleCardClick(idx)}
            >
              {card.isFlipped || card.isMatched ? (
                <span className={card.type === 'ref' ? 'text-[#FFD966] font-bold' : 'text-white/90'}>{card.content}</span>
              ) : (
                <span className="text-3xl">❓</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Finished screen – unchanged
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-md w-full text-center border border-[#FFD966]/30">
        <h2 className="text-3xl font-bold text-[#FFD966] mb-2">🎉 ጨዋታው ተጠናቋል!</h2>
        <p className="text-white text-xl">የእንቅስቃሴ ብዛት: <strong className="text-[#FFD966]">{moves}</strong></p>
        <p className="text-white text-xl mb-4">ጊዜ: <strong className="text-[#FFD966]">{formatTime(time)}</strong></p>
        {!saved ? (
          <>
            <input
              type="text"
              placeholder="ስምህ አስገባ"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-3 rounded-xl bg-black/30 text-white mb-4 text-center"
            />
            <button onClick={saveScore} className="bg-[#FFD966] text-[#1e3c2c] px-6 py-2 rounded-full font-bold">ውጤቴን አስቀምጥ</button>
            <button onClick={initGame} className="ml-3 bg-white/10 text-white px-6 py-2 rounded-full">እንደገና ጨዋታ</button>
          </>
        ) : (
          <>
            <p className="text-green-400 mb-4">✅ ውጤትህ ተቀምጧል!</p>
            <button onClick={initGame} className="bg-[#FFD966] text-[#1e3c2c] px-6 py-2 rounded-full font-bold">እንደገና ጨዋታ</button>
            <div className="mt-6 text-left">
              <h3 className="text-[#FFD966] font-bold text-lg">🏆 ከፍተኛ ውጤቶች</h3>
              {leaderboard.map((entry, idx) => (
                <div key={idx} className="flex justify-between text-white/80 mt-2">
                  <span>{idx+1}. {entry.name}</span>
                  <span>{entry.moves} moves • {formatTime(entry.time)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}