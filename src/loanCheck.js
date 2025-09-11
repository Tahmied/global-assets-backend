import mongoose from 'mongoose';
import { Loan } from './models/loan.model.js';
import { User } from './models/user.model.js';


// This function adds a notification message to a user's profile.
// It now accepts an optional 'session' parameter to participate in a transaction.
async function addUserNotification(userId, message, session = null) {
    try {
        const user = await User.findById(userId, null, { session });
        if (!user) {
            console.error(`[LoanMonitor] User ${userId} not found for notification.`);
            return;
        }

        user.notification.push({ message, createdAt: new Date() });

        await user.save({ session });
        
    } catch (err) {
        console.error(`[LoanMonitor] Failed to add notification for user ${userId}:`, err);
    }
}


export async function monitorOverdueLoans(processingDelayMs = 0) {
    const now = new Date();
    
    const currentUTCDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    

    const activeLoans = await Loan.find({
        status: { $in: ['Approved', 'Defaulted'] }
    }).lean();

    if (activeLoans.length === 0) {
       
        return;
    }


    for (const loanData of activeLoans) {
        const MAX_RETRIES = 3; 
        let retries = 0;
        let transactionCommittedSuccessfully = false;

        while (retries < MAX_RETRIES && !transactionCommittedSuccessfully) {
            let session = null; 
            try {
                session = await mongoose.startSession();
                session.startTransaction(); 
                const loan = await Loan.findById(loanData._id).session(session);
                const user = await User.findById(loan.userId).session(session);

                
                if (!loan || !user) {
                    console.error(`[LoanMonitor] Loan ${loanData._id} or User ${loanData.userId} not found within transaction. Aborting retries for this loan.`);
                    await session.abortTransaction(); 
                    break;
                }

                let loanChangedInThisAttempt = false;
                let userChangedInThisAttempt = false; 
                // --- 1. Daily Regular Interest Accrual ---
                // Applies to 'Approved' loans, if not disabled, and if a new UTC day has passed
                const lastAccrualDateUTC = loan.lastInterestAccrualDate ?
                    new Date(Date.UTC(loan.lastInterestAccrualDate.getFullYear(), loan.lastInterestAccrualDate.getMonth(), loan.lastInterestAccrualDate.getDate())) : null;

                if (
                    !loan.disableInterestAccrual && 
                    loan.status === 'Approved' &&  
                    (lastAccrualDateUTC === null || lastAccrualDateUTC < currentUTCDate) 
                ) {
                    const dailyInterestAmount = loan.outstandingPrincipal * (loan.dailyInterestRate / 100);

                    if (dailyInterestAmount > 0) {
                        loan.accruedInterest += dailyInterestAmount;
                        user.loanBalance += dailyInterestAmount; 
                        loan.lastInterestAccrualDate = now; 
                        loanChangedInThisAttempt = true;
                        userChangedInThisAttempt = true;
                       
                        await addUserNotification(user._id, `Daily interest (${dailyInterestAmount.toFixed(2)} USD) added to loan ${loan._id}.`, session);
                    }
                }

                // --- 2. Overdue Check & Daily Penalties Accrual ---
                
                const isOverdue = now > loan.dueDate;
                if (isOverdue && !loan.disableLateFeesAccrual) {
                    const lastOverdueChargeDateUTC = loan.lastOverdueChargeDate ?
                        new Date(Date.UTC(loan.lastOverdueChargeDate.getFullYear(), loan.lastOverdueChargeDate.getMonth(), loan.lastOverdueChargeDate.getDate())) : null;

                   
                    if (lastOverdueChargeDateUTC === null || lastOverdueChargeDateUTC < currentUTCDate) {
                        const dailyOverdueInterest = loan.outstandingPrincipal * (0.02 / 100);
                        const dailyLateFee = loan.loanAmount * (2 / 100); 

                        if (dailyOverdueInterest > 0 || dailyLateFee > 0) {
                            loan.overdueInterestAccrued += dailyOverdueInterest;
                            loan.latePaymentFeesAccrued += dailyLateFee;
                            user.loanBalance += (dailyOverdueInterest + dailyLateFee);
                            loan.lastOverdueChargeDate = now; 
                            loanChangedInThisAttempt = true;
                            userChangedInThisAttempt = true;
                            
                            await addUserNotification(user._id, `Your loan ${loan._id} is overdue! Daily late fees and interest have been applied.`, session);
                        }
                    }

                   
                    if (loan.status === 'Approved' && user.accountBalance < user.loanBalance) {
                        loan.status = 'Defaulted';
                        loanChangedInThisAttempt = true;
                        
                        await addUserNotification(user._id, `ALERT: Your loan ${loan._id} has been marked as Defaulted due to insufficient funds and being overdue.`, session);
                    }
                }


             
                if (loanChangedInThisAttempt) {
                    await loan.save({ session });
                }
                if (userChangedInThisAttempt) {
                    await user.save({ session });
                }

                await session.commitTransaction();
                transactionCommittedSuccessfully = true; 

            } catch (err) {
              
                if (session) {
                    await session.abortTransaction();
                    console.error(`[LoanMonitor] Loan ${loanData._id} processing failed. Transaction aborted.`);
                }

                
                if (err.errorLabels && err.errorLabels.includes('TransientTransactionError')) {
                    retries++;
                    console.warn(`[LoanMonitor] TransientTransactionError for loan ${loanData._id}. Retrying (${retries}/${MAX_RETRIES})...`);
                  
                    await new Promise(resolve => setTimeout(resolve, 50 * retries));
                } else {
                  
                    console.error(`[LoanMonitor] Non-transient error processing loan ${loanData._id}:`, err);
                   
                    break;
                }
            } finally {
                
                if (session) {
                    session.endSession();
                }
            }
        } 
        
        if (!transactionCommittedSuccessfully) {
            console.error(`[LoanMonitor] Loan ${loanData._id} failed after ${MAX_RETRIES} retries. Manual intervention may be required.`);
           
            await addUserNotification(loanData.userId, `CRITICAL: You don't have sufficient account balance. You must have a certain amount of account balance to take loans.`, null);
        }

        if (processingDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, processingDelayMs));
        }
    }
    
}



export function startLoanMonitor(intervalMs = 0, processingDelayMs = 200) {
    
    setTimeout(() => {
        monitorOverdueLoans(processingDelayMs).catch(err => {
            console.error('[LoanMonitor] Initial cycle error:', err);
        });
    }, 1500);
    if (intervalMs && intervalMs > 0) {
        setInterval(() => {
            monitorOverdueLoans(processingDelayMs).catch(err => {
                console.error('[LoanMonitor] Cycle error:', err);
            });
        }, intervalMs);
        
    } else {
    }
}