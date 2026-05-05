import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'wOUR/4426/11';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await sql`TRUNCATE TABLE scores`;
    res.status(200).json({ success: true, message: 'All scores deleted' });
  } catch (error) {
    console.error('Delete all error:', error);
    res.status(500).json({ error: 'Failed to delete all scores' });
  }
}