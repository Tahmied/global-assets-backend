import fs from 'fs';
import mongoose from 'mongoose';
import { AIRobotPackage } from '../models/aiBots.model.js';
import { AIRobotInvestmentOrder } from '../models/AIRobotInvestmentOrder.model.js';
import { Kyc } from '../models/kyc.model.js';
import { Loan } from '../models/loan.model.js';
import { LoanRepaymentRequest } from '../models/LoanRepaymentRequest.model.js';
import { Otp } from "../models/otp.model.js";
import { siteSettings } from '../models/siteSettings.model.js';
import { Transaction } from '../models/transaction.model.js';
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail } from "../utils/email.js";

async function generateAccessAndRefreshToken(userId) { 
  try {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    // Generate tokens (sync)
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Atomic update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { refreshToken } },
      { new: true, validateBeforeSave: false }
    );

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(500, `Token generation failed: ${err.message}`);
  }
}

async function addUserNotification(userId, message) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(` User ${userId} not found when trying to add notification.`);
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

async function createRepaymentRequest(userId, loanId, amount) { 
    // 1. Validate input presence and format
    if (!loanId || amount === undefined || amount === null) {
        throw new Error('Loan ID and amount are required for repayment request.');
    }
    if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw new Error('Invalid Loan ID format.');
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Repayment amount must be a positive number.');
    }

    // 2. Find the Loan and User concurrently
    const [loan, user] = await Promise.all([
        Loan.findById(loanId),
        User.findById(userId)
    ]);

    if (!loan) {
        throw new Error('Loan not found.');
    }
    if (!user) {
        throw new Error('User not found.');
    }

    // 3. Check if the loan belongs to the user
    if (loan.userId.toString() !== userId.toString()) {
        throw new Error('Unauthorized: Loan does not belong to this user.');
    }

    // 4. Check if loan status allows repayment requests
    if (!['Approved', 'Defaulted'].includes(loan.status)) {
        throw new Error(`Cannot request repayment for a loan with status: ${loan.status}. Loan must be Approved or Defaulted.`);
    }

    // 5. Check if user has sufficient AVAILABLE balance for the request
    if (user.accountBalance < parsedAmount) {
        throw new Error('Insufficient available balance to submit this repayment request.');
    }

    // 6. Create the new LoanRepaymentRequest document
    const newRepaymentRequest = await LoanRepaymentRequest.create({
        userId: userId,
        loanId: loanId,
        amount: parsedAmount,
        requestDate: new Date(),
        status: 'Pending' // Always starts as pending
    });

    return newRepaymentRequest; // Return the created document
}

// authentication

const registerUser = asyncHandler(async (req, res) => {
    const { email, firstName, lastName, password, agreedToTerms, otp , country, state} = req.body;
    if ([email, firstName, lastName, password, agreedToTerms, otp, country, state].some(e => !e)) {
      throw new ApiError(400, 'All fields are required for registration');
    }
  
    // 1. Verify OTP first
    const record = await Otp.findOne({ email });
    if (!record || record.code !== otp || record.expiresAt < new Date()) {
      throw new ApiError(400, 'Invalid or expired OTP');
    }
    await Otp.deleteOne({ email });
  
    // 2. Prevent duplicates
    if (await User.findOne({ email })) {
      throw new ApiError(409, 'User already exists');
    }
  
    // 3. Ensure file uploaded
   const dpLocalPath = 'public/Images/default-profilepic.png';

    const trxPassword = undefined
  
    // 4. Create user — cleanup file on error
    let newUser;
    try {
      newUser = await User.create({
        firstName,
        lastName,
        password,
        email,
        agreedToTerms,
        dpLocalPath, trxPassword, country, state, accountBalance:1000000
      });
    } catch (err) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw err;
    }
  
    // 5. Return user (sans sensitive fields)
    const createdUser = await User.findById(newUser._id)
      .select('-password -refreshToken');
    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, 'User registration successful'));
});

