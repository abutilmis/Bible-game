import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { name, moves, time } = req.body;
  if (!name || moves === undefined || time === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const id = Date.now().toString();
  try {
    await sql`
      INSERT INTO scores (id, name, moves, time, timestamp)
      VALUES (${id}, ${name}, ${moves}, ${time}, ${Date.now()})
    `;
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
}