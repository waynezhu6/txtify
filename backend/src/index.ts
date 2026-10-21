import express from "express";
import cors from "cors";
import { migrate } from "./db.js";

const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Don't take traffic until the schema is current. A failed migration exits so
// the container restarts instead of serving on a stale schema.
try {
  await migrate();
} catch (err) {
  console.error("Migrations failed:", err);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
