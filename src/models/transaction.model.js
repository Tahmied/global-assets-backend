import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        category: {
            type: String,
            enum: ['loan', 'repayment', 'deposit', 'withdrawal', 'trading', 'ai-robot-purchase', 'ai-robot-redemption'],
        },
        status: {
            type: String,
            enum: ['completed', 'pending', 'failed'],
            default: 'completed'
        }
    },
    {
        timestamps: true
    }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);