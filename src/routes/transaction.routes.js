import { Router } from 'express';
import { getUserTransactionHistory } from '../controllers/transaction.controller.js';
import { findUser } from '../middlewares/auth.middleware.js';

const router = Router()

router.route("/history").get(findUser, getUserTransactionHistory);

export default router