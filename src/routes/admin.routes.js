import { Router } from "express";
import { adminGetUserLoanHistory, approveRepaymentRequest, deleteAnnouncementForAll, deleteNote, deleteWalletAddress, deleteWithdrawalCurrency, getAdminDashboardStats, getAnnouncements, getKycStates, getKycSubmissions, getLoanDetailsById, getNotificationsAndDelete, getSiteSettings, getSupportedCurrencies, getUser, getWithdrawalRequests, isKycSubmitted, listFundRequests, listRepaymentRequests, listUsers, loanLists, rejectRepaymentRequest, sendNotificationToAll, sendNotificationToUser, setFundStatus, setKycStatus, setLoanStatus, setLoanTermRate, setOptionTradeOutcome, setWalletAddress, setWithdrawalCurrencies, setWithdrawalFee, setWithdrawalReqStatus, updateAiRobotLimit, updateAnnouncementForAll, updateLoanSettings, updateNotificationMessage, updateUser, updateUserLoanLimit, updateWalletAddress } from "../controllers/admin.controller.js";
import { addAIRobotPackage } from "../controllers/airobot.controller.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { findUser } from "../middlewares/auth.middleware.js";
import { mediaUpload } from "../middlewares/multer.middleware.js";

const router = Router()


// user management routes
router.get('/list-users' , requireAdmin , listUsers)
router.get('/user/:id' , requireAdmin ,getUser )
router.put('/user/:id',requireAdmin,updateUser);
router.put('/user/:id/avatar',requireAdmin, mediaUpload('profile-pic').single('profilePic'),updateUser);
router.delete('/user/:id/notes/:noteId',requireAdmin,deleteNote);
router.get('/kyc-submissions' , requireAdmin , getKycSubmissions)
router.post('/set-kyc-status' , requireAdmin , setKycStatus)
router.get('/kyc-states' , requireAdmin , getKycStates)
router.post('/kyc-status-user' , requireAdmin , isKycSubmitted)
router.post('/user-loan-history' , adminGetUserLoanHistory)
router.post('/update-robot-limit' , requireAdmin , updateAiRobotLimit)

// payment management routes
router.post('/set-wallet-address' , requireAdmin, mediaUpload('payment-method').single('paymentMethod'),setWalletAddress)
router.get('/fund-verification' , requireAdmin , listFundRequests)
router.post('/set-fund-status' , requireAdmin , setFundStatus)
router.post('/set-withdrawal-currencies' , requireAdmin, setWithdrawalCurrencies)
router.get('/get-supported-currencies' , getSupportedCurrencies)
router.post('/set-withdraw-fee' , requireAdmin , setWithdrawalFee)
router.get('/get-site-settings' , getSiteSettings)
router.get('/get-withdrawal-requests' , requireAdmin , getWithdrawalRequests)
router.post('/set-withdrawal-status' , requireAdmin , setWithdrawalReqStatus)
router.get('/loan-list' , requireAdmin , loanLists)
router.put('/loans/status' , findUser , requireAdmin , setLoanStatus)
router.post('/set-term-rate', requireAdmin, setLoanTermRate)
router.post('/updateLoanLimit' , requireAdmin , updateUserLoanLimit)
router.get('/repaymentRequests' , requireAdmin , listRepaymentRequests)
router.post('/approveRepaymentRequest' , requireAdmin , approveRepaymentRequest)
router.post('/rejectRepaymentRequest' , requireAdmin, rejectRepaymentRequest)
router.get('/getLoanDetailsById/:loanId', requireAdmin, getLoanDetailsById)
router.post('/:loanId/settings', requireAdmin , updateLoanSettings)
router.put(   '/update-wallet-address/:id', requireAdmin,  updateWalletAddress);
router.delete('/delete-wallet-address/:id', requireAdmin ,  deleteWalletAddress);
router.delete('/delete-withdrawal-currencies/:id', requireAdmin , deleteWithdrawalCurrency);


// get site states
router.get('/site-state' , requireAdmin , getAdminDashboardStats)

// ai bot management routs
router.post('/ai-robot-packages' , requireAdmin , addAIRobotPackage)

// notification management routes
router.post('/sendAnnouncment' , requireAdmin , sendNotificationToAll)
router.post('/sendNotificationToUser' , requireAdmin , sendNotificationToUser)
router.post('/findAndDeleteNotification' , requireAdmin , getNotificationsAndDelete)

router.post('/editNotification' , requireAdmin , updateNotificationMessage)
router.get('/getAnnouncement' , requireAdmin , getAnnouncements)
router.put('/updateAnnouncement' , requireAdmin , updateAnnouncementForAll)
router.delete('/deleteAnnouncement' , requireAdmin , deleteAnnouncementForAll)

// trading related routes
router.put('/options/:tradeId/set-outcome' , requireAdmin , setOptionTradeOutcome)

export default router