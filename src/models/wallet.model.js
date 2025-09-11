import mongoose from "mongoose";

const adminWalletAddressSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    qrCode: {
      type: String,
      required: true,
    },
    chainName: {
      type: Array,
      requred: true,  
    },
    availableNow: {
      type: Boolean,
      default: true, 
    },
  },
  {
    timestamps: true, 
  }
);

export const adminWalletAddress = mongoose.model('adminWalletAddress', adminWalletAddressSchema);
