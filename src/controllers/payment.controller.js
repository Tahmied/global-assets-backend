import { paymentRequest } from "../models/paymentRequest.model.js";
import { adminWalletAddress } from "../models/wallet.model.js";
import { withdrawRequest } from "../models/withdrawRequest.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getWalletAddress = asyncHandler(async (req,res)=>{
    const user = await req.user
    if(!user){
        throw new ApiError(200 , 'you need to be logged in to view this')
    }

    const walletAddress = await adminWalletAddress.find()
    res.status(200).json(
        new ApiResponse(200 , walletAddress , 'all wallet addresses')
    )
})

  const addFund = asyncHandler(async (req, res) => {
      const user = await req.user; 
      if (!user) {
        throw new ApiError(400, 'You must be logged in to add funds');
      }
      const { amount, currency , chainName } = req.body;
      if (!amount || !currency) {
        throw new ApiError(400, 'Amount and currency are required');
      }
      if(!chainName){
        throw new ApiError(400, 'chain name is required');
      }
      const paymentProve = req.files?.paymentProves?.[0]?.path;
      if(!paymentProve){
        throw new ApiError(400 , 'payment prove is a required field')
      }
      
      let newFund;
      try {
        newFund = await paymentRequest.create({
          userId: user._id,
          amount,
          currency, paymentProve, chainName,
          status: 'pending',  
        });
    
        res.status(201).json({
          message: 'Payment request created successfully',
          paymentRequest: newFund,
        });
      } catch (err) {
        throw new ApiError(500, 'Error processing the payment request');
      }
   });

  const withdraw = asyncHandler(async (req, res) => {
    const user = await req.user;
    if (!user) {
      throw new ApiError(400, 'You must be logged in to request a withdrawal');
    }
  
    const { amount, toAddress, currency, chainName } = req.body;
    const accountBalance = user.accountBalance;
    const loanBalance = user.loanBalance;
    const userId = user._id;
    const firstName = user.firstName
    const secondName = user.lastName
    const fullName = `${firstName} ${secondName}`
    const profilePic = user.dpLocalPath
  
    // Check if the user has sufficient balance
    if (accountBalance < amount) {
      throw new ApiError(400, 'Insufficient balance, please check your account balance');
    }
  
    // Check if the user has an outstanding loan balance
    if (loanBalance > 0) {
      throw new ApiError(400, 'Please settle your outstanding loan balance before making a withdrawal');
    }
  
    // Ensure all required fields are provided
    if ([amount, toAddress, currency, chainName].some((e) => !e)) {
      throw new ApiError(400, 'All fields are required');
    }
  
    let withdrawReq;
    try {
      withdrawReq = await withdrawRequest.create({
        userId, fullName, profilePic,
        amount,
        toAddress,
        currency, chainName,
        status: 'pending',  
        adminNotes: null,  
      });
    } catch (err) {
      throw new ApiError(500, `Error processing the withdrawal request ${err}`);
    }
  
    // Respond with the created withdrawal request
    res.status(201).json({
      message: 'Withdrawal request created successfully',
      withdrawReq,
    });
  });
  
  

export { addFund, getWalletAddress, withdraw };

