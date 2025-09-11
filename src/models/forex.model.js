import mongoose from "mongoose";

const forexPairSchema = new mongoose.Schema(
  {
    // Unique identifier for the currency pair (e.g., "USD/INR")
    pair_id: {
      type: String,
      required: true,
      unique: true, // Ensure no duplicate pairs
      trim: true,
      index: true, // Index for quick lookups by pair ID
    },
    // The symbol (can be same as pair_id or slightly different depending on API source)
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    // Optional: Separate fields for base and quote currency if useful
    base_currency: {
        type: String,
        required: true,
        trim: true,
    },
    quote_currency: {
        type: String,
        required: true,
        trim: true,
    },
    // A descriptive name for the pair (e.g., "US Dollar / Indian Rupee")
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // The current exchange rate
    price: { // Renamed from 'latest_rate' to 'price' for consistency with crypto
      type: Number,
      required: true,
    },
    // 24-hour percentage change (Need to confirm if your Forex API provides this or if you calculate it)
    percent_change_24h: {
      type: Number,
      // required: true, // Make required only if API provides it directly
    },
    // Array for a short sparkline (e.g., 10 days of closing rates)
    sparkline_10d: {
      type: [Number], // Array of Numbers
      default: [], // Default to an empty array
    },
    // Timestamp when the listing data (price, change) was last updated
    last_updated_listing: {
      type: Date,
      required: true,
    },
     // Timestamp when the 10-day sparkline data was last updated
    last_updated_sparkline_10d: {
      type: Date,
      required: true,
    },
  }
);

export const ForexPair = mongoose.model('ForexPair', forexPairSchema);