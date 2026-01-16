import { createClient } from '@libsql/client';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // 1. CEK VARIABEL ENVIRONMENT
  const url = process.env.TURSO_URL;
  const token = process.env.TURSO_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ 
      error: "Variabel Belum Terpasang", 
      details: `URL: ${url ? 'OK' : 'KOSONG'}, Token: ${token ? 'OK' : 'KOSONG'}. Pastikan sudah klik REDEPLOY di Vercel.` 
    });
  }

  try {
    const client = createClient({ url, authToken: token });
    const authHeader = req.headers['x-access-code'];

    // 2. CEK KODE AKSES
    if (authHeader !== process.env.ACCESS_CODE) {
      return res.status(401).json({ error: 'Kode akses salah!' });
    }

    // 3. COBA KONEKSI KE DATABASE
    if (req.method === 'GET') {
      try {
        const result = await client.execute("SELECT * FROM notes ORDER BY event_date DESC");
        // Jika berhasil, kirim data (pastikan ini array)
        return res.status(200).json(Array.isArray(result.rows) ? result.rows : []);
      } catch (dbError) {
        // Tampilkan error database secara detail
        return res.status(500).json({ 
          error: "Turso Query Error", 
          details: dbError.message 
        });
      }
    }

    // 4. LOGIKA SIMPAN (POST)
    if (req.method === 'POST') {
      const { id, name, date, content } = req.body;
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

    // DELETE ... (sama seperti sebelumnya)

  } catch (error) {
    return res.status(500).json({ 
      error: "General Server Error", 
      details: error.message 
    });
  }
}
