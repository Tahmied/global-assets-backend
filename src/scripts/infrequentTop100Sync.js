// src/scripts/infrequentTop100Sync.js

// --- VERY FIRST LINE ---
console.log('Script: infrequentTop100Sync.js starting...');
// -----------------------

import dotenv from 'dotenv';
import mongoose from 'mongoose'; // Import mongoose to check connection state
import path from 'path'; // Needed for fileURLToPath
import { fileURLToPath } from 'url'; // Needed for the check at the end
import { connectDatabase } from '../db/connectDb.js'; // Adjust path as needed
import { TwdataAsset } from '../models/twdata.models.js'; // *** Updated Model Name ***
import { callTwelveDataApi, delay, fetchCurrentData, fetchLogoUrl } from '../utils/twdata.js'; // Adjust path as needed

dotenv.config();

console.log('Imports successful.');

console.log('Attempting to load environment variables...');
// dotenv.config(); // Already called above
console.log('dotenv.config() called.');

// Optional: Temporarily log API key to verify it's loaded (REMOVE IN PRODUCTION)
// console.log('TWELVE_DATA_API_KEY:', process.env.TWELVE_DATA_API_KEY ? 'Loaded' : 'Not Loaded');
// console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'Not Loaded');


// --- Configuration ---
const CATEGORIES = {
  Forex: '/forex_pairs',
  Stock: '/stocks', // Note: Twelve Data stocks endpoint might need exchange param or filter
  "Digital Assets": '/cryptocurrencies',
  ETF: '/etf', // Note: Twelve Data ETF endpoint might need exchange param or filter
};

// Hardcoded pinned symbols and their *desired display names*.
// These maps define the exact display name we want for these specific symbols.
const topForexSymbolsMap = ['EUR/USD','GBP/USD','AUD/USD','XAU/USD','NZD/USD','USD/JPY','USD/CHF','USD/CAD','GBP/JPY','GBP/AUD'].reduce((map, sym) => { map[sym] = sym; return map; }, {});

const topStockSymbolsMap = {
    'AAPL': 'AAPL/USDT', // Use base symbol as key for lookup
    'MSFT': 'MSFT/USDT',
    'GOOGL': 'GOOGL/USDT',
    'AMZN': 'AMZN/USDT',
    'TSLA': 'TSLA/USDT',
    'ABBV': 'ABBV/USDT',
    'ABT': 'ABT/USDT',
    'NVDA': 'NVDA/USDT',
    'JPM': 'JPM/USDT',
    'WMT': 'WMT/USDT', // Note: Your original list had TSLA/USDT twice, corrected here
    'MA': 'MA/USDT',
    'MCD': 'MCD/USDT',
    'WFC': 'WFC/USDT',
};

const topCryptoSymbolsMap = {
    'BTC/USD': 'BTC/USDT', // API Symbol -> Desired Display Name
    'ETH/USD': 'ETH/USDT',
    'XRP/USD': 'XRP/USDT',
    'LTC/USD': 'LTC/USDT',
    'BCH/USD': 'BCH/USDT',
};

const topEtfSymbolsMap = {
    'PICK': 'PICK/USDT', // Use Base symbol as key for lookup
    'ASIA': 'ASIA/USDT',
    'JMBS': 'JMBS/USDT',
    'FTWO': 'FTWO/USDT',
    'HOMZ': 'HOMZ/USDT',
    'ZTAX': 'ZTAX/USDT',
    'ASHR': 'ASHR/USDT',
    'DAT': 'DAT/USDT',
    'FCUS': 'FCUS/USDT',
    'FIGB': 'FIGB/USDT',
};


const MAX_ASSETS_PER_CATEGORY = 100;
const TOP_40_THRESHOLD = 40;
const CATEGORY_SYNC_DELAY_MS = 10000; // Delay between syncing different categories (10 seconds)
const ASSET_PROCESSING_DELAY_MS = 500; // Delay between processing each asset within a category sync