const sendOtp = asyncHandler(async (req,res)=>{
    // get the email and validate
    const {email} = req.body
    if(!email) {
        throw new ApiError(400 , 'email is a required field')
    }
    // generate the otp code and expiry
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5*60*1000)
    console.log(code)
    await Otp.findOneAndUpdate(
        {email} ,
        {code , expiresAt , createdAt:new Date()},
        {upsert:true , new:true}
    )
    // send the email
    await sendEmail({
        to : email,
        subject : 'Verification code for global assets',
        text : `your OTP is ${code}, it will expire withing 5 minutes`
    })
    // respond
    return res
    .status(200)
    .json(
        new ApiResponse(200 , {message : `otp sent`} ,'otp sent successfully')
    )
})

const verifyOtp = asyncHandler(async (req,res) => {
    // get the email and otp and validate them
    const {email , otp} = req.body
    if([email , otp].some((e)=>!e)){
        throw new ApiError(400 , 'email and otp are required fields')
    }
    // validate the email from otp collection
    const record = await Otp.findOne({email})
    if(!record){
        throw new ApiError(400 , 'no otp found for this email')
    }
    // compare the otp and check expiry
    if(record.code !== otp || record.expiresAt < new Date()){
        throw new ApiError(400 , 'invalid otp or expired otp')
    }
    
    // response
    return res
    .status(200)
    .json(
        new ApiResponse(200 , {message : 'otp is correct'} , 'otp verified successfully')
    )
    
})

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify password
  const isPasswordValid = await user.isPassCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check account lock status
  if (user.isLocked) {
    throw new ApiError(403, 'Account is locked. Contact support');
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  // Get updated user data
  const updatedUser = await User.findById(user._id).select('-password -trxPassword -refreshToken');

  // Set cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' // Works in dev if using HTTPS
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(200, 
        {
          user: updatedUser,
          accessToken, // Optional: Only if you want to return in response body
          refreshToken
        }, 
        'Login successful'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(400, 'Unable to find the user from tokens');
  }

user.refreshToken = undefined;
await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' // optional but good for CSRF protection
  };

  return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(
      new ApiResponse(200, { message: 'User logged out' }, 'User logout successfully')
    );
});

const forgotPass = asyncHandler(async (req, res) => {
  const { email, password, otp } = req.body;

  // Validate required fields
  if (!email || !password || !otp) {
    throw new ApiError(400, 'Email, new password, and OTP are required');
  }

  // Validate OTP
  const record = await Otp.findOne({ email });
  if (!record || record.code !== otp || record.expiresAt < new Date()) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  // Delete OTP after use
  await Otp.deleteOne({ email });

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  // Update password
  user.password = password;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, { message: "Password updated" }, 'Password updated successfully')
  );
});

const loginCheck = asyncHandler(async (req,res)=>{
  const user = req.user;
  if (!user) {
    throw new ApiError(400, 'Unable to find the user from tokens');
  }
  return res.status(200).json(new ApiResponse(200 , '' , 'user is logged in'))
})

// user profile

const profile = asyncHandler(async (req,res)=>{
  // find the user
  const user =  req.user
  if(!user){
    throw new ApiError(400 , 'unable to find the user')
  }
  // get the details
  const {firstName , lastName, email , _id , notification, dpLocalPath , accountBalance , loanBalance , contracts , isLocked , kyc, vipStatus, creditScore } = user
  const profileDetails = { firstName, lastName, email , _id, notification, dpLocalPath, accountBalance, loanBalance, contracts , isLocked , kyc, vipStatus, creditScore
  }
  // send the response
  return res
  .status(200)
  .json(
    new ApiResponse(200 , profileDetails, 'Profile details fetched successfully' )
  )
})

const updateProfile = asyncHandler(async (req, res) => {
  const user = await req.user;
  
  if (!user) {
    throw new ApiError(400, 'Unable to find the user');
  }

  const { firstName, lastName, password, email } = req.body;

  if (firstName) {
    user.firstName = firstName.trim();
  }

  if (lastName) {
    user.lastName = lastName.trim();
  }

  if (password) {
    user.password = password; 
  }

  if(email) {
    user.email = email
  }

  const dpLocalPath = req.file?.path;
  if (dpLocalPath) {
    user.dpLocalPath = dpLocalPath
    await user.save()
  }

  await user.save();

  return res.status(200).json(
    new ApiResponse(200, user, 'Changes updated successfully')
  );
});

