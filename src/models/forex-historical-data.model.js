import mongoose from "mongoose";

const forexHistoricalDataSchema = new mongoose.Schema(
  {
    // Link to the forex pair (using its pair_id)
    pair_id: {
      type: String, // Match the type in ForexPair schema
      required: true,
      index: true, // Index for filtering by pair
    },
    // The timestamp for this historical data point (e.g., end of the day)
    timestamp: {
      type: Date,
      required: true,
      index: true, // Index for filtering by date ranges and sorting
    },
    open: {
      type: Number,
      required: true,
    },
    high: {
      type: Number,
      required: true,
    },
    low: {
      type: Number,
      required: true,
    },
    close: {
      type: Number,
      required: true,
    },
    // Volume data might not be standard or available for all Forex APIs.
    // Make it optional if needed, or confirm your API provides it.
    volume: {
      type: Number,
      // required: true, // Uncomment if your API guarantees volume data
    },
  }
);

// Add a compound unique index to prevent storing duplicate historical points for the same pair on the same timestamp
forexHistoricalDataSchema.index({ pair_id: 1, timestamp: 1 }, { unique: true });

export const ForexHistoricalData = mongoose.model('ForexHistoricalData', forexHistoricalDataSchema);