// Helper to get the correct pinned map for a category
function getTopSymbolsMap(category) {
    switch (category) {
        case 'Forex': return topForexSymbolsMap;
        case 'Stock': return topStockSymbolsMap;
        case 'Digital Assets': return topCryptoSymbolsMap;
        case 'ETF': return topEtfSymbolsMap;
        default: return {};
    }
}


// --- Main Sync Function ---
async function syncTop100Assets() {
  console.log('Starting infrequent top 100 asset sync logic...');

  try {
    // Connect to DB if not already connected
    console.log('Attempting to connect to the database...');
    if (mongoose.connection.readyState === 0) {
       await connectDatabase();
       console.log('Database connected successfully for infrequent sync script.');
    } else {
       console.log('Database already connected.');
    }

    const categories = Object.keys(CATEGORIES);
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const endpoint = CATEGORIES[category];
      console.log(`\n--- Syncing category: ${category} ---`);

      // Add delay before fetching list for a new category
      if (i > 0) {
          console.log(`Waiting ${CATEGORY_SYNC_DELAY_MS}ms before fetching list for ${category}...`);
          await delay(CATEGORY_SYNC_DELAY_MS);
      }

      let assetList = []; // This will hold the final list of top 100 objects { symbol, display_name }
      try {
        console.log(`Fetching list from endpoint: ${endpoint}`);
        const apiParams = {};
        if (category === 'Stock') {
             apiParams.exchange = 'NASDAQ'; // Example: assuming NASDAQ for stocks/ETFs
             console.log(`Adding exchange param: ${apiParams.exchange}`);
        }
         // Add filter for "currency_quote=US Dollar" for crypto list endpoint if the API supports it
         if (category === 'Digital Assets') {
             // Note: TwelveData's /cryptocurrencies endpoint might not support currency_quote filter directly.
             // We'll filter the results manually below, as in the original frontend script.
             // apiParams.currency_quote = 'US Dollar'; // Check TwelveData docs if this is supported
         }

        const apiResponse = await callTwelveDataApi(endpoint, apiParams);
        console.log(`Received API response for ${category}. Processing list data...`);
        const list = Array.isArray(apiResponse.data) ? apiResponse.data : apiResponse; // Use 'list' to match original script naming
        console.log(`List data contains ${Array.isArray(list) ? list.length : 'N/A'} items.`);


        // --- Map List Data to { symbol, display_name, ... } format ---
        // Ensure consistent display_name format for ALL items before pinning
        let processedItems = [];
        const topSymbolsMapForCategory = getTopSymbolsMap(category);


        list.forEach(item => {
            let symbol = null;
            let display_name = null; // Use display_name directly now
            let baseSymbol = null; // For Stock/ETF lookup

            if (category === 'Forex') {
                symbol = item.symbol;
                display_name = item.symbol; // Forex display is just the symbol
            } else if (category === 'Stock') {
                 // Assuming stock list returns symbol (base) and exchange
                 symbol = `${item.symbol}:${item.exchange}`; // Construct API symbol
                 baseSymbol = item.symbol; // Keep base symbol for potential lookup

                 // Default display name for stocks is base/USDT
                 display_name = `${item.symbol}/USDT`;

            } else if (category === 'Digital Assets') {
                 // Filter for USD-quoted pairs and construct display name like original script
                 if (item.currency_quote && item.currency_quote === 'US Dollar') {
                    symbol = item.symbol; // Keep original API symbol (e.g., BTC/USD)
                    // Default display name for crypto is base/USDT
                    display_name = `${item.symbol.split('/')[0]}/USDT`;
                    // Add exchangeCount for sorting later if needed for non-pinned
                    item.exchangeCount = item.available_exchanges?.length || 0;
                 } else {
                    return; // Skip non-USD quoted pairs
                 }
            } else if (category === 'ETF') {
                 // Assuming ETF list returns symbol (base), exchange, and name
                 symbol = `${item.symbol}:${item.exchange}`; // Construct API symbol (e.g., PICK:NASDAQ)
                 baseSymbol = item.symbol; // Keep base symbol for potential lookup

                 // *** FIX: Ensure ETF display name is always base/USDT format ***
                 display_name = `${item.symbol}/USDT`; // Use base symbol / USDT format

            }

            // Add the processed item if symbol is valid
            if (symbol) {
                processedItems.push({
                    symbol: symbol,
                    display_name: display_name, // Use the determined display name
                    // Include other properties needed for sorting/pinning if necessary (like baseSymbol, exchangeCount)
                    ...(baseSymbol && { baseSymbol: baseSymbol }),
                    ...(item.exchangeCount !== undefined && { exchangeCount: item.exchangeCount })
                });
            }
        });

        console.log(`Mapped and filtered down to ${processedItems.length} valid items with default display names.`);


        // --- Apply Pinning Logic & Build Final List ---
        let finalItems = []; // This will be the list before slicing to 100
        const processedSymbols = new Set(); // Track API symbols already added to finalItems


        console.log(`Attempting to build final list, prioritizing ${Object.keys(topSymbolsMapForCategory).length} top symbols.`);

        // 1. Add pinned items first, in the exact order of the map keys
        Object.keys(topSymbolsMapForCategory).forEach(pinnedKey => {
             // Find the item in the processedItems list based on the pinned key (API symbol for Forex/Crypto, Base symbol for Stock/ETF)
             const foundItem = processedItems.find(item => {
                 if (category === 'Stock' || category === 'ETF') {
                      // For stocks/ETFs, match the base symbol part of the item's symbol
                      return item.baseSymbol === pinnedKey;
                 }
                 // For Forex/Crypto, match the full API symbol
                 return item.symbol === pinnedKey;
             });

             if (foundItem && !processedSymbols.has(foundItem.symbol)) {
                 // If found and not already added, add it to the final list
                 // Use the desired display name from the map value for pinned items
                 finalItems.push({
                     symbol: foundItem.symbol,
                     display_name: topSymbolsMapForCategory[pinnedKey] // Use the desired display name from the map
                 });
                 processedSymbols.add(foundItem.symbol); // Add the API symbol to the set
                 console.log(`Added pinned item: ${foundItem.symbol} (Display: ${topSymbolsMapForCategory[pinnedKey]})`);
             } else if (!foundItem) {
                  console.warn(`Pinned key not found in fetched list for ${category}: ${pinnedKey}. This asset might not be available from the API under the specified exchange/category.`);
             }
        });

        // 2. Add remaining items (not pinned) from the original 'processedItems' list
        // Apply specific sorting logic for ETFs here
        const nonPinnedItems = processedItems.filter(item => !processedSymbols.has(item.symbol));

        if (category === 'ETF') {
             // *** FIX: Sort non-pinned ETFs alphabetically by base symbol ***
             nonPinnedItems.sort((a, b) => a.baseSymbol.localeCompare(b.baseSymbol));
             console.log(`Sorted non-pinned ETF items alphabetically.`);
        }
        // Note: Crypto items were already sorted by exchangeCount earlier

        // Add the sorted (or unsorted for other categories) non-pinned items to the final list
        nonPinnedItems.forEach(item => {
             finalItems.push({
                 symbol: item.symbol,
                 display_name: item.display_name // Use the display_name determined during initial mapping
             });
             processedSymbols.add(item.symbol); // Mark as processed (redundant but safe)
        });


        // Slice the final list to get the top MAX_ASSETS_PER_CATEGORY (100)
        assetList = finalItems.slice(0, MAX_ASSETS_PER_CATEGORY);

        console.log(`Final list for ${category} has ${assetList.length} assets (top ${MAX_ASSETS_PER_CATEGORY}).`);

      } catch (error) {
        console.error(`Failed to fetch or process list for ${category}: ${error.message}`);
        continue; // Skip to the next category if list fetching/processing fails
      }

      // --- Update Database for each asset in the top 100 ---
      if (assetList.length === 0) {
          console.warn(`No assets in the final list for ${category}. Skipping database update for this category.`);
          continue; // Skip to the next category
      }

      console.log(`Updating database for ${assetList.length} assets in ${category}...`);
      for (let i = 0; i < assetList.length; i++) {
        const assetInfo = assetList[i]; // This item now has symbol and display_name
        const rank = i + 1;
        const isTop40 = rank <= TOP_40_THRESHOLD;

        console.log(`Processing asset ${i + 1}/${assetList.length}: ${assetInfo.symbol} (Display: ${assetInfo.display_name}, Category: ${category}, Rank ${rank})`);

        // Fetch logo and current data (using helper functions with built-in delays)
        // These functions already handle API call delays and errors internally to some extent
        const logoUrl = await fetchLogoUrl(assetInfo.symbol);
        if (logoUrl) {
            // console.log(`Fetched logo URL for ${assetInfo.symbol}`); // Too verbose
        } else {
            console.warn(`No logo URL found for ${assetInfo.symbol}`);
        }

        const currentData = await fetchCurrentData(assetInfo.symbol); // Fetches price, change, sparkline
        if (currentData) {
             // console.log(`Fetched current data for ${assetInfo.symbol}. Price: ${currentData.price}`); // Too verbose
        } else {
             console.warn(`Failed to fetch current data for ${assetInfo.symbol}.`);
        }


        // Prepare data for DB update/insert
        const updateData = {
          display_name: assetInfo.display_name, // *** Use the determined display_name ***
          category: category,
          logo_url: logoUrl, // logoUrl might be null
          rank_in_category: rank,
          is_top_40: isTop40,
          // Only include current data fields if fetching was successful
          // If fetchCurrentData fails, the existing data in the DB will be kept (if any)
          ...(currentData && {
            current_price: currentData.price,
            price_change_24h_percent: currentData.change,
            sparkline_values: currentData.values,
            sparkline_positive: currentData.positive,
            last_updated_current: new Date(), // Update timestamp for all top 100 items that were successfully updated
          }),
        };

        try {
          // Use findOneAndUpdate with upsert: true to insert if not exists, update if exists
          // $set ensures only specified fields are updated
          const result = await TwdataAsset.findOneAndUpdate( // *** Updated Model Name ***
            { symbol: assetInfo.symbol }, // Find by unique symbol
            { $set: updateData },
            { upsert: true, new: true, setDefaultsOnInsert: true } // upsert creates if not found, new returns the updated doc
          );
          // console.log(`DB operation successful for ${assetInfo.symbol}. Document ${result ? 'updated/inserted' : 'not found/modified'}.`); // Too verbose
        } catch (dbError) {
          console.error(`Database error updating ${assetInfo.symbol}: ${dbError.message}`);
        }

        // Add a small delay between processing each asset to space out API calls
        await delay(ASSET_PROCESSING_DELAY_MS);
      }

      console.log(`\n--- Finished syncing category: ${category} ---`);
    }

    console.log('\nInfrequent top 100 asset sync finished.');

  } catch (error) {
    console.error('Major error during infrequent top 100 asset sync:', error);
  } finally {
     // You might want to keep the DB connection open if running other scripts
     // If this script is run standalone and exits, you might disconnect:
     // if (mongoose.connection.readyState === 1) {
     //    await mongoose.disconnect();
     //    console.log('Database disconnected after infrequent sync.');
     // }
  }
}

// To run this script manually (e.g., for initial setup or debugging):
// node src/scripts/infrequentTop100Sync.js

// To schedule it, you would typically use a job scheduler like node-schedule or cron/PM2
// Example using node-schedule (install node-schedule):
// import schedule from 'node-schedule';
// // Schedule to run at midnight every 4th day of the month
// schedule.scheduleJob('0 0 */4 * *', syncTop100Assets);
// // Or run it immediately on script start (useful for PM2)
// // syncTop100Assets().catch(console.error);


// For demonstration/scheduling purposes, export the function
export { syncTop100Assets };

// --- Call the main function when the script is executed directly ---
// Use import.meta.url and path to get the current file path in ES Modules
const currentFilePath = fileURLToPath(import.meta.url);
const scriptFilePath = path.resolve(process.cwd(), process.argv[1]); // Resolve the path of the executed script

if (currentFilePath === scriptFilePath) {
    syncTop100Assets().catch(error => {
        console.error("Unhandled error in syncTop100Assets:", error);
        process.exit(1); // Exit with an error code
    });
}
// -----------------------------------------------------------------