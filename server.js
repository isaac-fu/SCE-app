import dotenv from "dotenv";
dotenv.config();

import express from "express";

const PORT = 3000;

const app = express();
app.use(express.json());

// In-memory storage
const history = {};
const jobs = {};

// Helper: fetch stock from Finnhub
async function fetchQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("Missing FINNHUB_API_KEY in environment");

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    symbol
  )}&token=${apiKey}`;

  const finnhubRes = await fetch(url);
  if (!finnhubRes.ok) throw new Error(`Finnhub error: ${finnhubRes.status}`);

  const data = await finnhubRes.json();

  // If symbol is invalid or no data, Finnhub often gives t: 0
  if (!data || data.t === 0) throw new Error(`No data for symbol: ${symbol}`);

  return {
    symbol,
    o: data.o,
    h: data.h,
    l: data.l,
    c: data.c,
    pc: data.pc,
    fetchedAt: new Date().toISOString(),
  };
}

// POST /start-monitoring
app.post("/start-monitoring", (req, res) => {
  const { symbol, minutes = 0, seconds = 0 } = req.body ?? {};

  if (
    typeof symbol !== "string" ||
    !symbol.trim() ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0
  ) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const intervalMs = (minutes * 60 + seconds) * 1000;
  if (intervalMs <= 0) {
    return res.status(400).json({ error: "Interval must be > 0" });
  }

  const sym = symbol.toUpperCase();

  // Clear existing job if exists
  if (jobs[sym]) clearInterval(jobs[sym]);

  history[sym] = history[sym] || [];

  jobs[sym] = setInterval(async () => {
    try {
      const record = await fetchQuote(sym);
      history[sym].push(record);
    } catch (err) {
      console.error("Fetch error:", err.message);
    }
  }, intervalMs);

  return res.json({ message: "Monitoring started", symbol: sym });
});

// GET /history?symbol=AAPL
app.get("/history", (req, res) => {
  const symbol = req.query.symbol;

  if (typeof symbol !== "string" || !symbol.trim()) {
    return res.status(400).json({ error: "Symbol required" });
  }

  const sym = symbol.toUpperCase();
  return res.json(history[sym] || []);
});

// POST /refresh
app.post("/refresh", async (req, res, next) => {
  try {
    const { symbol } = req.body ?? {};

    if (typeof symbol !== "string" || !symbol.trim()) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    const sym = symbol.toUpperCase();
    const record = await fetchQuote(sym);

    history[sym] = history[sym] || [];
    history[sym].push(record);

    return res.json(record);
  } catch (err) {
    next(err);
  }
});

// Not found handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler (must be last)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});