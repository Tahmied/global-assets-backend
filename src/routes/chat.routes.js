import { Router } from 'express';
import {
    getChatHistory,
    getUsersForChatList,
    markMessagesAsRead,
    sendMessage,
    setAdminDisplayStatus
} from '../controllers/chat.controller.js';
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { findUser } from "../middlewares/auth.middleware.js";

const router = Router();

router.route('/chat/send').post(findUser, sendMessage);
router.route('/history/:otherUserId').get(findUser, getChatHistory);
router.route('/admin/users-for-chat-list').get(findUser, requireAdmin, getUsersForChatList);
router.route('/admin/set-display-status').post(findUser, requireAdmin, setAdminDisplayStatus);
router.route('/chat/mark-read').post(findUser, markMessagesAsRead);


export default router;