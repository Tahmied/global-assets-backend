import { Router } from "express";

import { addInvestmentToOptionTrade, closePosition, getAssetDetails, getCompletedContractTrades, getOpenPositions, getTwdAssets, getUserOptionTrades, placeContractTrade, placeOptionTrade, updatePositionTpSl } from "../controllers/market.controller.js";
import { findUser } from "../middlewares/auth.middleware.js";
const router = Router()

// twelve data
router.get('/get-twd-assets' , getTwdAssets)
router.get('/get-asset-details' , getAssetDetails)

// Binary Option Trading Routes
router.post('/options/trades', findUser, placeOptionTrade);
router.get('/options/trades', findUser, getUserOptionTrades);
router.put('/options/trades/:id/add-investment', findUser, addInvestmentToOptionTrade);

// Contract Trading Routes

router.post('/contracts/trades', findUser, placeContractTrade);
router.get('/contracts/positions', findUser, getOpenPositions);
router.put('/contracts/positions/:id', findUser, updatePositionTpSl);
router.post('/contracts/positions/:id/close', findUser, closePosition);
router.get('/contracts/getCompletedContractTrades', findUser , getCompletedContractTrades)


export default router