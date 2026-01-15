import { createClient } from "@libsql/client";

const MAX_NOTES = 50;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Env TURSO_DATABASE_URL / TURSO_AUTH_TOKEN belum diset.");
  return createClient({ url, authToken }); // Turso JS quickstart pattern [page:1]
}

async function ensureSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person TEXT NOT NULL CHECK(person IN ('Fuad','Eli')),
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON notes(updatedAt)
  `);
}

function isAuthed(request) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return token && token === (process.env.ACCESS_CODE || "");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Body JSON tidak valid.");
  }
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname; // /api/notes atau /api/notes/auth
      const method = request.method.toUpperCase();

      // CORS sederhana (opsional)
      if (method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          },
        });
      }

      // AUTH endpoint: POST /api/notes/auth {code}
      if (path.endsWith("/api/notes/auth")) {
        if (method !== "POST") return json({ error: "Method not allowed" }, 405);
        const body = await readJson(request);
        const code = String(body.code || "");
        const access = process.env.ACCESS_CODE || "";
        if (!access) return json({ error: "Env ACCESS_CODE belum diset." }, 500);
        if (code !== access) return json({ error: "Kode akses salah." }, 401);

        // token sederhana: sama dengan ACCESS_CODE (sesuai kebutuhan ringkas)
        return json({ token: access });
      }

      // selain /auth wajib auth
      if (!isAuthed(request)) return json({ error: "Unauthorized." }, 401);

      const db = getClient();
      await ensureSchema(db);

      // GET /api/notes
      if (path.endsWith("/api/notes") && method === "GET") {
        const rs = await db.execute(`
          SELECT id, person, date, content, createdAt, updatedAt
          FROM notes
          ORDER BY datetime(updatedAt) DESC
          LIMIT ${MAX_NOTES}
        `);
        const items = rs.rows.map(r => ({
          id: r.id,
          person: r.person,
          date: r.date,
          content: r.content,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        return json({ items });
      }

      // POST /api/notes  {person,date,content}
      if (path.endsWith("/api/notes") && method === "POST") {
        const body = await readJson(request);
        const person = body.person === "Eli" ? "Eli" : "Fuad";
        const date = String(body.date || "");
        const content = String(body.content || "").trim();

        if (!date) return json({ error: "Tanggal wajib diisi." }, 400);
        if (!content) return json({ error: "Isi catatan tidak boleh kosong." }, 400);
        if (content.length > 2000) return json({ error: "Isi catatan maksimal 2000 karakter." }, 400);

        const countRs = await db.execute(`SELECT COUNT(*) AS c FROM notes`);
        const count = Number(countRs.rows?.[0]?.c || 0);
        if (count >= MAX_NOTES) return json({ error: "Limit 50 note tercapai." }, 400);

        const now = new Date().toISOString();
        await db.execute({
          sql: `INSERT INTO notes (person, date, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
          args: [person, date, content, now, now],
        });

        return json({ ok: true });
      }

      // PUT /api/notes {id,person,date,content}
      if (path.endsWith("/api/notes") && method === "PUT") {
        const body = await readJson(request);
        const id = Number(body.id);
        const person = body.person === "Eli" ? "Eli" : "Fuad";
        const date = String(body.date || "");
        const content = String(body.content || "").trim();

        if (!id) return json({ error: "ID tidak valid." }, 400);
        if (!date) return json({ error: "Tanggal wajib diisi." }, 400);
        if (!content) return json({ error: "Isi catatan tidak boleh kosong." }, 400);
        if (content.length > 2000) return json({ error: "Isi catatan maksimal 2000 karakter." }, 400);

        const now = new Date().toISOString();
        const r = await db.execute({
          sql: `UPDATE notes SET person = ?, date = ?, content = ?, updatedAt = ? WHERE id = ?`,
          args: [person, date, content, now, id],
        });

        // libsql result shape bisa berbeda, jadi cukup return ok
        return json({ ok: true, changed: r.rowsAffected ?? null });
      }

      // DELETE /api/notes?id=123
      if (path.endsWith("/api/notes") && method === "DELETE") {
        const id = Number(url.searchParams.get("id"));
        if (!id) return json({ error: "ID tidak valid." }, 400);

        await db.execute({ sql: `DELETE FROM notes WHERE id = ?`, args: [id] });
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Server error" }, 500);
    }
  },
};
