import mongoose from 'mongoose';

const LoanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    userProfile : {
        type:String,
        required : true
    },
    userFullName: {
        type : String,
        required : true
    },
    loanAmount: {
        type: Number,
        required: true,
        min: 0
    },
    
    outstandingPrincipal: { 
        type: Number,
        required: true,
        default: function() { return this.loanAmount; } 
    },
    loanTermDays: {
        type: Number,
        required: true,
        min: 1
    },
   
    dailyInterestRate: { 
        type: Number,
        required: true,
        min: 0
    },
    accruedInterest: { 
        type: Number,
        default: 0,
        min: 0
    },
    overdueInterestAccrued: { 
        type: Number,
        default: 0,
        min: 0
    },
    latePaymentFeesAccrued: { 
        type: Number,
        default: 0,
        min: 0
    },
    loanDate: { 
        type: Date,
        required: true,
        default: Date.now
    },
    approvalDate: {
        type: Date,
        default: null
    },
    dueDate: { 
        type: Date,
        default : null
    },
    status: {
        type: String,
        enum: ['PendingApproval', 'Approved', 'Repaid', 'Defaulted', 'Rejected'],
        default: 'PendingApproval',
        required: true
    },
    amountRepaid: {
        type: Number,
        default: 0
    },
    repaidDate: {
        type: Date,
        default: null
    },
    repaymentHistory: [
        {
            _id: false, 
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            type: { type: String, enum: ['partial', 'full'], default: 'partial' }, 
            recordedBy: { type: String, enum:['user', 'admin', 'monitor'], required: true } 
        }
    ],
    disableInterestAccrual: {
        type: Boolean,
        default: false
    },
    disableLateFeesAccrual: { 
        type: Boolean,
        default: false
    },
    
    lastInterestAccrualDate: { 
        type: Date,
        default: null
    },
    lastOverdueChargeDate: { 
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

export const Loan = mongoose.model('Loan', LoanSchema);