import mongoose from 'mongoose';

const AIRobotPackageSchema = new mongoose.Schema({
    cycleDurationDays: {
        type: Number,
        required: true,
        min: 1
    },
    minDailyReturnPercentage: {
        type: Number,
        required: true,
        min: 0
    },
    maxDailyReturnPercentage: {
        type: Number,
        required: true,
        min: 0
    },
    minInvestmentAmount: {
        type: Number,
        required: true,
        min: 0
    },
    maxInvestmentAmount: {
        type: Number,
        required: true,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true 
});

export const AIRobotPackage = mongoose.model('AIRobotPackage', AIRobotPackageSchema);
