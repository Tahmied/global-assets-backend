import mongoose from 'mongoose';

const AIRobotInvestmentOrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AIRobotPackage',
        required: true
    },
    investmentAmount: {
        type: Number,
        required: true,
        min: 0
    },
    selectedAssetName: {
        type: String,
        required: true,
        trim: true
    },
    minDailyReturnPercentage: {
        type: Number,
        required: true
    },
    maxDailyReturnPercentage: {
        type: Number,
        required: true
    },
    cycleDurationDays: {
        type: Number,
        required: true
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Running', 'Completed', 'Redeemed', 'Cancelled'], 
        default: 'Running',
        required: true
    },
    totalProfitEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    dailyRevenueHistory: [
        {
            date: { type: Date, required: true },
            amount: { type: Number, required: true, min: 0 }
        }
    ],
    lastProfitDistributionDate: {
        type: Date,
        default: null 
    },
    redemptionDate: {
        type: Date,
        default: null
    },
    redeemedAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true 
});

export const AIRobotInvestmentOrder = mongoose.model('AIRobotInvestmentOrder', AIRobotInvestmentOrderSchema);
