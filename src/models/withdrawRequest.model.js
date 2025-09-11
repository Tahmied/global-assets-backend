import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema({
  userId: {
    type : String,
    required: true
  },
  fullName : {
    type : String,
    required: true
  },
  profilePic : {
    type :String,
    required : true
  },
  amount: {
    type: Number,
    required: true
  },
  amountInUsd : {
    type : Number,
    require : true
  },
  toAddress: {
    type: String, 
    required: true,
    trim: true
  },
  currency : {
    type : String,
    required : true,
    trim:true
  } , 
  chainName : {
    type : String,
    required : true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected'],
    default: 'pending'
  },
  isApprovedOnce: {
    type: Boolean,
    default: false
  }
} , {
  timestamps: true,
});

export const withdrawRequest = mongoose.model('withdrawRequest', withdrawalRequestSchema)
