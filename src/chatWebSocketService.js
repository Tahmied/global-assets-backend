import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { ChatMessage } from './models/chat.model.js';
import { User } from './models/user.model.js';

const connectedUserSockets = new Map();
const ADMIN_TEAM_ID = process.env.ADMIN_TEAM_ID;

export function initializeChatSystem(httpServer) {
    const wssChat = new WebSocketServer({ noServer: true });

   
    
    wssChat.on('connection', (ws) => {
        ws.userId = null;
        ws.isAdmin = false;

        const authTimeout = setTimeout(() => {
            if (!ws.userId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout. Please send JWT.' }));
                ws.close();
              
            }
        }, 5000);

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                // Handle auth
                if (data.type === 'auth' && data.token) {
                    clearTimeout(authTimeout);

                    if (ws.userId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Already authenticated.' }));
                        return;
                    }

                    const decoded = jwt.verify(data.token, process.env.ACCESS_TOKEN_KEY);
                    const user = await User.findById(decoded._id).select('_id isAdmin email username adminChatDisplayStatus');
                    if (!user) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: User not found.' }));
                        ws.close();
                        return;
                    }

                    ws.userId = user._id.toString();
                    ws.isAdmin = user.isAdmin;

                    connectedUserSockets.set(ws.userId, ws);

                    ws.send(JSON.stringify({ type: 'authSuccess', userId: ws.userId, isAdmin: ws.isAdmin }));
                   

                    if (!ws.isAdmin) {
                        const allAdminIds = (await User.find({ isAdmin: true }).select('_id')).map(admin => admin._id);
                        const query = {
                            $or: [
                                { senderId: user._id, receiverId: ADMIN_TEAM_ID },
                                { senderId: { $in: allAdminIds }, receiverId: user._id }
                            ]
                        };

                        const chatHistory = await ChatMessage.find(query)
                            .sort({ createdAt: 1 })
                            .limit(50)
                            .populate('senderId', 'email username isAdmin adminChatDisplayStatus')
                            .populate('receiverId', 'email username isAdmin adminChatDisplayStatus');

                        ws.send(JSON.stringify({ type: 'chatHistory', messages: chatHistory }));
                        broadcastUserOnlineStatus(ws.userId, true);
                    } else {
                        const adminStatus = await getAdminEffectiveDisplayStatus(ws.userId);
                        broadcastAdminStatusToUsers(adminStatus);
                    }
                    return;
                }

                if (!ws.userId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated.' }));
                    return;
                }

              

            } catch (err) {
                console.error('[WS] Error handling message:', err.message);

                if (err instanceof jwt.JsonWebTokenError) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token.' }));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message.' }));
                }

                if (!ws.userId) ws.close();
            }
        });

        ws.on('close', async (code, reason) => {
            clearTimeout(authTimeout);

            if (ws.userId) {
                connectedUserSockets.delete(ws.userId);
               

                if (ws.isAdmin) {
                    const status = await getAdminEffectiveDisplayStatus(ws.userId);
                    broadcastAdminStatusToUsers(status);
                } else {
                    broadcastUserOnlineStatus(ws.userId, false);
                }
            } else {
            }
        });

        ws.on('error', async (err) => {
            clearTimeout(authTimeout);
            console.error('[WS] Socket error:', err.message);

            if (ws.userId) {
                connectedUserSockets.delete(ws.userId);
                if (!ws.isAdmin) {
                    broadcastUserOnlineStatus(ws.userId, false);
                } else {
                    const status = await getAdminEffectiveDisplayStatus(ws.userId);
                    broadcastAdminStatusToUsers(status);
                }
            }

            ws.terminate();
        });
    });

    // Cleanup disconnected sockets every 60s
    setInterval(() => {
        connectedUserSockets.forEach(async (wsClient, userId) => {
            if (wsClient.readyState !== WebSocket.OPEN) {
                connectedUserSockets.delete(userId);

                if (wsClient.isAdmin) {
                    const status = await getAdminEffectiveDisplayStatus(userId);
                    broadcastAdminStatusToUsers(status);
                } else {
                    broadcastUserOnlineStatus(userId, false);
                }
            }
        });
    }, 60000);
    return wssChat;

}



export function isUserActuallyOnline(userId) {
    const ws = connectedUserSockets.get(userId);
    return ws && ws.readyState === WebSocket.OPEN;
}

export async function pushChatMessage(messageData, targetUserId) {
    const targetWs = connectedUserSockets.get(targetUserId);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        try {
            const populatedMessage = await ChatMessage.findById(messageData._id)
                .populate('senderId', 'email username isAdmin adminChatDisplayStatus')
                .populate('receiverId', 'email username isAdmin adminChatDisplayStatus');

            if (populatedMessage) {
                targetWs.send(JSON.stringify({ type: 'newChatMessage', message: populatedMessage }));
            }
        } catch (err) {
            console.error(`[WS] Failed to push message to ${targetUserId}:`, err.message);
        }
    } else {
    }
}

export async function broadcastToAdmins(messageData, senderId) {
    try {
        const populatedMessage = await ChatMessage.findById(messageData._id)
            .populate('senderId', 'email username isAdmin adminChatDisplayStatus')
            .populate('receiverId', 'email username isAdmin adminChatDisplayStatus');

        if (populatedMessage) {
            connectedUserSockets.forEach((wsClient) => {
                if (wsClient.isAdmin && wsClient.readyState === WebSocket.OPEN) {
                    wsClient.send(JSON.stringify({ type: 'newChatMessage', message: populatedMessage }));
                }
            });
        }
    } catch (err) {
        console.error(`[WS] Failed to broadcast message from ${senderId}:`, err.message);
    }
}


async function broadcastUserOnlineStatus(userId, isOnline) {
    const user = await User.findById(userId).select('email username');
    if (!user) return;

    const payload = {
        type: 'userStatusUpdate',
        userId,
        username: user.username,
        email: user.email,
        isOnline
    };

    const message = JSON.stringify(payload);

    connectedUserSockets.forEach((wsClient) => {
        if (wsClient.isAdmin && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(message);
        }
    });

}

export async function getAdminEffectiveDisplayStatus(adminId) {
    try {
        const admin = await User.findById(adminId).select('adminChatDisplayStatus isAdmin');
        if (!admin || !admin.isAdmin) return 'Offline';

        if (admin.adminChatDisplayStatus === 'Auto') {
            return isUserActuallyOnline(adminId) ? 'Online' : 'Offline';
        }

        return admin.adminChatDisplayStatus;
    } catch (err) {
        console.error('[WS] Failed to get admin status:', err.message);
        return 'Offline';
    }
}

export async function broadcastAdminStatusToUsers(status) {
    const message = JSON.stringify({
        type: 'adminStatusUpdate',
        isAdminOnline: status === 'Online'
    });

    connectedUserSockets.forEach((wsClient) => {
        if (!wsClient.isAdmin && wsClient.readyState === WebSocket.OPEN) {
            wsClient.send(message);
        }
    });

}
