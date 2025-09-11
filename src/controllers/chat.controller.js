import { broadcastAdminStatusToUsers, broadcastToAdmins, getAdminEffectiveDisplayStatus, isUserActuallyOnline, pushChatMessage } from '../chatWebSocketService.js';
import { ChatMessage } from '../models/chat.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';


const ADMIN_TEAM_ID = '68083fb5d70405e5870c6594';

const sendMessage = asyncHandler(async (req, res) => {
    const senderId = req.user._id;
    let { receiverId, messageContent } = req.body;

    if (!messageContent) {
        throw new ApiError(400, 'Message content is required.');
    }

    const sender = req.user;
    const senderRole = sender.isAdmin ? 'Admin' : 'User';

    if (senderRole === 'User') {
        receiverId = ADMIN_TEAM_ID;
    } else {
        if (!receiverId) {
            throw new ApiError(400, 'Receiver ID is required for an admin message.');
        }
    }

    const newMessage = await ChatMessage.create({
        senderId,
        receiverId,
        messageContent,
        senderRole
    });

    if (senderRole === 'User') {
        await broadcastToAdmins(newMessage, senderId.toString());

        // --- FIX: atomically increment unread count for all admins ---
        const key = `unreadChatMessages.${senderId.toString()}`;
        const updateResult = await User.updateMany(
            { isAdmin: true },
            { $inc: { [key]: 1 } }
        );

        // Fallback: if some admin documents don't have the key at all (rare),
        // ensure they get the key set to 1 so UI/schema expecting it won't break.
        // This keeps behavior identical to the per-admin loop but in two efficient ops.
        if (updateResult.matchedCount > 0) {
            await User.updateMany(
                { isAdmin: true, [key]: { $exists: false } },
                { $set: { [key]: 1 } }
            );
        }
    } else {
        await pushChatMessage(newMessage, receiverId.toString());
    }

    res.status(201).json(new ApiResponse(201, newMessage, 'Message sent successfully.'));
});


const getChatHistory = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const otherUserId = req.params.otherUserId;
  const page = Math.max(0, parseInt(req.query.page) || 0);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skipAmount = page * limit;

  if (!otherUserId) {
    throw new ApiError(400, 'Other user ID is required to fetch chat history.');
  }

  const allAdminIds = (await User.find({ isAdmin: true }).select('_id')).map(admin => admin._id.toString());

let query;
if (currentUser.isAdmin) {
    query = {
        $or: [
            { senderId: otherUserId, receiverId: ADMIN_TEAM_ID },
            { senderId: { $in: allAdminIds }, receiverId: otherUserId }
        ]
    };
} else {
    query = {
        $or: [
            { senderId: currentUser._id, receiverId: ADMIN_TEAM_ID },
            { senderId: { $in: allAdminIds }, receiverId: currentUser._id }
        ]
    };
}

  let history = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .skip(skipAmount)
    .limit(limit)
    .populate('senderId', 'email username isAdmin adminChatDisplayStatus')
    .populate('receiverId', 'email username isAdmin adminChatDisplayStatus');

  history = history.reverse();

  if (currentUser.isAdmin) {
      await ChatMessage.updateMany(
        { receiverId: ADMIN_TEAM_ID, senderId: otherUserId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );

      const adminUser = await User.findById(currentUser._id);
      if (adminUser && adminUser.unreadChatMessages.has(otherUserId)) {
        adminUser.unreadChatMessages.delete(otherUserId);
        await adminUser.save();
      }
  } else {
      await ChatMessage.updateMany(
          { receiverId: currentUser._id, senderId: { $in: allAdminIds }, isRead: false },
          { $set: { isRead: true, readAt: new Date() } }
      );
  }

  res.status(200).json(new ApiResponse(200, history, 'Chat history retrieved successfully.'));
});

const getUsersForChatList = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

  // parse pagination, default page=0, limit=8
  const page  = Math.max(0, parseInt(req.query.page, 10) || 0);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 8);
  const skip  = page * limit;

  // fetch only the slice we need
  const users = await User.find({ isAdmin: false })
    .select('_id email username dpLocalPath')
    .skip(skip)
    .limit(limit)
    .lean();

  // fetch admin unread map once
  const adminUser = await User.findById(adminId).select('unreadChatMessages').lean();
  const unreadMap = adminUser?.unreadChatMessages || {};

  // augment with status & unread count
  const usersWithStatus = await Promise.all(
    users.map(async (user) => ({
      _id: user._id,
      email: user.email,
      username: user.username,
      dpLocalPath: user.dpLocalPath,
      actualOnlineStatus: await isUserActuallyOnline(user._id.toString()),
      unreadMessageCount: unreadMap[user._id.toString()] || 0
    }))
  );


  return res
    .status(200)
    .json(new ApiResponse(
      200,
      usersWithStatus,
      `Users list (page ${page}, ${usersWithStatus.length} items) retrieved successfully.`
    ));
});

const setAdminDisplayStatus = asyncHandler(async (req, res) => {
    const adminId = req.user._id;
    const { status } = req.body;

    if (!['Auto', 'Online', 'Offline'].includes(status)) {
        console.error('Chat API: Invalid status for setAdminDisplayStatus.');
        throw new ApiError(400, 'Invalid status provided. Must be Auto, Online, or Offline.');
    }

    const adminUser = await User.findById(adminId);
    if (!adminUser || !adminUser.isAdmin) {
        console.error(`Chat API: Admin user ${adminId} not found or not an admin.`);
        throw new ApiError(404, 'Admin user not found.');
    }

    adminUser.adminChatDisplayStatus = status;
    await adminUser.save();

    const effectiveStatus = await getAdminEffectiveDisplayStatus(adminId);
    broadcastAdminStatusToUsers(effectiveStatus);

    res.status(200).json(new ApiResponse(200, { status: effectiveStatus }, 'Admin chat display status updated.'));
});

const markMessagesAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { otherUserId } = req.body;

    if (!otherUserId) {
        throw new ApiError(400, 'Other user ID is required to mark messages as read.');
    }

    if (req.user.isAdmin) {
        await ChatMessage.updateMany(
            { senderId: otherUserId, receiverId: ADMIN_TEAM_ID, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );

        // --- FIX: unset the unread count for this user from ALL admins (shared inbox) ---
        await User.updateMany(
            { isAdmin: true },
            { $unset: { [`unreadChatMessages.${otherUserId.toString()}`]: "" } }
        );

        // keep current admin's in-memory doc consistent (optional but safe)
        const adminUser = req.user;
        if (adminUser.unreadChatMessages && adminUser.unreadChatMessages.has && adminUser.unreadChatMessages.has(otherUserId.toString())) {
            adminUser.unreadChatMessages.delete(otherUserId.toString());
            await adminUser.save();
        }
    } else {
        const allAdminIds = (await User.find({ isAdmin: true }).select('_id')).map(admin => admin._id.toString());
        await ChatMessage.updateMany(
            { receiverId: userId, senderId: { $in: allAdminIds }, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
    }

    res.status(200).json(new ApiResponse(200, null, 'Messages marked as read successfully.'));
});

export {
    getChatHistory,
    getUsersForChatList, markMessagesAsRead, sendMessage, setAdminDisplayStatus
};

