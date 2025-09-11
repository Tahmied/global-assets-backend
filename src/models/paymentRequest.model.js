import mongoose from "mongoose";

const paymentRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'fraud'],
    default: 'pending'
  },
  paymentProve : {
    type : String,
    required : true
  } ,
  chainName : {
    type : String,
    required : true
  }
} ,
{
  timestamps : true
});

export const paymentRequest = mongoose.model('paymentRequest', paymentRequestSchema)
