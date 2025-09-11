import mongoose from "mongoose";

const cryptoHistoricalDataSchema = new mongoose.Schema(
  {
    // Link to the crypto asset (using its CMC ID)
    cmc_id: {
      type: Number,
      required: true,
      // Note: We don't make this 'unique' alone, as multiple documents will have the same cmc_id (for different dates)
      index: true, // Index for filtering by asset
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
    volume: {
      type: Number,
      required: true,
    },
  }
);

cryptoHistoricalDataSchema.index({ cmc_id: 1, timestamp: 1 }, { unique: true });

export const CryptoHistoricalData = mongoose.model('CryptoHistoricalData', cryptoHistoricalDataSchema);