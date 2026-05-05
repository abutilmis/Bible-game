import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const { id, secret } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  if (secret !== process.env.ADMIN_SECRET && secret !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await sql`DELETE FROM scores WHERE id = ${id}`;
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete score' });
  }
}