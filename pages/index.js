import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Leaderboard API failed');
      const data = await res.json();
      // Ensure data is an array
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Leaderboard error:', error);
      setLeaderboard([]);
    }
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
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
    setTime(0);
    setGameActive(true);
    setGameFinished(false);
    setSaved(false);
    if (timerInterval) clearInterval(timerInterval);
    const interval = setInterval(() => {
      setTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const handleCardClick = (idx) => {
    if (!gameActive) return;
    const card = cards[idx];
    if (card.isMatched || card.isFlipped) return;
    if (flippedIndices.length === 2) return;

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
        newCards[i1].isMatched = true;
        newCards[i2].isMatched = true;
        setCards(newCards);
        setFlippedIndices([]);
        if (newCards.every(c => c.isMatched)) {
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

  if (!gameActive && !gameFinished) {
    return (
      <>
        <Head>
          <title>Bible Game</title>
          <meta name="description" content="Match Bible verses with their texts – a fun memory game in Amharic" />
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full">
          <h1 className="text-4xl font-bold text-[#FFD966] mb-2"> የመጽሐፍ ቅዱስ ጨዋታ</h1>
          <p className="text-white/70 mb-6">የጥቅሱን ቁጥር ከይዘቱ ጋር አዛምድ</p>
          <button onClick={initGame} className="bg-[#FFD966] text-[#1e3c2c] px-8 py-3 rounded-full font-bold text-lg">ጀምር</button>
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

  if (gameFinished) {
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