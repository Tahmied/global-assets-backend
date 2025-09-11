import { Router } from "express";
import { addFund, getWalletAddress, withdraw } from "../controllers/payment.controller.js";
import { checkIntrestRate, checkLoanStatus, checkTrxPass, checkUserBalance, forgotPass, getAIFinanceDashboardStats, getAIRobotRevenueHistory, getAvailableAIRobotPackages, getMyAIRobotInvestments, getUserLoanHistory, hostAIRobotInvestment, loginCheck, loginUser, logoutUser, markAllNotificationsAsRead, markNotificationAsRead, profile, redeemAIRobotInvestment, registerUser, repayLoan, sendOtp, setTransactionPassword, submitKyc, submitLoan, updateProfile, userNotifications, verifyOtp } from "../controllers/user.controller.js";
import { findUser } from "../middlewares/auth.middleware.js";
import { mediaUpload } from "../middlewares/multer.middleware.js";
const router = Router()

// normal routes
router.get('/profile' , findUser , profile )
router.get('/notificaitons' , findUser , userNotifications )
router.post('/update-profile' , findUser , mediaUpload('profile-pic').single('profilePic') , updateProfile)
router.post('/kyc-verificaiton' , findUser , mediaUpload('kyc-docs').fields([
    {name : 'docFront' , maxCount:1},
    {name : 'docsBack' , maxCount:1}
]), submitKyc)

router.put('/notification/mark-as-read' , findUser , markNotificationAsRead)
router.put('/notifications/mark-all-read' , findUser , markAllNotificationsAsRead)

// secure routes
router.post("/register", mediaUpload('profile-pic').single('profilePic'), registerUser);
router.post('/send-otp' , sendOtp )
router.post('/verify-otp' , verifyOtp)
router.post('/login' , loginUser)
router.post('/logout' , findUser , logoutUser)
router.post('/forgot-password' , forgotPass)
router.get('/logincheck' , findUser , loginCheck )
router.post('/set-transaction-pass' , findUser , setTransactionPassword)
router.post('/check-trx-pass' , findUser , checkTrxPass)

// payment routes

router.get('/get-wallet-address' , findUser , getWalletAddress)
router.post('/add-fund' , findUser, mediaUpload('payment-proves').fields([{name : 'paymentProves',maxCount:1}]),addFund)
router.post('/withdraw' , findUser , withdraw)
router.post('/loan-req' , findUser, submitLoan)
router.get('/intrest-rate' , checkIntrestRate )
router.get('/account-balance' , findUser, checkUserBalance)
router.get('/loan-status' , findUser, checkLoanStatus)
router.get('/loan-history' , findUser , getUserLoanHistory)
router.post('/:id/repay' , findUser , repayLoan)


// AI finance 
router.get('/ai-robot-packages' , getAvailableAIRobotPackages)
router.post('/host-investment' , findUser , hostAIRobotInvestment)
router.post('/get-my-robots' , findUser , getMyAIRobotInvestments)
router.post('/redeem-investment' , findUser , redeemAIRobotInvestment)
router.post('/revenue-history' , findUser , getAIRobotRevenueHistory)
router.get('/ai-finance-states' , findUser, getAIFinanceDashboardStats)


export default router
