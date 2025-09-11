import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { performance } from 'perf_hooks';
import { connectDatabase } from '../db/connectDb.js';
import { CryptoAsset } from '../models/assets.model.js';

dotenv.config();

// --- Config Constants ---
const CMC_API_KEY               = process.env.CMC_API_KEY;
const CMC_BASE_URL              = 'https://pro-api.coinmarketcap.com';
const MAX_LISTINGS_TO_TRACK     = 200;
const LISTING_FETCH_LIMIT       = 100;

// Rank thresholds
const RANK_TOP_ALWAYS           = 50;   // 1–50: always refresh
const RANK_FOUR_HOUR_MAX        = 100;  // 51–100: if >4 h old
const RANK_DAY_MAX              = 200;  // 101–200: if >24 h old

// Time thresholds
const FOUR_HOURS_MS             = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS      = 24 * 60 * 60 * 1000;

// Rate‑limit & chunk sizes
const API_CALL_DELAY_LISTINGS_PAGE_MS   = 500;
const SPARKLINE_FETCH_CHUNK_SIZE        = 15;
const API_CALL_DELAY_SPARKLINE_CHUNK_MS = 1100;
const API_CALL_DELAY_MAJOR_TASK_MS      = 5000;

const cmcClient = axios.create({
  baseURL: CMC_BASE_URL,
  headers: { 'X-CMC_PRO_API_KEY': CMC_API_KEY },
});
const delay = ms => new Promise(res => setTimeout(res, ms));

// --- 1) Fetch Listings ---
async function fetchListings() {
  console.log(`Fetching up to ${MAX_LISTINGS_TO_TRACK} listings from CMC...`);
  let allAssets = [], start = 1, fetched = 0;

  while (fetched < MAX_LISTINGS_TO_TRACK) {
    const limit = Math.min(LISTING_FETCH_LIMIT, MAX_LISTINGS_TO_TRACK - fetched);
    console.log(`  Fetching listings page start=${start} limit=${limit}`);
    const resp = await cmcClient.get('/v1/cryptocurrency/listings/latest', {
      params: { start, limit, convert: 'USD' }
    });
    const data = resp.data?.data || [];
    if (!data.length) break;
    allAssets.push(...data);
    fetched += data.length;
    console.log(`  Fetched ${data.length} listings, total fetched: ${fetched}`);
    start += data.length;
    await delay(API_CALL_DELAY_LISTINGS_PAGE_MS);
  }

  console.log(`Finished fetching listings. Total: ${allAssets.length}`);
  return allAssets;
}

// --- 2) Fetch one sparkline with retry ---
async function fetchSparklineWithRetry(id, attempt = 1) {
  try {
    const r = await cmcClient.get('/v1/cryptocurrency/ohlcv/historical', {
      params: { id, count: 7, interval: 'daily', convert: 'USD' }
    });
    const quotes = r.data?.data?.quotes || [];
    return quotes.map(q => q.quote.USD.close).filter(v => v != null);
  } catch (err) {
    if (err.response?.status === 429 && attempt <= 2) {
      console.warn(`    [ID ${id}] 429 Rate limit hit, retrying #${attempt}...`);
      await delay(API_CALL_DELAY_SPARKLINE_CHUNK_MS * 3);
      return fetchSparklineWithRetry(id, attempt + 1);
    }
    console.error(`    [ID ${id}] Failed to fetch sparkline: ${err.message}`);
    return [];
  }
}

