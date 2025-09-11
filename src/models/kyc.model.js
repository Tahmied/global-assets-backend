// models/Kyc.js
import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  monthlyIncome: {
    type: Number,
    required: true,
  },
  expectedInvestment: {
    type: Number,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  idType: {
    type: String,
    enum: ['NID', 'Passport', 'Driving License', 'Residence Permit'],
    required: true,
  },
  idFrontImage: {
    type: String, // local path or URL
    required: true,
  },
  idBackImage: {
    type: String, // local path or URL
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  }
}, { timestamps: true });

export const Kyc = mongoose.model('Kyc', kycSchema)