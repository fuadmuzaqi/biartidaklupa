import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  // 1. Set Header agar selalu mengembalikan JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    // 2. Cek apakah Environment Variables sudah ada
    if (!process.env.TURSO_URL || !process.env.TURSO_TOKEN) {
      return res.status(500).json({ error: "Environment Variables TURSO belum diatur di Vercel!" });
    }

    const client = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_TOKEN,
    });

    const authHeader = req.headers['x-access-code'];

    // 3. Cek Kode Akses
    if (authHeader !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: 'Kode akses salah!' });
    }

    // 4. Logika GET
   if (req.method === 'GET') {
      try {
        const result = await client.execute("SELECT * FROM notes ORDER BY event_date DESC");
        // Pastikan mengembalikan result.rows (ini adalah array)
        return res.status(200).json(result.rows || []);
      } catch (dbError) {
        console.error("Query Error:", dbError);
        return res.status(500).json({ error: "Gagal query data: " + dbError.message });
      }
    }
    // 5. Logika POST
    if (req.method === 'POST') {
      const { id, name, date, content } = req.body;
      if (id) {
        await client.execute({
          sql: "UPDATE notes SET name = ?, event_date = ?, content = ? WHERE id = ?",
          args: [name, date, content, id]
        });
        return res.status(200).json({ message: 'Update berhasil' });
      } else {
        const countRes = await client.execute("SELECT COUNT(*) as total FROM notes");
        if (countRes.rows[0].total >= 50) {
          return res.status(400).json({ error: 'Limit 50 note tercapai!' });
        }
        await client.execute({
          sql: "INSERT INTO notes (name, event_date, content) VALUES (?, ?, ?)",
          args: [name, date, content]
        });
        return res.status(201).json({ message: 'Simpan berhasil' });
      }
    }

    // 6. Logika DELETE
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await client.execute({
        sql: "DELETE FROM notes WHERE id = ?",
        args: [id]
      });
      return res.status(200).json({ message: 'Hapus berhasil' });
    }

  } catch (error) {
    console.error("DETAIL ERROR:", error);
    return res.status(500).json({ 
      error: "Terjadi kesalahan pada server/database",
      details: error.message 
    });
  }
}