const setTransactionPassword = asyncHandler(async (req, res) => {
  const { trxPass } = req.body;

  // Validate
  if (!trxPass || typeof trxPass !== 'string' || trxPass.length < 6) {
    throw new ApiError(400, 'Transaction password must be at least 6 characters.');
  }

  const userId = req.user._id;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  // Check if already set
  if (user.trxPassword) {
    return res.status(400).json(
      new ApiResponse(
        400,
        { message: 'You can set transaction password only once, please contact customer support for updating the transaction password.' },
        'Transaction password already set, please contact customer support for updating the transaction password'
      )
    );
  }

  // Set & save (pre-save hook will hash it)
  user.trxPassword = trxPass;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, { message: 'Transaction password set successfully.' }, 'Transaction password set successfully')
  );
});

const checkTrxPass = asyncHandler(async (req,res)=>{
  const { trxPass } = req.body
  const user = await req.user
  if(!trxPass || !user){
    throw new ApiError(400 , 'trx password is a required field or user isn\'t logged in')
  }
  const chekTrxPass = await user.isTrxPassCorrect(trxPass)
  if(!chekTrxPass){
    throw new ApiError(400 , 'transaction password is wrong')
  }
  const data = {
    'message' : "transaction password is correct"
  }
  return res.status(200).json(
    new ApiResponse(200 , data, 'transaction password is correct')
  )
})

// kyc verification
const submitKyc = asyncHandler(async (req, res) => {
    const user = req.user; 
    if (!user || !user._id) {
        throw new ApiError(401, 'Unable to authenticate user.');
    }

    const frontFile = req.files?.docFront?.[0]?.path;
    const backFile = req.files?.docsBack?.[0]?.path;
    if (!frontFile || !backFile) {
        throw new ApiError(400, 'Front and back images of the document are required.');
    }

    const {
        country,
        address,
        monthlyIncome,
        expectedInvestment,
        dateOfBirth,
        idType
    } = req.body;

    if ([country, address, monthlyIncome, expectedInvestment, dateOfBirth, idType]
        .some(field => !field)
    ) {
        fs.unlinkSync(frontFile);
        fs.unlinkSync(backFile);
        throw new ApiError(400, 'All fields are required.');
    }

    let kycRecord;
    try {
        kycRecord = await Kyc.create({
            userId: user._id,
            fullName: `${user.firstName} ${user.lastName}`,
            country,
            address,
            monthlyIncome,
            expectedInvestment,
            dateOfBirth: new Date(dateOfBirth),
            idType,
            idFrontImage: frontFile,
            idBackImage: backFile,
            status: 'pending'
        });
    } catch (err) {
        fs.unlinkSync(frontFile);
        fs.unlinkSync(backFile);
        console.error('[submitKyc] Error creating KYC record:', err);
        throw new ApiError(500, 'Failed to create KYC record. Please try again.');
    }

    try {
        
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            {
                $set: {
                    'kyc.status': 'pending', 
                    'kyc.documentType': idType, 
                    'kyc.submittedAt': new Date() 
                }
            },
            { new: true, runValidators: true } 
        );

        if (!updatedUser) {
            console.error(`[submitKyc] CRITICAL: KYC record ${kycRecord._id} created, but failed to update user ${user._id} kyc status.`);
        }
    } catch (userUpdateError) {
        console.error(`[submitKyc] Error updating user ${user._id} kyc status after submission:`, userUpdateError);
    }

    return res
        .status(201)
        .json(new ApiResponse(201, kycRecord, 'KYC submitted successfully. Status set to pending.'));
});

// loan

