import { AIRobotInvestmentOrder } from './models/AIRobotInvestmentOrder.model.js';
import { User } from './models/user.model.js';

async function addUserNotification(userId, message) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`[AIRobotMonitor] User ${userId} not found when trying to add notification.`);
            return;
        }
        user.notification.push({
            message: message,
            createdAt: new Date()
        });
        await user.save();
    } catch (err) {
        console.error(`[AIRobotMonitor] Failed to add notification for user ${userId}:`, err);
    }
}

function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min;
}

export async function monitorAIRobotInvestments() {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    
    const runningOrders = await AIRobotInvestmentOrder.find({
        status: 'Running'
    }).lean();

    if (runningOrders.length === 0) {
        return;
    }


    for (const order of runningOrders) {
        try {
            const user = await User.findById(order.userId);

            if (!user) {
                console.error(`[AIRobotMonitor] User ${order.userId} not found for order ${order._id}. Skipping.`);
                continue;
            }

            // --- 1. Check for Daily Profit Distribution ---
            // Determine the last date a profit was distributed (or start date for first distribution)
            const lastDistributionDate = order.lastProfitDistributionDate || order.startTime;
            const lastDistributionUTC = new Date(Date.UTC(
                lastDistributionDate.getUTCFullYear(),
                lastDistributionDate.getUTCMonth(),
                lastDistributionDate.getUTCDate()
            ));

            const shouldDistributeProfit = todayUTC > lastDistributionUTC;
            const isBeforeEndTime = now < order.endTime;

            if (shouldDistributeProfit && isBeforeEndTime) {
                const dailyReturnPercentage = getRandomNumber(order.minDailyReturnPercentage, order.maxDailyReturnPercentage);
                const dailyProfit = order.investmentAmount * (dailyReturnPercentage / 100);
                user.accountBalance += dailyProfit;
                await user.save();

                order.totalProfitEarned += dailyProfit;
                order.dailyRevenueHistory.push({
                    date: now,
                    amount: dailyProfit
                });
                order.lastProfitDistributionDate = now;

                await AIRobotInvestmentOrder.findByIdAndUpdate(
                    order._id,
                    {
                        $set: {
                            totalProfitEarned: order.totalProfitEarned,
                            lastProfitDistributionDate: order.lastProfitDistributionDate,
                        },
                        $push: {
                            dailyRevenueHistory: { date: now, amount: dailyProfit }
                        }
                    },
                    { new: true }
                );

                await addUserNotification(user._id, `AI Robot: Your order ${order._id.toString().slice(-4)} profited ${dailyProfit.toFixed(2)} USD today. Total profit: ${order.totalProfitEarned.toFixed(2)} USD.`);

            } else if (!isBeforeEndTime && order.status === 'Running') {
                 // --- 2. Check for Order Completion ---
              

                 await AIRobotInvestmentOrder.findByIdAndUpdate(
                     order._id,
                     { $set: { status: 'Completed' } },
                     { new: true }
                 );

                 await addUserNotification(user._id, `AI Robot: Your investment order ${order._id.toString().slice(-4)} has completed its ${order.cycleDurationDays}-day cycle.`);
            } else {
                // No distribution needed yet, or already completed/redeemed
            }

        } catch (err) {
            console.error(`[AIRobotMonitor] Unhandled error processing order ${order._id}:`, err);
        }
    }

}


export function startAIRobotMonitor(intervalMs = 10000) { 
    monitorAIRobotInvestments().catch(err => {
        console.error('[AIRobotMonitor] Initial cycle error:', err);
    });
    setInterval(() => {
        monitorAIRobotInvestments().catch(err => {
            console.error('[AIRobotMonitor] Cycle error:', err);
        });
    }, intervalMs);
}
