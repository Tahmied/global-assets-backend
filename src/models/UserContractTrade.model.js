import mongoose from 'mongoose';

const ContractPositionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assetPair: {
        type: String,
        required: true
    },
    direction: { 
        type: String,
        enum: ['Buy', 'Sell'],
        required: true
    },
    openingPrice: {
        type: Number,
        required: true
    },
    quantity: { 
        type: Number,
        required: true,
        min: 0
    },
    leverage: {
        type: Number,
        required: true,
        min: 1
    },
    marginUsed: {
         type: Number,
         required: true,
         min: 0
    },
    openingTime: {
        type: Date,
        required: true
    },
    status: { 
        type: String,
        enum: ['Open', 'Closed', 'Liquidated'],
        default: 'Open',
        required: true
    },
    closingPrice: { 
        type: Number,
        default: null
    },
    closingTime: {
        type: Date,
        default: null
    },
    realizedPnl: {
        type: Number,
        default: null
    },
    stopLossPrice: {
        type: Number,
        default: null
    },
    takeProfitPrice: { 
        type: Number,
        default: null
    },
   

}, {
     timestamps: true 
});

export const ContractPosition = mongoose.model('ContractPosition', ContractPositionSchema);