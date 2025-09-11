// src/scripts/continuousUpdate.js

// --- VERY FIRST LINE ---
console.log('Script: continuousUpdate.js starting...');
// -----------------------

import dotenv from 'dotenv';
import mongoose from 'mongoose'; // Import mongoose to check connection state
import { connectDatabase } from '../db/connectDb.js'; // Adjust path as needed
import { TwdataAsset } from '../models/twdata.models.js'; // *** Updated Model Name ***
import { delay, fetchCurrentData } from '../utils/twdata.js'; // Adjust path as needed

console.log('Imports successful.');

console.log('Attempting to load environment variables...');
dotenv.config();
console.log('dotenv.config() called.');

// Optional: Temporarily log API key to verify it's loaded (REMOVE IN PRODUCTION)
// console.log('TWELVE_DATA_API_KEY:', process.env.TWELVE_DATA_API_KEY ? 'Loaded' : 'Not Loaded');
// console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Loaded' : 'Not Loaded');

// --- Configuration ---
const UPDATE_INTERVAL_MS = 15000; // Update cycle every 15 seconds (adjust based on desired staleness)
// API_CALL_DELAY_MS is defined in utils.js (currently 200ms)

// --- Main Continuous Update Function ---
async function runContinuousAssetUpdate() {
  console.log('Starting continuous asset update logic...');

  try {
    // Connect to DB if not already connected
    console.log('Attempting to connect to the database...');
    if (mongoose.connection.readyState === 0) {
       await connectDatabase();
       console.log('Database connected successfully for continuous update script.');
    } else {
       console.log('Database already connected.');
    }
  } catch (err) {
     console.error('Failed to connect to database on startup:', err);
     // If DB connection fails on startup, wait and retry or exit
     console.log('Waiting 60 seconds before retrying DB connection...');
     await delay(60000); // Wait 1 minute before potentially retrying connection or exiting
     // In a real application, you'd have more robust retry logic
     return runContinuousAssetUpdate(); // Simple retry
  }


  while (true) { // Infinite loop to keep the script running
    console.log(`\n--- Starting update cycle for top 40 assets ---`);
    const startTime = Date.now();

    try {
      // Find all assets flagged as top 40 across all categories
      // Select only the symbol as that's all we need to fetch data
      console.log('Querying database for assets marked as is_top_40...');
      const top40Assets = await TwdataAsset.find({ is_top_40: true }).select('symbol').lean(); // *** Updated Model Name *** // Use .lean() for faster reads

      if (top40Assets.length === 0) {
        console.warn('No assets marked as is_top_40 in the database. Please ensure infrequentTop100Sync has run.');
        console.log(`Waiting ${UPDATE_INTERVAL_MS}ms before next check...`);
        await delay(UPDATE_INTERVAL_MS); // Wait before checking again
        continue; // Skip the update cycle
      }

      console.log(`Found ${top40Assets.length} top 40 assets to update. Beginning fetch and update loop.`);
      let updatedCount = 0;

      for (let i = 0; i < top40Assets.length; i++) {
        const asset = top40Assets[i];
        const symbol = asset.symbol;
        // console.log(`Processing asset ${i + 1}/${top40Assets.length}: ${symbol}`); // Uncomment for verbose logging

        try {
          // Fetch current data (this helper has a delay inside - API_CALL_DELAY_MS)
          const currentData = await fetchCurrentData(symbol);

          if (currentData) {
            // console.log(`Fetched current data for ${symbol}. Price: ${currentData.price}`); // Uncomment for verbose logging
            // Update the asset in the database
            // Use updateOne for potentially better performance than findOneAndUpdate when just setting fields
            const result = await TwdataAsset.updateOne( // *** Updated Model Name ***
              { symbol: symbol },
              {
                $set: {
                  current_price: currentData.price,
                  price_change_24h_percent: currentData.change,
                  sparkline_values: currentData.values,
                  sparkline_positive: currentData.positive,
                  last_updated_current: new Date(), // Update timestamp on successful fetch
                },
              }
            );
            // console.log(`DB update successful for ${symbol}. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`); // Uncomment for verbose logging
            if (result.modifiedCount > 0) {
                updatedCount++;
            }
          } else {
             console.warn(`Skipping DB update for ${symbol} due to failed data fetch.`);
          }


        } catch (apiError) {
          console.error(`Failed to fetch current data for ${symbol}: ${apiError.message}`);
          // Continue to the next asset even if one fails
        }
        // The delay between individual API calls is handled inside fetchCurrentData via callTwelveDataApi
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`\nFinished updating ${updatedCount}/${top40Assets.length} top 40 assets in ${duration.toFixed(2)} seconds.`);

      // Wait for the remainder of the update interval before the next cycle
      const timeToWait = UPDATE_INTERVAL_MS - (endTime - startTime);
      if (timeToWait > 0) {
        console.log(`Waiting ${timeToWait}ms for the next update cycle...`);
        await delay(timeToWait);
      } else {
         console.log('Update cycle took longer than UPDATE_INTERVAL_MS. Starting next cycle immediately.');
         // Optionally add a minimum small delay here even if it took too long
         await delay(1000); // Wait at least 1 second
      }


    } catch (error) {
      console.error('Major error during continuous update cycle:', error);
      // If a major error occurs (e.g., DB connection loss after startup), wait longer before retrying the cycle
      console.log(`Waiting ${UPDATE_INTERVAL_MS * 5}ms before retrying update cycle...`);
      await delay(UPDATE_INTERVAL_MS * 5); // Wait 5x longer
    }
  }
}

// To run this script:
// node src/scripts/continuousUpdate.js
// Recommended: Use a process manager like PM2 to keep this script running indefinitely.
// pm2 start src/scripts/continuousUpdate.js --name market-continuous-update --watch --ignore-watch="node_modules"

// For demonstration/scheduling purposes, export the function
export { runContinuousAssetUpdate };

// --- Call the main function when the script is executed directly ---
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runContinuousAssetUpdate().catch(error => {
        console.error("Unhandled error in runContinuousAssetUpdate:", error);
        process.exit(1); // Exit with an error code
    });
}
// -----------------------------------------------------------------
import { fileURLToPath } from 'url'; // Needed for the check above

