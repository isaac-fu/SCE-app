import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { URL } from "url";

const PORT = 3000;

// In-memory storage
const history = {};
const jobs = {};

// Helper: fetch stock from Finnhub
async function fetchQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`);

  const data = await res.json();

  // If symbol is invalid or no data, Finnhub often gives t: 0
  if (!data || data.t === 0) throw new Error(`No data for symbol: ${symbol}`);

  return {
    symbol,
    o: data.o,
    h: data.h,
    l: data.l,
    c: data.c,
    pc: data.pc,
    fetchedAt: new Date().toISOString()
  };
}

// Utility to read JSON body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader("Content-Type", "application/json");

  try {
    // POST /start-monitoring
    if (req.method === "POST" && pathname === "/start-monitoring") {
      const body = await readBody(req);

      const { symbol, minutes = 0, seconds = 0 } = body;

      if (
        typeof symbol !== "string" ||
        !symbol.trim() ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        minutes < 0 ||
        seconds < 0
      ) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Invalid input" }));
      }

      const intervalMs = (minutes * 60 + seconds) * 1000;
      if (intervalMs <= 0) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Interval must be > 0" }));
      }

      const sym = symbol.toUpperCase();

      // Clear existing job if exists
      if (jobs[sym]) {
        clearInterval(jobs[sym]);
      }

      history[sym] = history[sym] || [];

      jobs[sym] = setInterval(async () => {
        try {
          const record = await fetchQuote(sym);
          history[sym].push(record);
        } catch (err) {
          console.error("Fetch error:", err.message);
        }
      }, intervalMs);

      return res.end(JSON.stringify({ message: "Monitoring started", symbol: sym }));
    }

    // GET /history?symbol=AAPL
    if (req.method === "GET" && pathname === "/history") {
      const symbol = parsedUrl.searchParams.get("symbol");

      if (!symbol) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Symbol required" }));
      }

      const sym = symbol.toUpperCase();
      return res.end(JSON.stringify(history[sym] || []));
    }

    // POST /refresh
    if (req.method === "POST" && pathname === "/refresh") {
      const body = await readBody(req);
      const { symbol } = body;

      if (!symbol || typeof symbol !== "string") {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "Invalid symbol" }));
      }

      const sym = symbol.toUpperCase();
      const record = await fetchQuote(sym);

      history[sym] = history[sym] || [];
      history[sym].push(record);

      return res.end(JSON.stringify(record));
    }

    // Not found
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});