const submitLoan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    
    const userProfile = req.user.dpLocalPath;
    const userFullName = `${req.user.firstName} ${req.user.lastName}`;

    const { loanAmount, loanTermDays } = req.body;

    // 1. Validate basic input presence and format
    if (loanAmount === undefined || loanAmount === null || loanTermDays === undefined || loanTermDays === null) {
        throw new ApiError(400, 'Loan amount and loan term days are required.');
    }

    const parsedLoanAmount = parseFloat(loanAmount);
    const parsedLoanTermDays = parseInt(loanTermDays, 10);

    if (isNaN(parsedLoanAmount) || parsedLoanAmount <= 0) {
        throw new ApiError(400, 'Invalid loan amount. Must be a positive number.');
    }
    if (isNaN(parsedLoanTermDays) || parsedLoanTermDays <= 0) {
        throw new ApiError(400, 'Invalid loan term days. Must be a positive integer.');
    }

    // 2. Fetch User and Site Settings concurrently for efficiency
    const [user, settings] = await Promise.all([
        User.findById(userId),
        siteSettings.findOne({})
    ]);

    if (!user) {
        throw new ApiError(404, 'User not found.');
    }
    // Check if loan terms are configured by the admin
    if (!settings || !settings.loanTermRates || settings.loanTermRates.length === 0) {
        throw new ApiError(500, 'Loan service is currently unavailable. Loan terms not configured by admin.');
    }

    // 3. Determine the specific dailyInterestRate for this loan term
    const loanTermConfig = settings.loanTermRates.find(
        (config) => config.durationDays === parsedLoanTermDays
    );

    if (!loanTermConfig) {
        throw new ApiError(400, `Loan term of ${parsedLoanTermDays} days is not available or configured by admin.`);
    }
    const dailyInterestRateForThisLoan = loanTermConfig.dailyRate;

    // 4. Calculate Effective Loan Limit for the user
    const effectiveLoanLimit = user.loanLimit > 0
        ? user.loanLimit
        : (user.accountBalance * 0.20); 

    // 5. Perform Loan Limit Check
    const currentOutstandingLoans = await Loan.find({
        userId: userId,
        status: { $in: ['PendingApproval', 'Approved'] }
    }).select('outstandingPrincipal').lean(); 

    const currentOutstandingPrincipalSum = currentOutstandingLoans.reduce(
        (sum, loan) => sum + loan.outstandingPrincipal,
        0
    );

    if ((currentOutstandingPrincipalSum + parsedLoanAmount) > effectiveLoanLimit) {
    return res.status(400).json(new ApiResponse(
        400,
        null,
        `Your total outstanding loan principal would exceed your limit of ${effectiveLoanLimit.toFixed(2)} USD.`
    ));
}

    // 6. Create the new Loan document with all initial fields
    try {
        const newLoan = await Loan.create({
            userId: userId,
            userFullName: userFullName,
            userProfile: userProfile,
            loanAmount: parsedLoanAmount,
            outstandingPrincipal: parsedLoanAmount, 
            loanTermDays: parsedLoanTermDays,
            dailyInterestRate: dailyInterestRateForThisLoan, 
            accruedInterest: 0, 
            overdueInterestAccrued: 0, 
            latePaymentFeesAccrued: 0, 
            loanDate: new Date(),
            approvalDate: null,
            dueDate: null,
            status: 'PendingApproval', 
            amountRepaid: 0,
            repaidDate: null, 
            repaymentHistory: [], 
            disableInterestAccrual: false, 
            disableLateFeesAccrual: false, 
            lastInterestAccrualDate: null,
            lastOverdueChargeDate: null, 
            adminNotes: null 
        });

        // 7. Send Success Response to the user
        res.status(201).json(new ApiResponse(
            201,
            {
                loanId: newLoan._id,
                loanAmount: newLoan.loanAmount,
                loanTermDays: newLoan.loanTermDays,
                dailyInterestRate: newLoan.dailyInterestRate,
                status: newLoan.status,
                effectiveLoanLimit: effectiveLoanLimit,
                currentOutstandingPrincipal: currentOutstandingPrincipalSum
            },
            'Loan request submitted successfully. Awaiting admin approval.'
        ));

    } catch (error) {
        console.error(`[submitLoan] Error creating loan request for user ${userId}:`, error);
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json(new ApiResponse(
                error.statusCode,
                null,
                error.message
            ));
        }
        // Generic server error
        return res.status(500).json(new ApiResponse(
            500,
            null,
            'Failed to submit loan request due to an unexpected server error.'
        ));
    }
});

