import mongoose from "mongoose";

const cryptoAssetSchema = new mongoose.Schema(
  {
    // Unique ID from CoinMarketCap
    cmc_id: {
      type: Number,
      required: true,
      unique: true, // Ensure no duplicate assets by CMC ID
      index: true, // Index for quick lookups by CMC ID
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rank: {
      type: Number,
      required: true,
      index: true, // Index for sorting by rank on the listing page
    },
    price: {
      type: Number,
      required: true,
    },
    percent_change_24h: {
      type: Number,
      required: true,
    },
    logo_url: {
      type: String,
      required: true, // We'll construct/fetch this in the background job
    },
    // Array for the 10-day sparkline closing prices
    sparkline_10d: {
      type: [Number], // Array of Numbers
      default: [], // Default to an empty array
    },
    // Timestamp when the listing data (price, rank, etc.) was last updated
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

export const CryptoAsset = mongoose.model('CryptoAsset', cryptoAssetSchema);