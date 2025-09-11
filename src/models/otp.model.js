import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true                // so lookups by email are fast
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }      // TTL index: document auto‑deletes once expiresAt is reached
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Otp = mongoose.model('Otp', OtpSchema);