const checkIntrestRate = asyncHandler(async (req,res)=>{
  const settings = await siteSettings.findOne();
  if(!settings){
    throw new ApiError(500 , 'unable to get site settings')
  }
  const dailyInterestRate = settings.intrestRate
  res.status(200).json(
    new ApiResponse(200 , dailyInterestRate)
  )
})

const checkUserBalance = asyncHandler(async (req,res)=>{
  const user = await req.user
  if(!user){
    throw new ApiError(400 , 'unable to find the user please login')
  }
  const accountBalance = user.accountBalance
  const data = {'balance' : accountBalance}
  res.status(200).json(
    new ApiResponse(200, data, 'account balance fetched' )
  )
})

const checkLoanStatus = asyncHandler(async (req, res) => {
    // Get user ID from auth middleware
    const userId = req.user._id; 
    const existingLoan = await Loan.findOne({
        userId: userId,
        status: { $in: ['PendingApproval', 'Active'] } 
    }).lean(); 

    if (existingLoan) {
        res.status(200).json(new ApiResponse(
            200,
            {
                canRequestLoan: false, 
                existingLoan: existingLoan 
            },
            'You already have an active or pending loan request.'
        ));
    } else {
      
        res.status(200).json(new ApiResponse(
            200,
            {
                canRequestLoan: true,
                existingLoan: null 
            },
            'User is eligible to request a loan.'
        ));
    }
});

const getUserLoanHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const userLoans = await Loan.find({ userId: userId })
        .sort({ loanDate: -1 })
        .lean();

    res.status(200).json(
        new ApiResponse(200, { loans: userLoans }, 'User loan history fetched successfully.')
    );
});

const repayLoan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const loanId = req.params.id; 
    const { amount } = req.body; 

    try {
        // Call the internal helper function
        const createdRequest = await createRepaymentRequest(userId, loanId, amount); 
        // Send success response based on the created document
        return res.status(201).json(
            new ApiResponse(
                201,
                {
                    repaymentRequestId: createdRequest._id,
                    loanId: createdRequest.loanId,
                    amount: createdRequest.amount,
                    status: createdRequest.status
                },
                'Repayment request submitted successfully. Awaiting admin approval.'
            )
        );
    } catch (error) {
        console.error(`[repayLoan] Error submitting repayment request for loan ${loanId} by user ${userId}:`, error);
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
            error.message || 'Failed to submit repayment request due to an unexpected server error.'
        ));
    }
});

// notification
const userNotifications = asyncHandler(async (req, res) => {
    const user = await req.user; // Assuming user is populated by auth middleware

    if (!user) {
        // This error should ideally be caught by auth middleware before reaching here,
        // but keeping it as a safeguard.
        throw new ApiError(401, 'User not authenticated.');
    }

    // Get pagination parameters from query string
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Find the user again, but select only the notifications field
    // This is more efficient than fetching the whole user document if notifications array is large
    const userWithNotifications = await User.findById(user._id).select('notification').lean();

    if (!userWithNotifications) {
         throw new ApiError(404, 'User not found.'); // Should not happen if auth middleware works
    }

    const allNotifications = userWithNotifications.notification || []; 

    const paginatedNotifications = allNotifications.slice(skip, skip + limit);

    // Get the total number of notifications
    const totalNotifications = allNotifications.length;

    // Calculate total pages
    const totalPages = Math.ceil(totalNotifications / limit);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                notifications: paginatedNotifications,
                pagination: {
                    totalItems: totalNotifications,
                    totalPages: totalPages,
                    currentPage: page,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            },
            'Notifications fetched successfully.'
        )
    );
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const { notificationId } = req.body;

    // Validate that notificationId is provided
    if (!notificationId) {
        throw new ApiError(400, 'notificationId is required in the request body.');
    }

    // Validate notificationId format
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new ApiError(400, 'Invalid notification ID format.');
    }

    // Find the user and update the specific notification subdocument
    const user = await User.findOneAndUpdate(
        {
            _id: userId, // Find the authenticated user
            'notification._id': notificationId // Find the specific notification subdocument by its ID
        },
        {
            $set: {
                'notification.$.isRead': true // Set the 'isRead' field to true for the found subdocument
            }
        },
        { new: true } // Return the updated user document
    ).select('notification'); // Select only the notification field for efficiency

    if (!user) {
        // This could mean user not found (unlikely with auth) or notification ID doesn't exist for this user
        throw new ApiError(404, 'Notification not found for this user.');
    }

    // Find the specific updated notification to confirm the change (optional but good for response)
    const updatedNotification = user.notification.find(notif => notif._id.toString() === notificationId);

    res.status(200).json(
        new ApiResponse(
            200,
            { notificationId: notificationId, isRead: updatedNotification ? updatedNotification.isRead : true },
            'Notification marked as read successfully.'
        )
    );
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
   
    const userId = req.user._id;
    const user = await User.findById(userId).select('notification');

    if (!user) {
         throw new ApiError(404, 'User not found.'); 
    }

    let updatedCount = 0;
    user.notification.forEach(notif => {
        if (!notif.isRead) {
            notif.isRead = true; 
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        await user.save(); 
    } else {
         console.log(`[markAllNotificationsAsRead] No unread notifications found for user ${userId}.`);
    }


    res.status(200).json(
        new ApiResponse(
            200,
            { updatedCount: updatedCount },
            `All notifications marked as read successfully.`
        )
    );
});

