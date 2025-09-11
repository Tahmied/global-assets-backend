import { Transaction } from '../models/transaction.model.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getUserTransactionHistory = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const { page = 1, limit = 20 } = req.query;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { createdAt: -1 }
    };

    const transactions = await Transaction.find({ userId })
        .sort(options.sort)
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .lean();

    const totalTransactions = await Transaction.countDocuments({ userId });
    const lastPage = Math.ceil(totalTransactions / options.limit);

    res.status(200).json(
        new ApiResponse(
            200,
            {
                transactions,
                total: totalTransactions,
                page: options.page,
                limit: options.limit,
                lastPage
            },
            'Transaction history fetched successfully.'
        )
    );
});

export { getUserTransactionHistory };
