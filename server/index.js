import cors from "cors";
import express from "express";
import { isRunId, rankEntries, validateSubmission } from "./leaderboard.js";
import { opponentForRound, parseRound } from "./opponents.js";

const app = express();
const port = Number(process.env.PORT ?? 4200);
const leaderboard = new Map();

app.use(cors());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "backpack-brawl" }));

app.get("/api/opponents", (req, res) => {
  const requested = Number(req.query.latency ?? process.env.API_LATENCY ?? 1200);
  const latency = Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 1200;
  setTimeout(() => {
    const round = parseRound(req.query.round);
    if (round === null) return res.status(400).json({ error: "round must be a positive whole number" });
    if (req.query.fail === "true" || process.env.API_FAIL === "true") {
      return res.status(503).json({ error: "The arena gates are shut. No challenger answered the call." });
    }
    res.json(opponentForRound(round));
  }, latency);
});

app.get("/api/leaderboard", (req, res) => {
  res.set("Cache-Control", "no-store");
  const { runId } = req.query;
  if (runId === undefined) return res.json(rankEntries(leaderboard.values()));
  if (!isRunId(runId)) return res.status(400).json({ error: "Invalid run ID." });

  const entry = leaderboard.get(runId);
  return res.json(entry ? [entry] : []);
});

app.post("/api/leaderboard", express.json({ limit: "4kb" }), (req, res) => {
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Send the run as application/json." });
  }

  const { entry, error } = validateSubmission(req.body);
  if (error) return res.status(400).json({ error });

  const existing = leaderboard.get(entry.runId);
  if (existing) return res.json(existing);
  leaderboard.set(entry.runId, entry);
  return res.status(201).json(entry);
});

app.use("/api/leaderboard", (error, _req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "The request body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "The request body must be 4 KB or less." });
  }
  if (error.status === 415) {
    return res.status(415).json({ error: "Use UTF-8 JSON with a supported content encoding." });
  }
  next(error);
});

app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));