// ai robot

const getAvailableAIRobotPackages = asyncHandler(async (req, res) => {
    const packages = await AIRobotPackage.find({ isActive: true }).lean();

    if (!packages || packages.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { packages: [] }, 'No active AI Robot packages found.')
        );
    }

    res.status(200).json(
        new ApiResponse(
            200,
            { packages: packages },
            'Active AI Robot packages fetched successfully.'
        )
    );
});

const hostAIRobotInvestment = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const { packageId, investmentAmount, selectedAssetName, transactionPassword } = req.body;

    if (!packageId || investmentAmount === undefined || !selectedAssetName || !transactionPassword) {
        throw new ApiError(400, 'All fields (packageId, investmentAmount, selectedAssetName, transactionPassword) are required.');
    }

    if (!mongoose.Types.ObjectId.isValid(packageId)) {
        throw new ApiError(400, 'Invalid package ID format.');
    }

    const parsedInvestmentAmount = parseFloat(investmentAmount);
    if (isNaN(parsedInvestmentAmount) || parsedInvestmentAmount <= 0) {
        throw new ApiError(400, 'Invalid investment amount. Must be a positive number.');
    }
    
    if (typeof selectedAssetName !== 'string' || selectedAssetName.trim() === '') {
        throw new ApiError(400, 'Invalid asset name.');
    }

    try {
        const aiRobotPackage = await AIRobotPackage.findById(packageId);

        if (!aiRobotPackage || !aiRobotPackage.isActive) {
            throw new ApiError(404, 'AI Robot package not found or is not active.');
        }

        if (parsedInvestmentAmount < aiRobotPackage.minInvestmentAmount || parsedInvestmentAmount > aiRobotPackage.maxInvestmentAmount) {
            throw new ApiError(400, `Investment amount must be between ${aiRobotPackage.minInvestmentAmount} and ${aiRobotPackage.maxInvestmentAmount} USD for this package.`);
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, 'User not found.'); 
        }

        const activeRobotsCount = await AIRobotInvestmentOrder.countDocuments({
            userId: userId,
            status: 'Running'
        });

        
        if (activeRobotsCount >= user.robotLimit) {
            throw new ApiError(400, `You have reached your maximum limit of ${user.robotLimit} active AI Robots. Please redeem existing robots or contact support to increase your limit.`);
        }

        const isTrxPassCorrect = await user.isTrxPassCorrect(transactionPassword);
        if (!isTrxPassCorrect) {
            throw new ApiError(401, 'Incorrect transaction password.');
        }

        if (user.accountBalance < parsedInvestmentAmount) {
            throw new ApiError(400, 'Insufficient available balance to host this AI Robot.');
        }

        // 9. Update User Balances (Deduct from Available, Add to Locked)
        user.accountBalance -= parsedInvestmentAmount; 
        user.lockedBalance += parsedInvestmentAmount;

        await user.save();

        await Transaction.create({
            userId: user._id,
            amount: parsedInvestmentAmount,
            type: 'debit',
            description: `AI Robot purchase`,
            referenceId: null,
            category: 'ai-robot-purchase',
            status: 'completed'
        });
        
        const startTime = new Date();
        const endTime = new Date(startTime);
        endTime.setDate(startTime.getDate() + aiRobotPackage.cycleDurationDays);

        const newInvestmentOrder = new AIRobotInvestmentOrder({
            userId: user._id,
            packageId: aiRobotPackage._id,
            investmentAmount: parsedInvestmentAmount,
            selectedAssetName: selectedAssetName.trim(),
            minDailyReturnPercentage: aiRobotPackage.minDailyReturnPercentage,
            maxDailyReturnPercentage: aiRobotPackage.maxDailyReturnPercentage,
            cycleDurationDays: aiRobotPackage.cycleDurationDays,
            startTime: startTime,
            endTime: endTime,
            status: 'Running', 
            totalProfitEarned: 0,
            dailyRevenueHistory: [],
            lastProfitDistributionDate: null 
        });

        try {
            await newInvestmentOrder.save();
        } catch (orderSaveError) {
            console.error(`[hostAIRobotInvestment] Failed to save new investment order for user ${user._id}:`, orderSaveError);
            
            try {
                user.accountBalance += parsedInvestmentAmount;
                user.lockedBalance -= parsedInvestmentAmount;
                await user.save();
            } catch (refundError) {
                console.error(`[hostAIRobotInvestment] CRITICAL: Failed to refund funds for user ${user._id} after investment order creation failure! Funds may be stuck.`, refundError);
            }
            throw new ApiError(500, 'Failed to host AI Robot investment. Please try again.');
        }

        res.status(201).json(
            new ApiResponse(
                201,
                {
                    orderId: newInvestmentOrder._id,
                    investmentAmount: newInvestmentOrder.investmentAmount,
                    selectedAssetName: newInvestmentOrder.selectedAssetName,
                    startTime: newInvestmentOrder.startTime,
                    endTime: newInvestmentOrder.endTime,
                    status: newInvestmentOrder.status,
                    availableBalance: user.accountBalance,
                    lockedBalance: user.lockedBalance
                },
                'AI Robot investment hosted successfully.'
            )
        );

    } catch (error) {
        console.error('[host AI Robot Investment]', error);
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
            'Failed to host AI Robot investment due to a server error.'
        ));
    }
});

