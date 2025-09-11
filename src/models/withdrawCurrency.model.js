import mongoose from 'mongoose';

const withdrawCurrencySchema = new mongoose.Schema({
  currencyName: {
    type: String,
    required: true,
  },
  chainNames: {
    type: [String],
    required: true,
  },
  fee : {
    type :Number,
    required :false
  },
  customFee : {
    type : Boolean,
    required : false
  }
}, { timestamps: true });

export const withdrawCurrency = mongoose.model('withdrawCurrency', withdrawCurrencySchema);
