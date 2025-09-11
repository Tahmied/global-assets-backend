// src/models/TwdataAsset.js
import mongoose from 'mongoose';

const TwdataAssetSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true, // Ensure symbols are unique across all categories
    index: true, // Index for fast lookups by symbol
  },
  display_name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Digital Assets', 'Stock', 'Forex', 'ETF'], // Restrict categories
    index: true, // Index for category filtering
  },
  logo_url: {
    type: String,
    default: null, // Can be null if no logo is found
  },
  current_price: {
    type: Number,
    default: 0,
  },
  price_change_24h_percent: {
    type: Number,
    default: 0,
  },
  sparkline_values: {
    type: [Number], // Array of numbers for the sparkline
    default: [],
  },
  sparkline_positive: {
    type: Boolean,
    default: false, // True if 24h change is positive
  },
  last_updated_current: {
    type: Date,
    default: Date.now, // Timestamp for the last current data update
  },
  rank_in_category: {
    type: Number,
    default: null, // Rank from 1 to 100 within its category from the last sync
    index: true, // Index for sorting and filtering top 100
  },
  is_top_40: {
    type: Boolean,
    default: false, // Flag indicating if this asset is in the top 40 for frequent updates
    index: true, // Index for filtering top 40 assets efficiently
  },
}, { timestamps: true }); // Adds createdAt and updatedAt timestamps managed by Mongoose

// Compound index for efficient querying by category and rank (for list pages)
TwdataAssetSchema.index({ category: 1, rank_in_category: 1 });
// Compound index for efficient querying by is_top_40 and category (for the continuous update script)
TwdataAssetSchema.index({ is_top_40: 1, category: 1 });


export const TwdataAsset = mongoose.model('TwdataAsset', TwdataAssetSchema);
