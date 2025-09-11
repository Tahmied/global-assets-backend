import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config({ path: './.env' });

const API_KEY = process.env.TWELVE_DATA_API_KEY;
if (!API_KEY) throw new Error('TwelveData API key missing');

// In-memory caches
export const priceCache = new Map(); // symbol -> { price, timestamp }
const subscribed = new Set();

// WebSocket URL
const TWELVE_DATA_WS_URL =
  `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;

let ws;

/**
 * Establishes and manages a persistent WebSocket connection,
 * including automatic reconnect and resubscription.
 */
function connectWS() {
  ws = new WebSocket(TWELVE_DATA_WS_URL);

  ws.on('open', () => {
    console.log('[priceService] Connected to Twelve Data');
    // Resubscribe to any symbols
    subscribed.forEach(symbol => {
      safeSend(JSON.stringify({
        action: 'subscribe',
        params: { symbols: symbol }
      }));
    });
  });

  ws.on('message', raw => {
    try {
      const data = JSON.parse(raw);
      if (data.event === 'price' && data.symbol && data.price) {
        priceCache.set(data.symbol, {
          price: parseFloat(data.price),
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('[priceService] Invalid JSON', err);
    }
  });

  ws.on('error', err => console.error('[priceService] WS error', err));

  ws.on('close', () => {
    console.warn('[priceService] WS closed, reconnecting in 5s');
    setTimeout(connectWS, 5000);
  });
}

/**
 * Safely sends a message over the WebSocket, waiting for open if needed.
 */
function safeSend(message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else {
    ws.once('open', () => ws.send(message));
  }
}

// Start the initial connection
connectWS();

// Heartbeat to keep connection alive
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    safeSend(JSON.stringify({ action: 'heartbeat' }));
  }
}, 10_000);

/**
 * Subscribe to price updates for a given symbol.
 */
export function subscribeSymbol(symbol) {
  if (subscribed.has(symbol)) return;
  subscribed.add(symbol);

  const msg = JSON.stringify({
    action: 'subscribe',
    params: { symbols: symbol }
  });
  safeSend(msg);
}

export function getCachedPrice(symbol) {
  const entry = priceCache.get(symbol);
  return entry ? entry.price : null;
}
