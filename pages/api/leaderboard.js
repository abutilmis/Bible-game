import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    const scores = await sql`
      SELECT name, moves, time
      FROM scores
      ORDER BY moves ASC, time ASC
      LIMIT 10
    `;
    res.status(200).json(scores);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}