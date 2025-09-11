import mongoose from 'mongoose';

const UserOptionTradeSchema = new mongoose.Schema({
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
        enum: ['Bullish', 'Bearish'],
        required: true
    },
    investmentAmount: { 
        type: Number,
        required: true,
        min: 0
    },
    openingPrice: {
        type: Number,
        required: true
    },
    purchaseTime: { 
        type: Date,
        required: true
    },
    durationSeconds: { 
        type: Number,
        required: true,
        min: 1 
    },
    expiryTime: { 
        type: Date,
        required: true
    },
    expiryPrice: { 
        type: Number,
        default: null
    },
    status: { 
        type: String,
        enum: ['Active', 'Expired_Win', 'Expired_Loss'],
        default: 'Active',
        required: true
    },
    outcome: { 
         type: String,
         enum: ['Win', 'Loss'],
         default: null
    },
    payoutAmount: { 
        type: Number,
        default: 0,
        min: 0
    },
    returnPercentage: {
         type: Number,
         required: true,
         min: 0
    },

    adminControlledOutcome: {
        type: String,
        enum: ['Profit', 'Loss', 'Default'], 
        default: null
    },
}, {
    timestamps: true 
});

export const UserOptionTrade = mongoose.model('UserOptionTrade', UserOptionTradeSchema);