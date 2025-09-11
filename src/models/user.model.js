import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
dotenv.config({path: './.env'})

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  firstName: { type: String, required: true },
  lastName: { type: String, required: true },

  password: {
    type: String,
    required: true
  },

  dpLocalPath : {
    type : String,
    required : false
  },

  trxPassword : {
    type: String,
    required: false
  },

  isEmailVerified: {
    type: Boolean,
    default: false
  },

  agreedToTerms: {
    type: Boolean,
    required: true
  },

  notification: [
    {
      message: String,
      isRead: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      isAnnouncement : { type : Boolean , default : false }
    }
  ],

  accountBalance: {
    type: Number,
    default: 0
  },

  lockedBalance: {
      type: Number,
      default: 0,
      min: 0 
  },

  loanBalance: {
    type: Number,
    default: 0
  },

  transactionHistory: [
    {
      type: { type: String, enum: ['deposit', 'withdraw', 'loan', 'contract' , 'ai_robot_redemption'], required: true },
      amount: Number,
      date: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
      metadata: mongoose.Schema.Types.Mixed
    }
  ],

  contracts: [
    {
      assetId: mongoose.Schema.Types.ObjectId,
      assetName: String,
      purchaseDate: Date,
      quantity: Number,
      valueAtPurchase: Number,
      isSold: { type: Boolean, default: false },
      soldDate: Date,
      sellValue: Number
    }
  ],

 kyc: {
    status: {
      type: String,
      enum: ['unsubmitted', 'pending', 'approved', 'rejected'],
      default: 'unsubmitted'
    },
    documentType: { type: String },
    documentNumber: String,
    documentImageUrl: String,
    submittedAt: Date,
    verifiedAt: Date,
    reviewedByAdminId: mongoose.Schema.Types.ObjectId
  },

  creditScore: {
    type: Number,
    default: 0
  },

  internalNotes: [
    {
      adminId: mongoose.Schema.Types.ObjectId,
      note: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],

  isLocked: {
    type: Boolean,
    default: false
  },
  refreshToken: {
    type: String
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  robotLimit : {
    type : Number,
    default :1 , 
    required : false
  },
  loanLimit : { 
    type : Number,
    default :0 , 
    required : false
  },
    adminChatDisplayStatus: {
      type: String,
      enum: ['Auto', 'Online', 'Offline'], 
      default: 'Auto'
  },
    unreadChatMessages: {
      type: Map,
      of: Number,
      default: {} 
  },
  vipStatus : {
    type : String,
    enum : ['vip 0' , 'vip 1', 'vip 2', 'vip 3' , 'vip 4', 'vip 5', 'vip 6', 'vip 7', 'vip 8' , 'vip 9'],
    default : 'vip 0'
  }, 
  country: {
    type: String,
    required: false
  },
  state: {
    type: String,
    required: false 
  },

} ,
{
    timestamps : true
});

UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  
  if (this.isModified('trxPassword') && this.trxPassword) {
    this.trxPassword = await bcrypt.hash(this.trxPassword, 10);
  }
    next();
  });
  
  

UserSchema.methods.isPassCorrect = async function (password) {
   return bcrypt.compare(password , this.password)
}

UserSchema.methods.isTrxPassCorrect = async function (trxPass) {
    return bcrypt.compare(trxPass , this.trxPassword)
 }

UserSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id   : this._id,
        email : this.email
    } , process.env.ACCESS_TOKEN_KEY,
    {
        expiresIn : process.env.ACCESS_TOKEN_EXPIRY
    })
}

UserSchema.methods.generateRefreshToken = function(){
    return jwt.sign({
        _id : this._id,
        email : this.email
    } , process.env.REFRESH_TOKEN_KEY,
    {
        expiresIn : process.env.REFRESH_TOKEN_EXPIRY
    })
}



export const User = mongoose.model('User', UserSchema)
