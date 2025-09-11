// src/utils/utils.js
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE_URL = 'https://api.twelvedata.com';

if (!API_KEY) {
  console.error("TWELVE_DATA_API_KEY not found in .env file. Exiting.");
  process.exit(1); // Exit the process if API key is missing
}

// Simple delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generic function to make API calls with basic rate limiting
// This delay helps distribute calls, but you might need more sophisticated logic
// depending on your exact usage patterns and Twelve Data's rate limit enforcement.
const API_CALL_DELAY_MS = 200; // Base delay between API calls (adjust as needed)

async function callTwelveDataApi(endpoint, params = {}) {
  const queryString = new URLSearchParams({
    ...params,
    apikey: API_KEY,
  }).toString();
  const url = `${BASE_URL}${endpoint}?${queryString}`;

  // Implement a small delay before each API call
  await delay(API_CALL_DELAY_MS);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      console.error(`Twelve Data API Error for ${endpoint} with params ${JSON.stringify(params)}: ${data.message}`);
      // Throw an error to be caught by the calling script
      throw new Error(`API Error: ${data.message}`);
    }

    return data;
  } catch (error) {
    console.error(`Fetch error for ${endpoint} with params ${JSON.stringify(params)}: ${error.message}`);
    throw error; // Re-throw the error
  }
}

// Fetch current data (price, change, sparkline)
async function fetchCurrentData(symbol) {
  try {
    const data = await callTwelveDataApi('/time_series', {
      symbol: symbol,
      interval: '1h', // Using 1h interval for sparkline
      outputsize: 10, // Last 10 data points for sparkline
    });

    if (!data || !data.values || data.values.length < 2) {
       // Handle cases where not enough data is returned (e.g., new asset)
       console.warn(`Not enough time series data for sparkline for ${symbol}. Data received: ${JSON.stringify(data)}`);
       return null; // Return null if data is insufficient
    }

    // Twelve Data returns newest data first, reverse for chronological sparkline
    const closes = data.values.map(p => +p.close).reverse();
    const latest = closes[closes.length - 1];
    const oldest = closes[0];
    const change = ((latest - oldest) / oldest) * 100;

    return {
      symbol: symbol,
      values: closes,
      price: latest,
      change: change,
      positive: change >= 0,
    };
  } catch (error) {
    console.error(`Error fetching current data for ${symbol}: ${error.message}`);
    return null; // Return null on error
  }
}

// Fetch logo URL
async function fetchLogoUrl(symbol) {
  try {
    const data = await callTwelveDataApi('/logo', { symbol });
    // Twelve Data logo endpoint can return logo_base, logo_quote, url, or logo field
    return data.logo_base || data.logo_quote || data.url || (typeof data.logo === 'string' && data.logo) || null;
  } catch (error) {
    console.warn(`Could not fetch logo for ${symbol}: ${error.message}`);
    return null; // Return null if logo fetching fails
  }
}

export { callTwelveDataApi, delay, fetchCurrentData, fetchLogoUrl };

