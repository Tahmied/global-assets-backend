import fs from 'fs';
import mongoose from 'mongoose';
import { Kyc } from '../models/kyc.model.js';
import { Loan } from '../models/loan.model.js';
import { LoanRepaymentRequest } from '../models/LoanRepaymentRequest.model.js';
import { paymentRequest } from '../models/paymentRequest.model.js';
import { siteSettings } from '../models/siteSettings.model.js';
import { Transaction } from '../models/transaction.model.js';
import { User } from '../models/user.model.js';
import { UserOptionTrade } from '../models/UserOptionTrade.model.js';
import { adminWalletAddress } from '../models/wallet.model.js';
import { withdrawCurrency } from '../models/withdrawCurrency.model.js';
import { withdrawRequest } from '../models/withdrawRequest.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export async function getPriceInUSD(symbol) {
  if (!symbol) {
    throw new ApiError(400, 'Symbol is required for price fetching.');
  }
  if (['USDT', 'USDC', 'DAI'].includes(symbol.toUpperCase())) {
    return 1;
  }

  const apiSymbol = `${symbol}/USD`;

  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(apiSymbol)}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'error') {
        throw new ApiError(502, `TwelveData API error: ${data.message}`);
    }

    if (data.price) {
      return parseFloat(data.price);
    }
    
    throw new ApiError(500, 'Could not retrieve price from API response.');
  } catch (err) {
    console.error(`Error fetching price for ${symbol}:`, err);
    throw new ApiError(500, `Failed to get a valid conversion rate for ${symbol}.`);
  }
}


  async function addUserNotification(userId, message) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`[RedeemAIRobot] User ${userId} not found when trying to add notification.`);
            return;
        }

        user.notification.push({
            message: message,
            createdAt: new Date()
        });

        await user.save();

    } catch (err) {
        console.error(`Failed to add notification for user ${userId}:`, err);
    }
  } 

  const listUsers = asyncHandler(async (req, res) => {
    // 1. Parse & validate query params
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search?.trim();
    const kycStatus = req.query.kycStatus;
    // Validate inputs
    if (page < 1) throw new ApiError(400, 'Page must be a positive integer');
    if (limit < 1 || limit > 100) throw new ApiError(400, 'Limit must be between 1 and 100');
    
    const allowedSortFields = ['createdAt', 'firstName', 'lastName', 'email'];
    if (!allowedSortFields.includes(sortBy)) {
      throw new ApiError(400, `Invalid sort field. Allowed fields: ${allowedSortFields.join(', ')}`);
    }
  
    // 2. Build Mongo filter
    const filter = {};
    if (search && search.length > 0) {
      filter.$or = [
        { email: new RegExp(search, 'i') },
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') }
      ];
    }
    if (kycStatus) {
      filter['kyc.status'] = kycStatus;
    }
  
    // 3. Execute count + find in parallel
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };
  
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password -refreshToken') 
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
  
    // 4. Return structured response
    const lastPage = Math.ceil(total / limit);
    
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          total,
          page,
          limit,
          lastPage,
          hasMore: page < lastPage,
          users
        },
        'Users fetched successfully'
      )
    );
  });

  const getUser = asyncHandler(async(req,res)=>{
    const userId = req.params.id
    if(!userId){
        throw new ApiError(400 , 'unable to find the user id in the param')
    }

    const user = await User.findById(userId).select('-password -refreshToken').lean();
    if(!user){
        throw new ApiError(400 , 'unable to find the user')
    }

    res.status(200).json(new ApiResponse(200 , user, 'user fetched successfully'))
  })

  const updateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }
  
    const user = await User.findById(userId).select('-password -refreshToken');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
  
    const {
      firstName,
      lastName,
      password,
      trxPassword,
      accountBalance,
      loanBalance,
      kyc,
      isLocked,
      notification,
      internalNotes,
      isAdmin, robotLimit, loanLimit, vipStatus, creditScore
    } = req.body;
  
    const dpLocalPath = req.file?.path;
  
    // Basic updates
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (accountBalance !== undefined) user.accountBalance = accountBalance;
    if (loanBalance !== undefined) user.loanBalance = loanBalance;
    if (robotLimit !== undefined) user.robotLimit = robotLimit;
    if (isLocked !== undefined) user.isLocked = isLocked;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    if (dpLocalPath) user.dpLocalPath = dpLocalPath;
    if (loanLimit !== undefined ) user.loanLimit = loanLimit;
    if (password !== undefined) user.password = password
    if (trxPassword !== undefined) user.trxPassword = trxPassword
    if (vipStatus !== undefined) user.vipStatus = vipStatus
    if (creditScore !== undefined) user.creditScore = creditScore
  
    // KYC
    if (kyc && typeof kyc === 'object') {
      user.kyc.status = kyc.status;
    }
  
    // Notification (assumes string or object)
    if (notification) {
      user.notification.push(notification);
    }
  
    // Internal notes (string or object)
    if (internalNotes) {
      user.internalNotes.push(internalNotes);
    }
  
    // Password (optional – hash if needed)
    if (password) {
      user.password = password;
    }

    // transaction password
    if(trxPassword) {
      user.trxPassword = trxPassword
    }

    //vip status
    if(vipStatus) {
      user.vipStatus = vipStatus
    }
  
    await user.save();
  
    return res.status(200).json(
      new ApiResponse(200, user, 'User details updated')
    );
  });
  
  const deleteNote = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const noteId = req.params.noteId;
  
    if (!mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(noteId)
    ) {
      throw new ApiError(400, 'Invalid user or note ID');
    }
  
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found');
  
    // pull out the note subdoc by its _id
    user.internalNotes.pull({ _id: noteId });
  
    await user.save();
  
    res.status(200).json(
      new ApiResponse(200, { noteId }, 'Note deleted')
    );
  });

  const listFundRequests = asyncHandler(async (req, res) => {
    // 1) Pagination params
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;
  
    // 2) Total count (all documents)
    const total = await paymentRequest.countDocuments();
  
    // 3) Fetch paginated requests + populate user data
    const rawRequests = await paymentRequest.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'firstName lastName dpLocalPath') // grab only those fields
      .lean();
    // 4) Reshape each item
    const requests = rawRequests.map(tx => ({
      _id:         tx._id,
      amount:      tx.amount,
      currency:    tx.currency,
      status:      tx.status,
      trx:         tx.trx,
      createdAt:   tx.createdAt,
      updatedAt:   tx.updatedAt,
      paymentProve:tx.paymentProve,
      chainName : tx.chainName,
      user: {
        id:          tx.userId._id,
        fullName:    `${tx.userId.firstName} ${tx.userId.lastName}`,
        dpLocalPath: tx.userId.dpLocalPath
      }
    }));
  
    // 5) Send
    res.status(200).json(
      new ApiResponse(
        200,
        { total, page, limit, requests },
        'Fund requests fetched successfully'
      )
    );
  });
  
const setFundStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;

  // 1) Required fields
  if (!id || !status) {
    throw new ApiError(400, 'Fund Id and status are required');
  }

  // 2) Validate ObjectId
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid fund id');
  }

  // 3) Quick status validation
  const validStatuses = ['pending', 'completed', 'fraud'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of ${validStatuses.join(', ')}`);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 4) Find the payment request by its _id (not by `id`)
    const paymentReq = await paymentRequest.findById(id).session(session);
    if (!paymentReq) {
      // nothing to commit, but abort to be safe
      await session.abortTransaction();
      throw new ApiError(404, 'Transaction not found');
    }

    const previousStatus = paymentReq.status;

    // 5) Update status and save within the session
    paymentReq.status = status;
    // updatedAt will be set automatically by timestamps, but explicit set is fine:
    paymentReq.updatedAt = Date.now();
    await paymentReq.save({ session });

    // 6) Only when status transitions into 'completed' from a non-completed state,
    // bump the user’s balance (prevents double-crediting)
    if (status === 'completed' && previousStatus !== 'completed') {
      const user = await User.findById(paymentReq.userId).session(session);
      if (!user) {
        throw new ApiError(404, 'User not found for this transaction');
      }

      user.accountBalance = (user.accountBalance || 0) + paymentReq.amount;
      await user.save({ session });

      await Transaction.create([{
        userId: user._id,
        amount: paymentReq.amount,
        type: 'credit',
        description: 'Deposit via ' + paymentReq.chainName,
        referenceId: paymentReq._id,
        category: 'deposit',
        status: 'completed'
      }], { session });
      addUserNotification(user._id , `your add fund request is approved`)
    }

    // 7) Commit and return the updated payment request
    await session.commitTransaction();
    res.status(200).json(new ApiResponse(200, paymentReq, 'Status updated successfully'));
  } catch (err) {
    // rollback on error
    try { await session.abortTransaction(); } catch (_) {}
    throw err;
  } finally {
    session.endSession();
  }
});

  // admin panel settings APIs

  const setWalletAddress = asyncHandler(async (req, res) => {
    const { name, address, chainName } = req.body;
  
    // Validate required fields
    if (!name || !address) {
      throw new ApiError(400, 'All fields are required');
    }
    if (!chainName) {
      throw new ApiError(400, 'chain name is a required field');
    }
  
    // Convert comma-separated chain names to array
    const chainNameArray = chainName.split(',').map(c => c.trim());
  
    // Check if QR code is uploaded
    let paymentQrCode = req.file?.path;
    if (!paymentQrCode) {
      paymentQrCode = 'qr code will automatically generated';
    }
  
    try {
      // Create a new payment method (admin wallet address)
      const paymentMethod = await adminWalletAddress.create({
        name,
        address,
        qrCode: paymentQrCode,
        chainName: chainNameArray,
        availableNow: true,
      });
  
      res.status(201).json({
        message: 'Wallet address created successfully',
        paymentMethod,
      });
    } catch (err) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw new ApiError(500, 'Server error during wallet address creation');
    }
  });

  const setWithdrawalCurrencies = asyncHandler(async (req, res) => {
    let { currencyName, chainNames, fee } = req.body;
  
    if (!currencyName || !chainNames) {
      throw new ApiError(400, 'currencyName and chainNames are required');
    }
  
    // Normalize chainNames into an array
    let chains;
    if (Array.isArray(chainNames)) {
      chains = chainNames;
    } else if (typeof chainNames === 'string') {
      chains = chainNames
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
    } else {
      throw new ApiError(400, 'chainNames must be an array or a comma-separated string');
    }
  
    // Determine if user supplied a custom numeric fee
    const hasCustomFee = typeof fee === 'number' && !isNaN(fee);
    if (!hasCustomFee) {
      // fetch the default withdrawalFee from your single siteSettings document
      const settings = await siteSettings.findOne();
      if (!settings) {
        throw new ApiError(500, 'Site settings not found');
      }
      fee = settings.withdrawalFee;
    }
  
    const newCurrency = await withdrawCurrency.create({
      currencyName,
      chainNames: chains,
      fee,
      customFee: hasCustomFee
    });
  
    res
      .status(201)
      .json(new ApiResponse(201, newCurrency, 'Withdrawal currency added'));
  });
  
  const getSupportedCurrencies = asyncHandler(async (req,res)=>{
    const supportedCurrencies = await withdrawCurrency.find()
    if(!supportedCurrencies){
      throw new ApiError(500 , 'system error, failed to fetch currencies from database')
    }
    res.status(200).json( new ApiResponse(200 , supportedCurrencies, 'supported currencies fetched'))
  })

  const setWithdrawalFee = asyncHandler(async (req, res) => {
    const { fee } = req.body;
  
    if (typeof fee !== "number") {
      throw new ApiError(400, "fee must be a number");
    }
  
    // Update withdrawal fee on all non-custom currencies
    const result = await withdrawCurrency.updateMany(
      { customFee: false },
      { $set: { fee } }
    );
  
    // Update the withdrawalFee in the singleton siteSettings document
    const updatedSettings = await siteSettings.findOneAndUpdate(
      {}, // find the single document
      { $set: { withdrawalFee: fee, customFee: true } },
      { new: true, upsert: true }
    );
  
    return res.status(200).json(
      new ApiResponse(
        200,
        { currenciesUpdated: result, siteSettings: updatedSettings },
        "Fees updated on all non-custom currencies and site settings updated"
      )
    );
  });

  const getSiteSettings = asyncHandler(async (req, res) => {
    try {
      // Find the first (and only) site settings document
      const settings = await siteSettings.findOne({});
  
      if (!settings) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, "Site settings not found"));
      }
  
      return res.status(200).json(
        new ApiResponse(200, settings, "Site settings retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching site settings:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  export const updateWalletAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, chainName } = req.body;
    if (!name || !address || !chainName) {
      throw new ApiError(400, 'All fields are required');
    }
    const chainNameArray = chainName.split(',').map(c => c.trim());

    const updated = await adminWalletAddress.findByIdAndUpdate(
      id,
      { name, address, chainName: chainNameArray },
      { new: true }
    );

    if (!updated) {
      throw new ApiError(404, 'Wallet address not found');
    }

    res.status(200).json(new ApiResponse(200, updated, 'Wallet address updated successfully'));
  });

  export const deleteWalletAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const removed = await adminWalletAddress.findByIdAndDelete(id);
    if (!removed) {
      throw new ApiError(404, 'Wallet address not found');
    }
    res.status(200).json(new ApiResponse(200, null, 'Wallet address deleted successfully'));
  });

  export const deleteWithdrawalCurrency = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const removed = await withdrawCurrency.findByIdAndDelete(id);
    if (!removed) {
      throw new ApiError(404, 'Withdrawal currency not found');
    }
    res.status(200).json(new ApiResponse(200, null, 'Withdrawal currency deleted successfully'));
  });



  // kyc related controllers

  const getKycSubmissions = async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 5, 1);
      const skip = (page - 1) * limit;
      
      // Add status filter from query params
      const statusFilter = req.query.status ? { status: req.query.status } : {};
      
      // Get total count WITH FILTER
      const total = await Kyc.countDocuments(statusFilter);

      // Apply status filter to submissions query
      const submissions = await Kyc.find(statusFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
        
      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;
  
      // Response in desired format
      return res.status(200).json({
        statusCode: 200,
        success: true,
        message: 'KYC submissions fetched successfully',
        data: {
          total,
          page,
          limit,
          lastPage: totalPages,
          hasMore,
          submissions
        }
      });
    } catch (error) {
      console.error('Error fetching KYC submissions:', error);
      return res.status(500).json({
        statusCode: 500,
        success: false,
        message: 'Server error while fetching KYC submissions'
      });
    }
  };

 const setKycStatus = asyncHandler(async (req, res) => {
    const { status, userId } = req.body; 
    if (!status || !userId) {
        throw new ApiError(400, 'Status and userId are required.');
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid user ID format.');
    }

    // Allowed statuses now match your provided reference code
    const allowedStatuses = ['pending', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, 'Invalid status value. Allowed: pending, approved, rejected.');
    }

    try {
        // 1. Find the KYC record for the user
        const kycCertificate = await Kyc.findOne({ userId: userId });

        if (!kycCertificate) {
            throw new ApiError(404, 'KYC record not found for this user.');
        }
        kycCertificate.status = status;
        
        await kycCertificate.save();

        try {
            const userUpdateResult = await User.updateOne(
                { _id: userId },
                {
                    $set: {
                        'kyc.status': status, 
                        'kyc.verifiedAt': status === 'approved' ? new Date() : null,
                        'kyc.reviewedByAdminId': (status === 'approved' || status === 'rejected') && req.user && req.user._id ? req.user._id : null
                    }
                }
            );

            if (userUpdateResult.matchedCount === 0) {
                console.warn(`[setKycStatus] User ${userId} not found when attempting to update kyc.status in User model.`);
            }
        } catch (userUpdateError) {
            console.error(`[setKycStatus] Error silently updating user ${userId} kyc status:`, userUpdateError);
        }
        
        return res.status(200).json(
            new ApiResponse(200, kycCertificate, 'KYC status updated')
        );

    } catch (error) {
        
        console.error(`[setKycStatus] Error updating KYC status for user ${userId}:`, error);

        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(new ApiResponse(
                error.statusCode,
                null,
                error.message
            ));
        }

        return res.status(500).json(new ApiResponse(
            500,
            null,
            'Failed to update KYC status due to a server error.'
        ));
    }
  });

  const getKycStates = asyncHandler(async (req,res)=>{
    try {
      const result = await Kyc.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
  
      const statusCounts = result.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
  
      const total = Object.values(statusCounts).reduce((sum, val) => sum + val, 0);
  
      const responseData = {
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        rejected: statusCounts.rejected || 0,
        total
      };
  
      return res.status(200).json(
        new ApiResponse(200, responseData, 'KYC status counts fetched successfully')
      );
    } catch (error) {
      next(new ApiError(500, 'Failed to fetch KYC status counts'));
    }
  })

  const isKycSubmitted = asyncHandler(async (req, res) => {
    const { userId } = req.body;
  
    if (!userId) {
      throw new ApiError(400, 'userId is required to find KYC status');
    }
  
    // Find by stringed userId
    const kyc = await Kyc.findOne({ userId: String(userId) });
  
    // If no record, it's "unsubmitted"; otherwise take its status
    const status = kyc ? kyc.status : 'unsubmitted';
  
    return res
      .status(200)
      .json(new ApiResponse(200, status, 'KYC status fetched'));
  });

  const getWithdrawalRequests = asyncHandler(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;
    
    const [ totalDocs, docs ] = await Promise.all([
      withdrawRequest.countDocuments(),              
      withdrawRequest
        .find()
        .sort({ createdAt: -1 })                     
        .skip(skip)
        .limit(limit)
    ]);
    
    const totalPages = Math.ceil(totalDocs / limit);

    return res.status(200).json(
      new ApiResponse(200, {
        docs,       
        page,       
        limit,      
        totalDocs,   
        totalPages  
      }, 'withdrawal requests fetched successfully')
    );
  });

const setWithdrawalReqStatus = asyncHandler(async (req, res) => {
    const { withdrawaReqId, status } = req.body;

    if (!withdrawaReqId || !status) {
      throw new ApiError(400, 'withdrawaReqId and status are required');
    }
  
    const validStatuses = ['pending', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${validStatuses.join(', ')}`);
    }
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const request = await withdrawRequest
        .findById(withdrawaReqId)
        .session(session);
    
      if (!request) {
        throw new ApiError(404, 'Withdrawal request not found');
      }
    
      if (status === 'completed') {
        if (request.isApprovedOnce) {
          throw new ApiError(400, 'This withdrawal has already been approved');
        }
      
        const user = await User.findById(request.userId).session(session);
        if (!user) {
          throw new ApiError(404, 'User not found for this transaction');
        }

        const usdConversionRate = await getPriceInUSD(request.currency);
        if (!usdConversionRate || usdConversionRate <= 0) {
            throw new ApiError(500, 'Failed to get a valid conversion rate for the currency.');
        }

        const withdrawalAmountInUSD = request.amount * usdConversionRate;
        
        const newBalance = (user.accountBalance || 0) - withdrawalAmountInUSD;
      
        if (newBalance < 0) {
          throw new ApiError(400, 'Insufficient balance');
        }
      
        user.accountBalance = newBalance;
        await user.save({ session });

        await Transaction.create([{
          userId: user._id,
          amount: withdrawalAmountInUSD, 
          type: 'debit',
          description: `Withdrawal of ${request.amount} ${request.currency} to ${request.toAddress}`,
          referenceId: request._id,
          category: 'withdrawal',
          status: 'completed'
        }], { session });
        
        addUserNotification(user._id, 'Your withdrawal request has been approved');
      
        request.isApprovedOnce = true;
      }
    
      request.status    = status;
      request.updatedAt = Date.now();
      const updatedTransaction = await request.save({ session });
    
      await session.commitTransaction();
      session.endSession();
    
      res.status(200).json(
        new ApiResponse(200, updatedTransaction, 'Status updated successfully')
      );
    
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
});

  const getAdminDashboardStats = asyncHandler(async (req, res) => {
    const [
        totalUsers,
        totalAddFundRequests,
        totalWithdrawalRequests,
        totalPendingKyc,
        totalPendingLoanRequests 
    ] = await Promise.all([
        User.countDocuments(), 
        paymentRequest.countDocuments(), 
        withdrawRequest.countDocuments(), 
        Kyc.countDocuments({ status: 'pending' }), 
        Loan.countDocuments({ status: 'PendingApproval' }) 
    ]);

    // Calculate total transactions
    const totalTransactions = totalAddFundRequests + totalWithdrawalRequests;

    res.status(200).json(
        new ApiResponse(
            200,
            {
                totalUsers: totalUsers,
                totalTransactions: totalTransactions,
                totalPendingKyc: totalPendingKyc,
                totalLoanRequests: totalPendingLoanRequests
            },
            'Admin dashboard statistics fetched successfully.'
        )
    );
  });

  const sendNotificationToAll = asyncHandler(async (req,res)=>{
    const {notificationMessage} = req.body
    if(!notificationMessage){
      throw new ApiError(400 , 'you have to enter the notification message')
    }

    try {
      await User.updateMany({},{
        $push : {
          notification : {
            message : notificationMessage,
            isRead : false,
            createdAt : new Date(),
            isAnnouncement : true
          }
        }
      })
    } catch (err) {
    }
    
    return res
    .status(200)
    .json(
      new ApiResponse(200, `${notificationMessage} sent to all users` , 'Announcment successfully published')
    )
  })

  const sendNotificationToUser = asyncHandler(async (req,res)=>{
    const {notificationMessage, userId} = req.body
    if(!notificationMessage || !userId){
      throw new ApiError(400 , 'notification message and userId is a required field')
    }
    await addUserNotification(userId , notificationMessage)
    return res
    .status(200)
    .json(
      new ApiResponse(200 , `${notificationMessage} sent to ${userId}`)
    )
  })

  const getNotificationsAndDelete = asyncHandler(async (req, res) => {
      const { userId, notificationId } = req.body;

      if (!userId || !notificationId) {
        throw new ApiError(400, 'userId and notificationId are required to remove a notification');
      }
    
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
    
      // Filter out the notification by ID
      const originalLength = user.notification.length;
      user.notification = user.notification.filter(
        (notif) => notif._id.toString() !== notificationId.toString()
      );
    
      if (user.notification.length !== originalLength) {
        await user.save();
      }
    
      return res.status(200).json(
        new ApiResponse(200, { message: 'Removed the notification from the user (if it existed).' })
      );
  });

  const updateNotificationMessage = asyncHandler(async (req, res) => {
      const { userId, notificationId, updatedMessage } = req.body;

      // Validate inputs
      if (!userId || !notificationId || !updatedMessage) {
        throw new ApiError(400, 'userId, notificationId, and updatedMessage are required');
      }
    
      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }
    
      // Find the notification to update
      const notification = user.notification.find(
        (n) => n._id.toString() === notificationId.toString()
      );
    
      if (!notification) {
        throw new ApiError(404, 'Notification not found');
      }
    
      // Update the message
      notification.message = updatedMessage;
    
      // Save changes
      await user.save();
    
      // Return success response
      return res.status(200).json(
        new ApiResponse(200, {
          message: 'Notification updated successfully',
          updatedNotification: notification,
        })
      );
  });

  const getAnnouncements = asyncHandler(async (req,res)=>{
        const notifications = await User.aggregate([
        { $unwind: "$notification" },
        { $match: { "notification.isAnnouncement": true } },
        {
          $group: {
            _id: "$notification._id", // group by notification id
            message: { $first: "$notification.message" },
            isRead: { $first: "$notification.isRead" },
            createdAt: { $first: "$notification.createdAt" },
            isAnnouncement: { $first: "$notification.isAnnouncement" }
          }
        },
        { $project: { 
            _id: 1, 
            message: 1, 
            isRead: 1, 
            createdAt: 1, 
            isAnnouncement: 1 
          } 
        }
      ]);
    
      return res.status(200).json(
        new ApiResponse(200, notifications, "All unique announcement notifications")
      );
  })

  const updateAnnouncementForAll = asyncHandler(async (req, res) => {
      const { notificationId, updatedMessage } = req.body;

      if (!notificationId || !updatedMessage) {
        throw new ApiError(400, 'notificationId and updatedMessage are required');
      }
    
      // Update the message for all users who have this notification
      const result = await User.updateMany(
        { "notification._id": notificationId },
        { $set: { "notification.$.message": updatedMessage } }
      );
    
      return res.status(200).json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          'Announcement notification updated for all users'
        )
      );
  });

  const deleteAnnouncementForAll = asyncHandler(async (req, res) => {
      const { notificationId } = req.body;

      if (!notificationId) {
        throw new ApiError(400, 'notificationId is required');
      }
    
      // Remove the notification with this _id from all users
      const result = await User.updateMany(
        {},
        { $pull: { notification: { _id: notificationId } } }
      );
    
      return res.status(200).json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          'Announcement notification deleted for all users'
        )
      );
  });

  const updateAiRobotLimit = asyncHandler(async (req, res) => {
    const { userId, limit } = req.body;

    

    if (!userId || limit === undefined || limit === null) {
        throw new ApiError(400, 'User ID and limit are required fields.');
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid User ID format.');
    }

    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
        throw new ApiError(400, 'Limit must be a non-negative number.');
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found.');
    }

    user.robotLimit = parsedLimit;
    await user.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            { userId: user._id, newRobotLimit: user.robotLimit },
            `AI Robot limit updated successfully for user ${user._id}. New limit: ${user.robotLimit}.`
        )
    );
  });

  const adminGetUserLoanHistory = asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        throw new ApiError(400, 'userId is required in the request body.');
    }
    const userLoans = await Loan.find({ userId: userId })
        .sort({ loanDate: -1 }) 
        .lean(); 
    res.status(200).json(
        new ApiResponse(200, { loans: userLoans }, `Loan history for user ${userId} fetched successfully.`)
    );
  });

  const loanLists = asyncHandler(async (req,res)=>{
    const allLoans = await Loan.find()
    res.status(200).json(
      new ApiResponse(200 , allLoans)
    )
  })

  const setLoanStatus = asyncHandler(async (req, res) => {
    const { loanId, status } = req.body; 
    
    if (!loanId || !status) {
        throw new ApiError(400, 'loanId and status are required.');
    }
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw new ApiError(400, 'Invalid Loan ID format.');
    }

    const allowedStatuses = ['PendingApproval', 'Approved', 'Repaid', 'Defaulted', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, `Unsupported status. Allowed values are: ${allowedStatuses.join(', ')}.`);
    }

    // 2. Find the loan
    const loan = await Loan.findById(loanId);
    if (!loan) {
        throw new ApiError(404, 'Loan not found.');
    }

    // 3. Prevent changing status from already final states or invalid transitions
    if (['Repaid', 'Defaulted', 'Rejected'].includes(loan.status)) {
        throw new ApiError(400, `Cannot change status from ${loan.status}. Loan is already in a final state.`);
    }
    // Prevent re-approving or rejecting an already approved loan
    if (loan.status === 'Approved' && (status === 'Approved' || status === 'Rejected')) {
        throw new ApiError(400, `Loan is already Approved. Cannot change to ${status}.`);
    }

    // 4. Logic for Approving a pending loan
    if (status === 'Approved' && loan.status === 'PendingApproval') {
        const user = await User.findById(loan.userId);

        if (!user) {
            console.error(`[setLoanStatus] CRITICAL: User ${loan.userId} not found for loan ${loan._id} during approval.`);
            throw new ApiError(500, 'User associated with loan not found.');
        }

        // --- Disbursement of Funds ---
        // Add principal loan amount to user's accountBalance (available funds)
        user.accountBalance += loan.loanAmount;
        user.loanBalance += loan.loanAmount;

        try {
            await user.save();
            addUserNotification(user._id , `Your loan request of ${loan.loanAmount} is now ${status}`)
            await Transaction.create({
              userId: user._id,
              amount: loan.loanAmount,
              type: 'credit', 
              description: 'Loan disbursement',
              referenceId: loan._id,
              category: 'loan',
              status: 'completed'
            });
        
        } catch (err) {
            console.error(`[setLoanStatus] Failed to update wallet balances for user ${user._id} during approval of loan ${loan._id}:`, err);
            throw new ApiError(500, 'Failed to update user balances. Please try again.');
        }

       
        loan.status = 'Approved';
        loan.approvalDate = new Date(); 
        const dueDate = new Date(loan.approvalDate);
        dueDate.setUTCHours(dueDate.getUTCHours() + (loan.loanTermDays * 24)); 
        loan.dueDate = dueDate;

        
        loan.lastInterestAccrualDate = loan.approvalDate; 
        loan.lastOverdueChargeDate = loan.approvalDate; 
        

    } else if (status === 'Rejected' && loan.status === 'PendingApproval') {
       
        loan.status = 'Rejected';
    }
    
    else {
        loan.status = status;
        loan.adminNotes = `Status manually changed to ${status} by admin: ${req.user.firstName} ${req.user.lastName} (ID: ${req.user._id}).`;
    }

    // 5. Save the updated loan document
    try {
        await loan.save();
    } catch (err) {
        console.error(`[setLoanStatus] Failed to save loan status for ${loan._id}:`, err);
        // CRITICAL: If loan was approved, user balances might be updated but loan status NOT.
        // This needs manual intervention or a more robust transaction/rollback.
        throw new ApiError(500, 'Failed to update loan status. Please contact support.');
    }

    // 6. Send Success Response
    res.status(200).json(
        new ApiResponse(200, { loanId: loan._id, newStatus: loan.status }, `Loan status updated to ${status}.`)
    );
  });

  const setLoanTermRate = asyncHandler(async (req, res) => {
    const { durationDays, dailyRate } = req.body;

    // 1. Basic Input Validation
    if (durationDays === undefined || durationDays === null || dailyRate === undefined || dailyRate === null) {
        throw new ApiError(400, 'Both durationDays and dailyRate are required.');
    }

    const parsedDurationDays = parseInt(durationDays, 10);
    const parsedDailyRate = parseFloat(dailyRate);

    if (isNaN(parsedDurationDays) || parsedDurationDays <= 0) {
        throw new ApiError(400, 'durationDays must be a positive integer.');
    }
    if (isNaN(parsedDailyRate) || parsedDailyRate < 0) {
        throw new ApiError(400, 'dailyRate must be a non-negative number.');
    }

    // Define allowed loan durations based on your requirements
    const allowedDurations = [3, 7, 15, 30, 60, 90];
    if (!allowedDurations.includes(parsedDurationDays)) {
        throw new ApiError(400, `Invalid durationDays. Allowed values are: ${allowedDurations.join(', ')}.`);
    }

    // 2. Find the siteSettings singleton document
    let settings = await siteSettings.findOne({});

    // If no settings document exists, create a basic one.
    if (!settings) {
        settings = await siteSettings.create({
            siteName: 'Default Site', 
            loanTermRates: [] 
        });
    }

    // 3. Update or Add the loanTermRate
    const existingIndex = settings.loanTermRates.findIndex(
        (term) => term.durationDays === parsedDurationDays
    );

    if (existingIndex !== -1) {
        settings.loanTermRates[existingIndex].dailyRate = parsedDailyRate;
    } else {
        settings.loanTermRates.push({
            durationDays: parsedDurationDays,
            dailyRate: parsedDailyRate,
        });
        settings.loanTermRates.sort((a, b) => a.durationDays - b.durationDays);
    }

    await settings.save();

    // 5. Send Success Response
    return res.status(200).json(
        new ApiResponse(
            200,
            settings.loanTermRates, 
            `Loan term rate for ${parsedDurationDays} days updated/set successfully.`
        )
    );
  });

  const updateUserLoanLimit = asyncHandler(async (req, res) => {
    const { userId, limit } = req.body || {};

    // 1. Validate input presence
    if (!userId || limit === undefined || limit === null) {
        throw new ApiError(400, 'User ID and limit are required fields.');
    }

    // 2. Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid User ID format.');
    }

    // 3. Parse and validate the limit value
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 0) { 
        throw new ApiError(400, 'Loan limit must be a non-negative number.');
    }

    // 4. Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found.');
    }

    // 5. Update the user's loanLimit field
    user.loanLimit = parsedLimit;
    await user.save(); 

    // 6. Send success response
    return res.status(200).json(
        new ApiResponse(
            200,
            { userId: user._id, newLoanLimit: user.loanLimit }, 
            `Loan limit updated successfully for user ${user._id}. New limit: ${user.loanLimit}.`
        )
    );
  });

  const listRepaymentRequests = asyncHandler(async (req, res) => {
    // Pagination and Filtering options
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const statusFilter = req.query.status || 'Pending';
    const search = req.query.search?.trim(); 

    if (page < 1) throw new ApiError(400, 'Page must be a positive integer');
    if (limit < 1 || limit > 100) throw new ApiError(400, 'Limit must be between 1 and 100');

    const skip = (page - 1) * limit;
    const query = {};

    // Filter by status if provided and valid
    const allowedStatuses = ['Pending', 'Approved', 'Rejected'];
    if (statusFilter && allowedStatuses.includes(statusFilter)) {
        query.status = statusFilter;
    } else if (statusFilter && statusFilter !== 'All') { 
         throw new ApiError(400, `Invalid status filter. Allowed: ${allowedStatuses.join(', ')} or 'All'.`);
    }
  
    // search
    let userIdsFromSearch = [];
    if (search) {
        const users = await User.find({
            $or: [
                { email: new RegExp(search, 'i') },
                { firstName: new RegExp(search, 'i') },
                { lastName: new RegExp(search, 'i') }
            ]
        }).select('_id').lean();

        userIdsFromSearch = users.map(user => user._id);
        if (userIdsFromSearch.length > 0) {
            query.userId = { $in: userIdsFromSearch };
        } else {
            return res.status(200).json(new ApiResponse(
                200,
                { total: 0, page, limit, lastPage: 0, hasMore: false, requests: [] },
                'No repayment requests found matching search criteria.'
            ));
        }
    }

    const [total, requests] = await Promise.all([
        LoanRepaymentRequest.countDocuments(query),
        LoanRepaymentRequest.find(query)
            .sort({ requestDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'firstName lastName email dpLocalPath')
            .populate('loanId', 'loanAmount loanTermDays dailyInterestRate status outstandingPrincipal accruedInterest overdueInterestAccrued latePaymentFeesAccrued dueDate')
            .lean()
    ]);

    const lastPage = Math.ceil(total / limit);

    // Map the results to format them nicely for the response
    const formattedRequests = requests.map(req => ({
        _id: req._id,
        userId: req.userId._id,
        userName: `${req.userId.firstName} ${req.userId.lastName}`,
        userEmail: req.userId.email,
        userProfile: req.userId.dpLocalPath,
        loanId: req.loanId._id,
        requestedAmount: req.amount,
        requestDate: req.requestDate,
        status: req.status,
        loanDetails: {
            loanAmount: req.loanId.loanAmount,
            loanTermDays: req.loanId.loanTermDays,
            dailyInterestRate: req.loanId.dailyInterestRate,
            loanStatus: req.loanId.status, // Current status of the actual loan
            outstandingPrincipal: req.loanId.outstandingPrincipal,
            accruedInterest: req.loanId.accruedInterest,
            overdueInterestAccrued: req.loanId.overdueInterestAccrued,
            latePaymentFeesAccrued: req.loanId.latePaymentFeesAccrued,
            dueDate: req.loanId.dueDate,
        },
        approvalDate: req.approvalDate,
        rejectedDate: req.rejectedDate,
        adminNotes: req.adminNotes
    }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                total,
                page,
                limit,
                lastPage,
                hasMore: page < lastPage,
                requests: formattedRequests
            },
            'Loan repayment requests fetched successfully'
        )
    );
  });

  const approveRepaymentRequest = asyncHandler(async (req, res) => {
    const { repaymentRequestId, adminNotes } = req.body;

    // 1. Validate input
    if (!repaymentRequestId) {
        throw new ApiError(400, 'Repayment request ID is required.');
    }
    if (!mongoose.Types.ObjectId.isValid(repaymentRequestId)) {
        throw new ApiError(400, 'Invalid Repayment Request ID format.');
    }

    const session = await mongoose.startSession();
    session.startTransaction(); 

    try {
        const repaymentRequest = await LoanRepaymentRequest.findById(repaymentRequestId).session(session);

        if (!repaymentRequest) {
            throw new ApiError(404, 'Repayment request not found.');
        }
        if (repaymentRequest.status !== 'Pending') {
            throw new ApiError(400, `Repayment request status is ${repaymentRequest.status}. Only Pending requests can be approved.`);
        }

        const [loan, user] = await Promise.all([
            Loan.findById(repaymentRequest.loanId).session(session),
            User.findById(repaymentRequest.userId).session(session)
        ]);

        if (!loan) {
            throw new ApiError(404, 'Associated loan not found.');
        }
        if (!user) {
            throw new ApiError(404, 'Associated user not found.');
        }

        // 2. Perform balance checks and updates
        const repaymentAmount = repaymentRequest.amount;

        if (user.accountBalance < repaymentAmount) {
            throw new ApiError(400, 'User has insufficient balance to cover the requested repayment amount.');
        }

        // --- Update User Balances ---
        user.accountBalance -= repaymentAmount;
        user.loanBalance -= repaymentAmount; 
        await user.save({ session });

        await Transaction.create([{
          userId: user._id,
          amount: repaymentAmount,
          type: 'debit', 
          description: `Loan repayment for loan ${loan._id}`,
          referenceId: repaymentRequest._id,
          category: 'repayment',
          status: 'completed'
        }], { session });

        let remainingAmount = repaymentAmount;

        // Apply to late fees first
        if (loan.latePaymentFeesAccrued > 0 && remainingAmount > 0) {
            const amountToPay = Math.min(remainingAmount, loan.latePaymentFeesAccrued);
            loan.latePaymentFeesAccrued -= amountToPay;
            remainingAmount -= amountToPay;
        }

        // Then overdue interest
        if (loan.overdueInterestAccrued > 0 && remainingAmount > 0) {
            const amountToPay = Math.min(remainingAmount, loan.overdueInterestAccrued);
            loan.overdueInterestAccrued -= amountToPay;
            remainingAmount -= amountToPay;
        }

        // Then regular accrued interest
        if (loan.accruedInterest > 0 && remainingAmount > 0) {
            const amountToPay = Math.min(remainingAmount, loan.accruedInterest);
            loan.accruedInterest -= amountToPay;
            remainingAmount -= amountToPay;
        }

        // Finally, principal
        if (loan.outstandingPrincipal > 0 && remainingAmount > 0) {
            const amountToPay = Math.min(remainingAmount, loan.outstandingPrincipal);
            loan.outstandingPrincipal -= amountToPay;
            remainingAmount -= amountToPay;
        }

        // Update total amount repaid for the loan
        loan.amountRepaid += repaymentAmount;

        // Add to repayment history
        loan.repaymentHistory.push({
            amount: repaymentAmount,
            date: new Date(),
            type: 'partial', 
            recordedBy: 'admin'
        });

        // Determine if loan is fully repaid
        const isFullyRepaid =
            loan.outstandingPrincipal <= 0.0001 && 
            loan.accruedInterest <= 0.0001 &&
            loan.overdueInterestAccrued <= 0.0001 &&
            loan.latePaymentFeesAccrued <= 0.0001;

        if (isFullyRepaid) {
            loan.status = 'Repaid';
            loan.repaidDate = new Date();
            user.loanBalance = Math.max(0, user.loanBalance - repaymentAmount);
        }

        await loan.save({ session });

        // 3. Update LoanRepaymentRequest status
        repaymentRequest.status = 'Approved';
        repaymentRequest.approvalDate = new Date();
        repaymentRequest.adminNotes = adminNotes || 'Approved by admin.';
        await repaymentRequest.save({ session });

        await session.commitTransaction(); 
        session.endSession();

        // 4. Send Success Response
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    repaymentRequest: repaymentRequest._id,
                    loanStatus: loan.status,
                    userAccountBalance: user.accountBalance,
                    userLoanBalance: user.loanBalance
                },
                `Repayment request ${repaymentRequestId} approved successfully. Loan status: ${loan.status}.`
            )
        );

    } catch (error) {
        await session.abortTransaction(); 
        session.endSession();
        console.error(`[approveRepaymentRequest] Error approving repayment request ${repaymentRequestId}:`, error);
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(new ApiResponse(
                error.statusCode,
                null,
                error.message
            ));
        }
        return res.status(500).json(new ApiResponse(
            500,
            null,
            error.message || 'Failed to approve repayment request due to an unexpected server error.'
        ));
    }
  });
  
  const rejectRepaymentRequest = asyncHandler(async (req, res) => {
    const { repaymentRequestId, adminNotes } = req.body;

    // 1. Validate input
    if (!repaymentRequestId) {
        throw new ApiError(400, 'Repayment request ID is required.');
    }
    if (!mongoose.Types.ObjectId.isValid(repaymentRequestId)) {
        throw new ApiError(400, 'Invalid Repayment Request ID format.');
    }

    const repaymentRequest = await LoanRepaymentRequest.findById(repaymentRequestId);

    if (!repaymentRequest) {
        throw new ApiError(404, 'Repayment request not found.');
    }
    if (repaymentRequest.status !== 'Pending') {
        throw new ApiError(400, `Repayment request status is ${repaymentRequest.status}. Only Pending requests can be rejected.`);
    }

    // 2. Update status to Rejected
    repaymentRequest.status = 'Rejected';
    repaymentRequest.rejectedDate = new Date();
    repaymentRequest.adminNotes = adminNotes || 'Rejected by admin.';
    await repaymentRequest.save();

    // 3. Send Success Response
    return res.status(200).json(
        new ApiResponse(
            200,
            { repaymentRequest: repaymentRequest._id, status: repaymentRequest.status },
            `Repayment request ${repaymentRequestId} rejected successfully.`
        )
    );
  });

  const getLoanDetailsById = asyncHandler(async (req, res) => {
    const { loanId } = req.params;

    // 1. Validate Loan ID
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw new ApiError(400, 'Invalid Loan ID format.');
    }

    // 2. Find the loan and populate related user data
    const loan = await Loan.findById(loanId)
        .populate('userId', 'firstName lastName email phoneNumber dpLocalPath') 
        .lean();

    if (!loan) {
        throw new ApiError(404, 'Loan not found.');
    }

    // 3. Structure the response for clarity in the admin panel
    const formattedLoanDetails = {
        _id: loan._id,
        loanAmount: loan.loanAmount,
        outstandingPrincipal: loan.outstandingPrincipal,
        loanTermDays: loan.loanTermDays,
        dailyInterestRate: loan.dailyInterestRate,
        accruedInterest: loan.accruedInterest,
        overdueInterestAccrued: loan.overdueInterestAccrued,
        latePaymentFeesAccrued: loan.latePaymentFeesAccrued,
        loanDate: loan.loanDate,
        approvalDate: loan.approvalDate,
        dueDate: loan.dueDate,
        status: loan.status,
        amountRepaid: loan.amountRepaid,
        repaidDate: loan.repaidDate,
        repaymentHistory: loan.repaymentHistory,
        disableInterestAccrual: loan.disableInterestAccrual,
        disableLateFeesAccrual: loan.disableLateFeesAccrual,
        lastInterestAccrualDate: loan.lastInterestAccrualDate,
        lastOverdueChargeDate: loan.lastOverdueChargeDate,
        adminNotes: loan.adminNotes,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
        user: loan.userId ? {
            _id: loan.userId._id,
            firstName: loan.userId.firstName,
            lastName: loan.userId.lastName,
            email: loan.userId.email,
            phoneNumber: loan.userId.phoneNumber,
            profilePicture: loan.userId.dpLocalPath
        } : null
    };

    // 4. Send Success Response
    return res.status(200).json(
        new ApiResponse(
            200,
            formattedLoanDetails,
            'Loan details fetched successfully.'
        )
    );
  });

  const updateLoanSettings = asyncHandler(async (req, res) => {
      const { loanId } = req.params; 
      const {
          disableInterestAccrual,
          disableLateFeesAccrual,
          loanTermDays,
          adminNotes
      } = req.body; 

      // 1. Validate Loan ID
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
          throw new ApiError(400, 'Invalid Loan ID format.');
      }

      // 2. Find the loan
      const loan = await Loan.findById(loanId);

      if (!loan) {
          throw new ApiError(404, 'Loan not found.');
      }

      let loanModified = false;

      // 3. Apply updates if provided in the request body
      if (disableInterestAccrual !== undefined) {
          loan.disableInterestAccrual = disableInterestAccrual;
          loanModified = true;
      }

      if (disableLateFeesAccrual !== undefined) {
          loan.disableLateFeesAccrual = disableLateFeesAccrual;
          loanModified = true;
      }
      // Update loanTermDays and recalculate dueDate if changed and valid
      if (loanTermDays !== undefined) {
          const parsedLoanTermDays = parseInt(loanTermDays, 10);
          if (isNaN(parsedLoanTermDays) || parsedLoanTermDays <= 0) {
              throw new ApiError(400, 'Loan term days must be a positive integer.');
          }
          if (loan.loanTermDays !== parsedLoanTermDays) { 
              loan.loanTermDays = parsedLoanTermDays;
             
              if (loan.approvalDate) {
                  loan.dueDate = new Date(loan.approvalDate.getTime() + parsedLoanTermDays * 24 * 60 * 60 * 1000);
              }
              loanModified = true;
          }
      }

      if (adminNotes !== undefined) {
          loan.adminNotes = adminNotes;
          loanModified = true;
      }

      // 4. Save the updated loan if any modifications were made
      if (loanModified) {
          await loan.save();
      } else {
          return res.status(200).json(
              new ApiResponse(200, null, 'No changes detected for loan settings.')
          );
      }

      // 5. Send Success Response with updated loan details
      return res.status(200).json(
          new ApiResponse(
              200,
              {
                  _id: loan._id,
                  disableInterestAccrual: loan.disableInterestAccrual,
                  disableLateFeesAccrual: loan.disableLateFeesAccrual,
                  loanTermDays: loan.loanTermDays,
                  dueDate: loan.dueDate,
                  adminNotes: loan.adminNotes,
                  updatedAt: loan.updatedAt 
              },
              'Loan settings updated successfully.'
          )
      );
  });

  const setOptionTradeOutcome = asyncHandler(async (req, res) => {
    const { tradeId } = req.params; 
    const { outcome } = req.body;  
   

    // 1. Validate inputs
    if (!tradeId) {
        throw new ApiError(400, 'Trade ID is required.');
    }
    if (!['Profit', 'Loss', 'Default'].includes(outcome)) {
        throw new ApiError(400, 'Invalid outcome specified. Must be "Profit", "Loss", or "Default".');
    }

    // 2. Find the trade and ensure it's active
    const trade = await UserOptionTrade.findById(tradeId);

    if (!trade) {
        throw new ApiError(404, 'Option trade not found.');
    }
    if (trade.status !== 'Active') {
        throw new ApiError(400, `Trade is already ${trade.status} and cannot be modified.`);
    }

    trade.adminControlledOutcome = outcome;
   
    await trade.save();

    res.status(200).json(new ApiResponse(
        200,
        { tradeId: trade._id, adminControlledOutcome: outcome },
        `Option trade ${tradeId} outcome set to "${outcome}" successfully.`
    ));
  });


  

export { adminGetUserLoanHistory, approveRepaymentRequest, deleteAnnouncementForAll, deleteNote, getAdminDashboardStats, getAnnouncements, getKycStates, getKycSubmissions, getLoanDetailsById, getNotificationsAndDelete, getSiteSettings, getSupportedCurrencies, getUser, getWithdrawalRequests, isKycSubmitted, listFundRequests, listRepaymentRequests, listUsers, loanLists, rejectRepaymentRequest, sendNotificationToAll, sendNotificationToUser, setFundStatus, setKycStatus, setLoanStatus, setLoanTermRate, setOptionTradeOutcome, setWalletAddress, setWithdrawalCurrencies, setWithdrawalFee, setWithdrawalReqStatus, updateAiRobotLimit, updateAnnouncementForAll, updateLoanSettings, updateNotificationMessage, updateUser, updateUserLoanLimit };

