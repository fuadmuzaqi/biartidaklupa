import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

export default async function handler(req, res) {
  const authHeader = req.headers['x-access-code'];

  // Cek Kode Akses
  if (authHeader !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: 'Kode akses salah!' });
  }

  try {
    if (req.method === 'GET') {
      const result = await client.execute("SELECT * FROM notes ORDER BY event_date DESC");
      return res.status(200).json(result.rows);
    } 

    if (req.method === 'POST') {
      const { id, name, date, content } = req.body;

      if (id) {
        // Update data
        await client.execute({
          sql: "UPDATE notes SET name = ?, event_date = ?, content = ? WHERE id = ?",
          args: [name, date, content, id]
        });
        return res.status(200).json({ message: 'Note diperbarui' });
      } else {
        // Cek Limit 50
        const countRes = await client.execute("SELECT COUNT(*) as total FROM notes");
        if (countRes.rows[0].total >= 50) {
          return res.status(400).json({ error: 'Limit 50 note tercapai. Hapus note lama dahulu.' });
        }
        // Simpan Baru
        await client.execute({
          sql: "INSERT INTO notes (name, event_date, content) VALUES (?, ?, ?)",
          args: [name, date, content]
        });
        return res.status(201).json({ message: 'Note disimpan' });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.execute({
        sql: "DELETE FROM notes WHERE id = ?",
        args: [id]
      });
      return res.status(200).json({ message: 'Note dihapus' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database Error' });
  }
}
