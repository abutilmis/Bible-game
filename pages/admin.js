import { useState, useEffect } from 'react';
import Head from 'next/head';

const ADMIN_SECRET = 'wOUR/4426/11'; // change this to a strong password

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/all-scores?secret=${ADMIN_SECRET}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setScores(data);
    } catch (err) {
      console.error(err);
      alert('Could not fetch scores');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (password === ADMIN_SECRET) {
      setAuthenticated(true);
      fetchScores();
    } else {
      alert('Wrong password');
    }
  };

  const deleteScore = async (id, name) => {
    if (!confirm(`Delete score for "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/delete-score?id=${id}&secret=${ADMIN_SECRET}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchScores(); // refresh list
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setDeleting(null);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur p-8 rounded-2xl text-center">
          <h1 className="text-[#FFD966] text-2xl mb-4">Admin Login</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 rounded bg-black/50 text-white mb-4 w-full"
            placeholder="Password"
          />
          <button onClick={handleLogin} className="bg-[#FFD966] text-[#1e3c2c] px-4 py-2 rounded w-full">Login</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin – Bible Memory Game</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-[#090909] to-[#151515] p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#FFD966]">Admin Dashboard</h1>
            <button
              onClick={fetchScores}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm transition"
            >
              ↻ Refresh
            </button>
          </div>
          {scores.length === 0 ? (
            <div className="text-white/70 text-center p-8">No scores yet.</div>
          ) : (
            <div className="overflow-x-auto shadow-lg rounded-xl">
              <table className="w-full text-white border-collapse bg-black/30 rounded-xl overflow-hidden">
                <thead className="bg-black/50">
                  <tr>
                    <th className="p-3 border border-white/20">Rank</th>
                    <th className="p-3 border border-white/20">Name</th>
                    <th className="p-3 border border-white/20">Moves</th>
                    <th className="p-3 border border-white/20">Time</th>
                    <th className="p-3 border border-white/20">Date</th>
                    <th className="p-3 border border-white/20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score, idx) => (
                    <tr key={score.id} className={idx === 0 ? 'bg-yellow-900/30' : 'hover:bg-white/5'}>
                      <td className="p-3 border border-white/10 text-center">{idx + 1}</td>
                      <td className="p-3 border border-white/10">{score.name}</td>
                      <td className="p-3 border border-white/10 text-center">{score.moves}</td>
                      <td className="p-3 border border-white/10 text-center">{formatTime(score.time)}</td>
                      <td className="p-3 border border-white/10 text-center">{new Date(score.timestamp).toLocaleString()}</td>
                      <td className="p-3 border border-white/10 text-center">
                        <button
                          onClick={() => deleteScore(score.id, score.name)}
                          disabled={deleting === score.id}
                          className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm disabled:opacity-50"
                        >
                          {deleting === score.id ? '...' : '🗑 Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}