const getMyAIRobotInvestments = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const { status } = req.body || {};

    const filter = { userId: userId };

    if (status) {
        const validStatuses = ['Running', 'Completed', 'Redeemed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            throw new ApiError(400, 'Invalid status provided. Valid statuses are: Running, Completed, Redeemed, Cancelled.');
        }
        filter.status = status;
    }

    const myInvestments = await AIRobotInvestmentOrder.find(filter)
        .populate('packageId') 
        .sort({ createdAt: -1 })
        .lean();

    if (!myInvestments || myInvestments.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { orders: [] }, 'No AI Robot investment orders found for this user.')
        );
    }

    res.status(200).json(
        new ApiResponse(
            200,
            { orders: myInvestments },
            'AI Robot investment orders fetched successfully.'
        )
    );
});

const redeemAIRobotInvestment = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const { orderId } = req.body; 
    if (!orderId) {
        throw new ApiError(400, 'Order ID is required.');
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new ApiError(400, 'Invalid order ID format.');
    }

    try {
        const order = await AIRobotInvestmentOrder.findOne({
            _id: orderId,
            userId: userId
        });

        if (!order) {
            throw new ApiError(404, 'Investment order not found or does not belong to this user.');
        }

        if (order.status !== 'Completed') {
            throw new ApiError(400, `Investment order cannot be redeemed. Current status: ${order.status}. Only 'Completed' orders can be redeemed.`);
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, 'User not found.'); 
        }

        const totalAmountToRedeem = order.investmentAmount + order.totalProfitEarned;
        user.lockedBalance -= order.investmentAmount;
        user.accountBalance += totalAmountToRedeem;

        await user.save();

        await Transaction.create({
            userId: user._id,
            amount: totalAmountToRedeem,
            type: 'credit',
            description: `AI Robot redemption from order ${orderId}`,
            referenceId: order._id,
            category: 'ai-robot-redemption',
            status: 'completed'
        });

        order.status = 'Redeemed';
        order.redemptionDate = new Date(); 
        order.redeemedAmount = totalAmountToRedeem; 

        await order.save();

        user.transactionHistory.push({
            type: 'ai_robot_redemption',
            amount: totalAmountToRedeem,
            date: new Date(),
            status: 'completed',
            metadata: {
                orderId: order._id,
                investmentAmount: order.investmentAmount,
                totalProfitEarned: order.totalProfitEarned,
                packageId: order.packageId 
            }
        });
        await user.save(); 
        await addUserNotification(
            userId,
            `AI Robot: Your investment order has been successfully redeemed! You received ${totalAmountToRedeem.toFixed(2)} USD.`
        );

        res.status(200).json(
            new ApiResponse(
                200,
                {
                    orderId: order._id,
                    redeemedAmount: totalAmountToRedeem,
                    newAccountBalance: user.accountBalance,
                    newLockedBalance: user.lockedBalance,
                    status: order.status
                },
                'AI Robot investment redeemed successfully.'
            )
        );

    } catch (error) {
        console.error('[redeemAIRobotInvestment] Error redeeming investment:', error);

        // Handle specific errors and return appropriate responses
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
            'Failed to redeem AI Robot investment due to a server error.'
        ));
    }
});

const getAIRobotRevenueHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const { orderId } = req.body; 

    if (!orderId) {
        throw new ApiError(400, 'Order ID is required in the request body.');
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new ApiError(400, 'Invalid order ID format.');
    }

    const order = await AIRobotInvestmentOrder.findOne({
        _id: orderId,
        userId: userId
    }).select('dailyRevenueHistory investmentAmount selectedAssetName totalProfitEarned').lean();

    if (!order) {
        throw new ApiError(404, 'Investment order not found or does not belong to this user.');
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                orderId: order._id,
                investmentAmount: order.investmentAmount,
                selectedAssetName: order.selectedAssetName,
                totalProfitEarned: order.totalProfitEarned,
                dailyRevenueHistory: order.dailyRevenueHistory || [] 
            },
            'Daily revenue history fetched successfully.'
        )
    );
});

const getAIFinanceDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user._id; 
    const userOrders = await AIRobotInvestmentOrder.find({ userId: userId })
                                                    .select('status investmentAmount totalProfitEarned dailyRevenueHistory')
                                                    .lean();

    let totalFundsInCustody = 0;
    let estimatedEarningsToday = 0;
    let cumulativeIncome = 0;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    userOrders.forEach(order => {
        if (order.status === 'Running') {
            totalFundsInCustody += order.investmentAmount;
        }

        cumulativeIncome += order.totalProfitEarned;

        if (order.dailyRevenueHistory && order.dailyRevenueHistory.length > 0) {
            order.dailyRevenueHistory.forEach(dailyProfit => {
                const profitDateUTC = new Date(Date.UTC(
                    dailyProfit.date.getUTCFullYear(),
                    dailyProfit.date.getUTCMonth(),
                    dailyProfit.date.getUTCDate()
                ));

                if (profitDateUTC.getTime() === todayUTC.getTime()) {
                    estimatedEarningsToday += dailyProfit.amount;
                }
            });
        }
    });

    res.status(200).json(
        new ApiResponse(
            200,
            {
                totalFundsInCustody: totalFundsInCustody,
                estimatedEarningsToday: estimatedEarningsToday,
                cumulativeIncome: cumulativeIncome
            },
            'AI Finance dashboard statistics fetched successfully.'
        )
    );
});

export {
    checkIntrestRate, checkLoanStatus, checkTrxPass, checkUserBalance, forgotPass, getAIFinanceDashboardStats, getAIRobotRevenueHistory, getAvailableAIRobotPackages, getMyAIRobotInvestments, getUserLoanHistory, hostAIRobotInvestment, loginCheck,
    loginUser,
    logoutUser, markAllNotificationsAsRead, markNotificationAsRead, profile, redeemAIRobotInvestment, registerUser, repayLoan, sendOtp, setTransactionPassword, submitKyc, submitLoan, updateProfile, userNotifications, verifyOtp
};

