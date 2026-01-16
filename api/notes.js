import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const url = process.env.TURSO_URL;
  const token = process.env.TURSO_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: "Environment Variables belum lengkap di Vercel!" });
  }

  try {
    // Inisialisasi client di dalam handler
    const client = createClient({ 
      url: url.trim(), 
      authToken: token.trim() 
    });

    const authHeader = req.headers['x-access-code'];
    if (authHeader !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: 'Kode akses salah!' });
    }

    // GET DATA
    if (req.method === 'GET') {
      const result = await client.execute("SELECT * FROM notes ORDER BY event_date DESC");
      return res.status(200).json(result.rows);
    }

    // POST DATA (SIMPAN)
    if (req.method === 'POST') {
      const { id, name, date, content } = req.body;
      if (!name || !date || !content) {
        return res.status(400).json({ error: "Data tidak lengkap" });
      }

      if (id) {
        await client.execute({
          sql: "UPDATE notes SET name = ?, event_date = ?, content = ? WHERE id = ?",
          args: [name, date, content, id]
        });
        return res.status(200).json({ message: 'Update berhasil' });
      } else {
        await client.execute({
          sql: "INSERT INTO notes (name, event_date, content) VALUES (?, ?, ?)",
          args: [name, date, content]
        });
        return res.status(201).json({ message: 'Simpan berhasil' });
      }
    }

    // DELETE DATA
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.execute({
        sql: "DELETE FROM notes WHERE id = ?",
        args: [id]
      });
      return res.status(200).json({ message: 'Hapus berhasil' });
    }

  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ 
      error: "Koneksi Database Gagal", 
      details: error.message 
    });
  }
}