// --- 3) Update Logic ---
async function updateCryptoListings() {
  console.log('Starting crypto listings & sparklines update…');

  const allAssets = await fetchListings();
  if (!allAssets.length) {
    console.log('No listings fetched; skipping.');
    return;
  }

  // Sort + trim to top 200
  const topAssets = allAssets
    .filter(a => a.cmc_rank <= RANK_DAY_MAX)
    .sort((a, b) => a.cmc_rank - b.cmc_rank);
  console.log(`Prepared top ${topAssets.length} assets by rank.`);

  // Load existing sparkline timestamps
  const existing = await CryptoAsset.find(
    { cmc_id: { $in: topAssets.map(a => a.id) } },
    'cmc_id last_updated_sparkline_10d'
  ).lean();
  const lastMap = Object.fromEntries(
    existing.map(d => [d.cmc_id, d.last_updated_sparkline_10d?.getTime() || 0])
  );
  console.log(`Loaded ${existing.length} existing sparkline timestamps.`);

  // Decide which IDs to fetch
  const now = Date.now();
  const always       = topAssets.slice(0, RANK_TOP_ALWAYS).map(a => a.id);
  const fourHourPool = topAssets.slice(RANK_TOP_ALWAYS, RANK_FOUR_HOUR_MAX).map(a => a.id);
  const dayPool      = topAssets.slice(RANK_FOUR_HOUR_MAX, RANK_DAY_MAX).map(a => a.id);

  console.log(`Checking rank 1–${RANK_TOP_ALWAYS}: always refresh (${always.length} IDs).`);
  console.log(`Checking rank ${RANK_TOP_ALWAYS + 1}–${RANK_FOUR_HOUR_MAX} for 4-hour refresh...`);
  const fourHourToFetch = fourHourPool.filter(id => now - (lastMap[id] || 0) > FOUR_HOURS_MS);
  console.log(`  ${fourHourToFetch.length} assets in rank 51-100 need sparkline refresh.`);

  console.log(`Checking rank ${RANK_FOUR_HOUR_MAX + 1}–${RANK_DAY_MAX} for 24-hour refresh...`);
  const dayToFetch = dayPool.filter(id => now - (lastMap[id] || 0) > TWENTY_FOUR_HOURS_MS);
  console.log(`  ${dayToFetch.length} assets in rank 101-200 need sparkline refresh.`);

  const toFetch = [...new Set([...always, ...fourHourToFetch, ...dayToFetch])];
  console.log(`Fetching sparklines for ${toFetch.length} assets based on refresh logic…`);

  // Fetch sparklines serially in chunks
  const sparklineData = {};
  for (let i = 0; i < toFetch.length; i += SPARKLINE_FETCH_CHUNK_SIZE) {
    const chunk = toFetch.slice(i, i + SPARKLINE_FETCH_CHUNK_SIZE);
    console.log(`  Processing sparkline chunk [${chunk[0]}…] (${chunk.length} IDs)`);
    for (const id of chunk) {
      sparklineData[id] = await fetchSparklineWithRetry(id);
      await delay(API_CALL_DELAY_SPARKLINE_CHUNK_MS);
    }
  }

  // Bulk‑upsert all 200 listings (price, rank, etc.) and only overwrite sparklines for fetched IDs
  console.log(`Upserting ${allAssets.length} assets…`);
  const nowDate = new Date();
  const ops = allAssets.map(a => {
    const sp = sparklineData[a.id];
    return {
      updateOne: {
        filter: { cmc_id: a.id },
        update: {
          $set: {
            cmc_id:    a.id,
            symbol:    a.symbol,
            name:      a.name,
            rank:      a.cmc_rank,
            price:     a.quote.USD.price,
            percent_change_24h: a.quote.USD.percent_change_24h,
            logo_url:  `https://s2.coinmarketcap.com/static/img/coins/64x64/${a.id}.png`,
            ...(sp !== undefined && { sparkline_10d: sp }),
            last_updated_listing:     nowDate,
            ...(sp !== undefined && { last_updated_sparkline_10d: nowDate })
          }
        },
        upsert: true
      }
    };
  });
  const res = await CryptoAsset.bulkWrite(ops);
  console.log(`  Inserted: ${res.upsertedCount}, Modified: ${res.modifiedCount}`);
  console.log('Finished crypto listings & sparklines update.');
}

// --- 4) Runner ---
async function runBackgroundJob() {
  const t0 = performance.now();
  console.log('Background job started…');

  await connectDatabase();
  console.log('Connected to database.');

  await updateCryptoListings();
  await delay(API_CALL_DELAY_MAJOR_TASK_MS);

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }

  const t1 = performance.now();
  console.log(`Background job finished in ${((t1 - t0) / 1000).toFixed(2)}s.`);
}

runBackgroundJob();
