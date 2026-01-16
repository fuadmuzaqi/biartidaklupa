import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

export default async function handler(req, res) {
  const authHeader = req.headers['x-access-code'];

  // LOG UNTUK DEBUG (Cek di tab Logs Vercel)
  console.log("Kode dari User:", authHeader);
  console.log("Kode di Server:", process.env.ACCESS_CODE);

  if (authHeader !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: 'Kode akses salah atau belum diatur di Vercel!' });
  }

  try {
    if (req.method === 'GET') {
      const result = await client.execute("SELECT * FROM notes ORDER BY event_date DESC");
      return res.status(200).json(result.rows);
    }
    // ... (sisa kode POST dan DELETE sama seperti sebelumnya)
 } catch (error) {
    console.error("Database Error:", error);
    // Ubah baris di bawah ini untuk melihat error aslinya di layar
    return res.status(500).json({ error: 'Detail Error: ' + error.message });
  }
