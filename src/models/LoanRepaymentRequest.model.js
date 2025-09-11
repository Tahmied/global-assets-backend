import mongoose from 'mongoose';

const LoanRepaymentRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    loanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Loan', 
        required: true
    },
    amount: { 
        type: Number,
        required: true,
        min: 0.01 
    },
    requestDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
        required: true
    },
    approvalDate: {
        type: Date,
        default: null
    },
    rejectedDate: {
        type: Date,
        default: null
    },
    adminNotes: {
        type: String,
        default: null
    }
}, {
    timestamps: true 
});

export const LoanRepaymentRequest = mongoose.model('LoanRepaymentRequest', LoanRepaymentRequestSchema);