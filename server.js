import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import pg from "pg";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// Bootstrap table on startup
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vault (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await pool.query(`
    INSERT INTO vault (id, data)
    VALUES ('default', '{"categories":[],"inbox":[]}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("Database ready.");
}

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "dist")));

// GET  /api/data  → full vault JSON
app.get("/api/data", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT data FROM vault WHERE id = $1",
      ["default"]
    );
    res.json(rows[0]?.data ?? { categories: [], inbox: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "read failed" });
  }
});

// POST /api/data  → overwrite vault with request body
app.post("/api/data", async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO vault (id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      ["default", JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "write failed" });
  }
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

init().then(() => {
  app.listen(PORT, () => console.log(`Recall Vault listening on :${PORT}`));
});
