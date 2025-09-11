// src/tradeWebSocketService.js

import mongoose from 'mongoose';
import { WebSocket, WebSocketServer } from 'ws';
import { User } from './models/user.model.js';
import { UserOptionTrade } from './models/UserOptionTrade.model.js';

let wss;
const adminClients = new Set();
let changeStream;

// Helper function to populate user information
async function populateUserInfo(tradeData) {
    try {
        if (tradeData.userId && typeof tradeData.userId === 'object') {
            if (!tradeData.userId.email) {
                const user = await User.findById(tradeData.userId._id).select('email username userType').lean();
                if (user) tradeData.userId = user;
            }
        } else if (typeof tradeData.userId === 'string') {
            const user = await User.findById(tradeData.userId).select('email username userType').lean();
            if (user) tradeData.userId = user;
        } else {
            tradeData.userId = null;
        }
    } catch (err) {
        console.error(`Error populating user info: ${err.message}`);
        tradeData.userId = null;
    }
    return tradeData;
}

export function initializeTradeWebSocketServer(httpServer) {
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', async (ws) => {
        adminClients.add(ws);

        try {
            let activeTrades = await UserOptionTrade.find({ status: 'Active' }).populate('userId', 'email username userType');
            activeTrades = await Promise.all(activeTrades.map(trade => populateUserInfo(trade.toObject()))); // Ensure population

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'initialTrades',
                    trades: activeTrades
                }));
            }
        } catch (error) {
            console.error(`WebSocket initialization error: ${error.message}`);
            ws.terminate();
            adminClients.delete(ws);
        }

        ws.on('message', message => {
            try {
                const data = JSON.parse(message);
            } catch (err) {
                console.error('Invalid JSON from admin client:', err.message);
            }
        });

        ws.on('close', (code, reason) => {
            adminClients.delete(ws);
        });

        ws.on('error', error => {
            console.error(`WebSocket error for admin client: ${error.message}`);
            ws.terminate();
            adminClients.delete(ws);
        });
    });

    // Periodically clean up stale/non-responsive clients
    setInterval(() => {
        for (const ws of adminClients) {
            if (ws.readyState !== WebSocket.OPEN) {
                adminClients.delete(ws);
            }
        }
    }, 30000); // Check every 30 seconds

    startTradeChangeStream();
    return wss;
}

async function startTradeChangeStream() {
    if (mongoose.connection.readyState !== 1) {
        setTimeout(startTradeChangeStream, 3000);
        return;
    }

    try {
        const pipeline = [
            {
                $match: {
                    operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
                }
            },
            {
                $project: {
                    '_id': 1,
                    'operationType': 1,
                    'fullDocument': 1,
                    'fullDocumentBeforeChange': 1,
                    'ns': 1,
                    'documentKey': 1,
                    'updateDescription': 1
                }
            }
        ];

        changeStream = UserOptionTrade.watch(pipeline, { fullDocument: 'updateLookup' });

        changeStream.on('change', async (change) => {
            let eventType;
            let tradeData;

            if (change.operationType === 'insert') {
                eventType = 'tradeCreated';
                tradeData = change.fullDocument;
            } else if (change.operationType === 'update' || change.operationType === 'replace') {
                eventType = 'tradeUpdated';
                tradeData = change.fullDocument;

                if (change.updateDescription && change.updateDescription.updatedFields &&
                    (change.updateDescription.updatedFields.status === 'Expired_Win' ||
                     change.updateDescription.updatedFields.status === 'Expired_Loss')) {
                    eventType = 'tradeSettled';
                }
            } else if (change.operationType === 'delete') {
                eventType = 'tradeDeleted';
                // For delete, fullDocument is null. Use documentKey and try to get userId if available
                tradeData = {
                    _id: change.documentKey._id,
                    status: 'Deleted',
                    // userId might be available in fullDocumentBeforeChange if configured on collection
                    // For now, we'll assume it's not readily available here without extra config
                    // If you need userId for deleted trades, you'd need to enable 'changeStreamPreAndPostImages' on the collection
                    // db.runCommand({ collMod: "useroptiontrades", changeStreamPreAndPostImages: { enabled: true } })
                };
            }

            if (tradeData) {
                tradeData = await populateUserInfo(tradeData); // Use the shared helper
                broadcastOptionTradeUpdate(tradeData, eventType);
            }
        });

        changeStream.on('error', (error) => {
            console.error(`MongoDB Change Stream encountered an ERROR:`, error);
            if (changeStream) {
                changeStream.close();
            }
            setTimeout(startTradeChangeStream, 5000);
        });

        changeStream.on('close', () => {
            console.warn('MongoDB Change Stream closed. Attempting to restart...');
            setTimeout(startTradeChangeStream, 5000);
        });
    } catch (error) {
        console.error(`Failed to start MongoDB Change Stream (synchronous error during watch setup): ${error.message}`);
        setTimeout(startTradeChangeStream, 10000);
    }
}

export async function broadcastOptionTradeUpdate(tradeDoc, eventType) {
    let tradeData = typeof tradeDoc.toObject === 'function'
        ? tradeDoc.toObject()
        : { ...tradeDoc };

    tradeData = await populateUserInfo(tradeData); // Use the shared helper

    const message = JSON.stringify({
        type: eventType,
        trade: tradeData
    });

    for (const ws of adminClients) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
            } catch (err) {
                console.error(`Failed to send message: ${err.message}`);
                ws.terminate();
                adminClients.delete(ws);
            }
        } else {
            adminClients.delete(ws);
        }
    }
}