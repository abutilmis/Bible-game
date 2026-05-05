import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  // Simple secret protection (optional but recommended)
  const { secret } = req.query;
  if (secret !== process.env.ADMIN_SECRET && secret !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const scores = await sql`
      SELECT id, name, moves, time, timestamp
      FROM scores
      ORDER BY moves ASC, time ASC
    `;
    res.status(200).json(scores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
}