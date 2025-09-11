import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../db/connectDb.js';
import { CryptoAsset } from '../models/assets.model.js';
import { CryptoHistoricalData } from '../models/crypto-historical-data.model.js';

// Load environment variables
dotenv.config();

// --- Configuration Constants ---
const CMC_API_KEY = process.env.CMC_API_KEY;
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';
const LISTING_FETCH_LIMIT = 100;
const MAX_LISTINGS_TO_TRACK = 500;
const MAX_HISTORY_ASSETS_TO_TRACK = 200;

// --- Rate Limiting & Delay Constants ---
const API_CALL_DELAY_LISTINGS_PAGE_MS      = 500;
const SPARKLINE_FETCH_CHUNK_SIZE          = 10;
const API_CALL_DELAY_SPARKLINE_CHUNK_MS   = 1200;
const HISTORY_FETCH_CHUNK_SIZE            = 5;
const API_CALL_DELAY_HISTORY_CHUNK_MS     = 2000;
const API_CALL_DELAY_MAJOR_TASK_MS        = 5000;

const HISTORICAL_FETCH_WINDOW_DAYS = 365;

// --- API Client ---
const cmcClient = axios.create({
  baseURL: CMC_BASE_URL,
  headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY },
});

// --- Helper ---
const delay = ms => new Promise(res => setTimeout(res, ms));


// --- Task 2: Detailed Historical Data ---
async function updateCryptoHistory() {
  console.log('Starting Crypto Detailed Historical Data update…');
  if (!CMC_API_KEY) {
    console.error('Missing CMC_API_KEY');
    return;
  }

  try {
    const toTrack = await CryptoAsset.find({})
      .sort({ rank: 1 })
      .limit(MAX_HISTORY_ASSETS_TO_TRACK)
      .select('cmc_id name')
      .lean();

    console.log(`Tracking history for ${toTrack.length} assets…`);

    // fetch in small parallel chunks
    for (let i = 0; i < toTrack.length; i += HISTORY_FETCH_CHUNK_SIZE) {
      const chunk = toTrack.slice(i, i + HISTORY_FETCH_CHUNK_SIZE);

      await Promise.all(chunk.map(async ({ cmc_id, name }) => {
        try {
          // determine start
          const last = await CryptoHistoricalData
            .findOne({ cmc_id })
            .sort({ timestamp: -1 })
            .select('timestamp')
            .lean();

          let timeStart;
          if (last) {
            const d = new Date(last.timestamp);
            d.setUTCDate(d.getUTCDate() + 1);
            d.setUTCHours(0,0,0,0);
            timeStart = d.toISOString();
          } else {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - HISTORICAL_FETCH_WINDOW_DAYS);
            d.setUTCHours(0,0,0,0);
            timeStart = d.toISOString();
          }

          const dEnd = new Date();
          dEnd.setUTCHours(0,0,0,0);
          const timeEnd = dEnd.toISOString();

          if (new Date(timeStart) >= new Date(timeEnd)) return;

          // fetch
          const r = await cmcClient.get('/v1/cryptocurrency/ohlcv/historical', {
            params: { id: cmc_id, time_start: timeStart, time_end: timeEnd, interval: 'daily', convert: 'USD' }
          });

          const quotes = r.data?.data?.quotes || [];
          if (!quotes.length) return;

          // bulk upsert
          const ops = quotes.map(q => ({
            updateOne: {
              filter: {
                cmc_id,
                timestamp: new Date(new Date(q.time_close).setUTCHours(0,0,0,0))
              },
              update: {
                $set: {
                  cmc_id,
                  timestamp: new Date(new Date(q.time_close).setUTCHours(0,0,0,0)),
                  open:   q.quote.USD.open,
                  high:   q.quote.USD.high,
                  low:    q.quote.USD.low,
                  close:  q.quote.USD.close,
                  volume: q.quote.USD.volume
                }
              },
              upsert: true
            }
          }));

          if (ops.length) {
            await CryptoHistoricalData.bulkWrite(ops);
          }
        } catch (err) {
          console.error(`  [${name}] history error:`, err.response?.data || err.message);
        }
      }));

      await delay(API_CALL_DELAY_HISTORY_CHUNK_MS);
    }

  } catch (e) {
    console.error('updateCryptoHistory error:', e.response?.data || e.message);
  }

  console.log('Finished Crypto Historical update.');
}

// --- Main ---
async function runBackgroundJob() {
  console.log('Background job started.');
  await connectDatabase();

  await delay(API_CALL_DELAY_MAJOR_TASK_MS);

  await updateCryptoHistory();

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
  console.log('Background job finished.');
}

runBackgroundJob();
