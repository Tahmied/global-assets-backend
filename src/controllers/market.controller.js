import { CryptoAsset } from '../models/assets.model.js';
import { CryptoHistoricalData } from '../models/crypto-historical-data.model.js';
import { siteSettings } from '../models/siteSettings.model.js';
import { Transaction } from '../models/transaction.model.js';
import { TwdataAsset } from '../models/twdata.models.js';
import { User } from '../models/user.model.js';
import { ContractPosition } from '../models/UserContractTrade.model.js';
import { UserOptionTrade } from '../models/UserOptionTrade.model.js';
import { getCachedPrice, subscribeSymbol } from '../priceService.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from "../utils/asyncHandler.js";


import fetch from 'node-fetch';

function calculateLiquidationPrice(openingPrice, leverage, direction, maintenanceMarginPct) {
  const mm = maintenanceMarginPct;

  if (direction === 'Buy') { 
    return openingPrice * (1 - (1 / leverage) + mm);
  } else if (direction === 'Sell') { 
    return openingPrice * (1 + (1 / leverage) - mm); 
  } else {
     console.error("Invalid direction passed to calculateLiquidationPrice:", direction);
     return 0; 
  }
}

function getDurationKey(durationSeconds) {
    if (durationSeconds === 120) return '120s';
    if (durationSeconds === 180) return '180s';
    if (durationSeconds === 300) return '300s';
    if (durationSeconds === (3 * 24 * 60 * 60)) return '3_days'; 
    if (durationSeconds === (10 * 24 * 60 * 60)) return '10_days';
    if (durationSeconds === (15 * 24 * 60 * 60)) return '15_days';
    return `${durationSeconds}s`; 
}


const assets = asyncHandler(async (req, res) => {
    // 1. Parse Pagination Parameters
    // Default limit to 100, start to 1 if not provided or invalid
    const limit = parseInt(req.query.limit, 10) || 100;
    const start = parseInt(req.query.start, 10) || 1;

    // Ensure limit and start are positive
    if (limit <= 0 || start <= 0) {
        return res.status(400).json(new ApiResponse(400, null, 'Limit and start must be positive integers'));
    }

    const skip = start - 1; // Calculate how many documents to skip


    try {
        // 2. Query MongoDB for Paginated Assets
        const assetsData = await CryptoAsset.find({})
            .sort({ rank: 1 }) // Sort by CoinMarketCap rank ascending
            .skip(skip)
            .limit(limit)
            .select('cmc_id symbol name rank price percent_change_24h logo_url sparkline_10d') // Select necessary fields
            .lean(); // Use .lean() for faster retrieval of plain JS objects

        // 3. Get Total Count for Pagination Metadata
        const totalCount = await CryptoAsset.countDocuments({}); // Count all documents in the collection

        // 4. Format Response Payload
        const payload = {
            assets: assetsData.map(asset => ({ // Map to match frontend expected field names if necessary (e.g., id instead of _id or cmc_id)
                id: asset.cmc_id, // Frontend might prefer 'id'
                cmc_id: asset.cmc_id,
                symbol: asset.symbol,
                name: asset.name,
                rank: asset.rank,
                price: asset.price,
                percent_change_24h: asset.percent_change_24h,
                logo: asset.logo_url, // Frontend might prefer 'logo'
                sparkline: asset.sparkline_10d, // Frontend might prefer 'sparkline'
            })),
            totalCount: totalCount,
            limit: limit,
            currentPage: Math.floor(skip / limit) + 1, // Calculate current page number
        };

        // 5. Send Success Response
        res.status(200).json(new ApiResponse(200, payload, 'Assets fetched successfully'));

    } catch (error) {
        console.error('Error fetching assets from DB:', error);
        // 6. Send Error Response
        res.status(500).json(new ApiResponse(500, null, 'Failed to fetch assets'));
    }
});


const assetHistory = asyncHandler(async (req, res) => {
    console.log('API Hit: /api/assets/:id/history');

    // 1. Get Asset ID from URL
    const cmcId = parseInt(req.params.id, 10);

    // Validate the ID
    if (isNaN(cmcId)) {
        return res.status(400).json(new ApiResponse(400, null, 'Invalid asset ID'));
    }

    // 2. Determine Date Range
    let startDate, endDate;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of today UTC

    if (req.query.range) {
        // Calculate date range based on 'range' parameter (e.g., '90d', '1y')
        const range = req.query.range.toLowerCase();
        startDate = new Date(today); // Start calculating from today

        switch (range) {
            case '7d': // Last 7 days
                 startDate.setUTCDate(today.getUTCDate() - 7);
                 break;
            case '30d': // Last 30 days
                startDate.setUTCDate(today.getUTCDate() - 30);
                break;
            case '90d': // Last 90 days
                startDate.setUTCDate(today.getUTCDate() - 90);
                break;
            case '1y': // Last 1 year
                startDate.setUTCFullYear(today.getUTCFullYear() - 1);
                break;
            case 'all': // Fetch all available history (no start date filter)
                startDate = null; // Remove start date filter
                break;
            default:
                // Default to 90 days if range is invalid or not provided
                console.warn(`Invalid or unknown range parameter: ${req.query.range}. Defaulting to 90 days.`);
                startDate.setUTCDate(today.getUTCDate() - 90);
                break;
        }

        endDate = new Date(today); // End date is the start of today UTC

    } else if (req.query.startDate || req.query.endDate) {
        // Use explicit start and end dates
        if (req.query.startDate) {
             startDate = new Date(req.query.startDate);
             // Set to start of the day UTC
             startDate.setUTCHours(0, 0, 0, 0);
             // Basic validation
             if (isNaN(startDate.getTime())) {
                 return res.status(400).json(new ApiResponse(400, null, 'Invalid start date format'));
             }
        } else {
            startDate = null; // No start date filter
        }

        if (req.query.endDate) {
             endDate = new Date(req.query.endDate);
             // Set to end of the day UTC (start of next day - 1 ms)
             endDate.setUTCDate(endDate.getUTCDate() + 1);
             endDate.setUTCHours(0, 0, 0, 0);
             endDate = new Date(endDate.getTime() - 1);
             // Basic validation
             if (isNaN(endDate.getTime())) {
                 return res.status(400).json(new ApiResponse(400, null, 'Invalid end date format'));
             }
        } else {
             // If only startDate is provided, default end date to today
             endDate = new Date(today.getTime() - 1); // Start of today - 1ms (end of yesterday)
        }

    } else {
      
        console.log('No range or start/end date provided. Defaulting to last 90 days.');
        startDate = new Date(today);
        startDate.setUTCDate(today.getUTCDate() - 90);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(today.getTime() - 1); // End of yesterday UTC
    }

    // Ensure startDate is not after endDate if both are set
    if (startDate && endDate && startDate > endDate) {
        return res.status(400).json(new ApiResponse(400, null, 'Start date cannot be after end date'));
    }


    try {
        // 3. Query MongoDB for Historical Data
        const query = CryptoHistoricalData.find({
            cmc_id: cmcId, // Filter by asset ID
            // Apply date range filter if dates are valid
            ...(startDate && endDate && { timestamp: { $gte: startDate, $lte: endDate } }),
            ...(startDate && !endDate && { timestamp: { $gte: startDate } }),
            ...(!startDate && endDate && { timestamp: { $lte: endDate } }),
             // If neither start nor end is set (range='all'), no timestamp filter is added here
        })
        .sort({ timestamp: 1 }) // Sort by timestamp ascending (oldest to newest)
        .select('timestamp open high low close volume') // Select necessary fields
        .lean(); // Use .lean()

        const historyData = await query.exec();

        // 4. Format and Send Response (usually just the array of data points)
        // You might want to format the timestamp differently for the frontend
        const formattedHistory = historyData.map(point => ({
            timestamp: point.timestamp.toISOString(), // Send timestamp as ISO string
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
        }));

        res.status(200).json(new ApiResponse(200, formattedHistory, `Historical data fetched successfully for ID ${cmcId}`));

    } catch (error) {
        console.error(`Error fetching historical data for ID ${cmcId}:`, error);
        res.status(500).json(new ApiResponse(500, null, `Failed to fetch historical data for ID ${cmcId}`));
    }
});

const getTwdAssets = asyncHandler(async (req, res) => {
    // Extract query parameters for category, page, and limit
    const { category, page = 1, limit = 10 } = req.query; // Default to page 1, limit 10

    // Validate category parameter
    if (!category) {
        throw new ApiError(400, 'Category query parameter is required.');
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Ensure page and limit are valid numbers
    if (isNaN(pageNumber) || pageNumber <= 0) {
        throw new ApiError(400, 'Invalid page number.');
    }
    if (isNaN(limitNumber) || limitNumber <= 0) {
         // You might set a max limit here as well, e.g., limitNumber = Math.min(limitNumber, 100);
        throw new ApiError(400, 'Invalid limit number.');
    }


    try {
        // Calculate the number of documents to skip for pagination
        const skip = (pageNumber - 1) * limitNumber;

        // Find assets for the specified category, sorted by rank
        const twdAssets = await TwdataAsset.find({ category })
            .sort({ rank_in_category: 1 }) // Sort by the rank assigned by the sync script (1-100)
            .skip(skip)
            .limit(limitNumber)
            // Select only the fields needed for the frontend list view
            .select('symbol display_name category logo_url current_price price_change_24h_percent sparkline_values sparkline_positive'); // Exclude rank_in_category and is_top_40 from the response


        // Get the total count of documents for the category to calculate total pages
        const totalAssets = await TwdataAsset.countDocuments({ category });

        // Calculate total pages
        const totalPages = Math.ceil(totalAssets / limitNumber);

        // Return the data using your ApiResponse structure
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    assets: twdAssets,
                    total: totalAssets,
                    page: pageNumber,
                    limit: limitNumber,
                    totalPages: totalPages,
                },
                `Successfully fetched ${category} assets.`
            )
        );

    } catch (error) {
        // Handle database errors or other unexpected issues
        console.error(`Error fetching TwdataAssets for category ${category}:`, error);
        // Use ApiError for consistency
        throw new ApiError(500, error.message || 'Internal server error fetching assets');
    }
});

const getAssetDetails = asyncHandler(async (req, res) => {
    const { symbol, type, interval = '1min', outputsize = '100' } = req.query
  
    // 1) Validate required query params
    if (!symbol) {
      throw new ApiError(400, 'symbol query parameter is required.')
    }
    if (!type) {
      throw new ApiError(400, 'type query parameter is required.')
    }
  
    // 2) Fetch current quote / summary
    const quoteUrl = new URL('https://api.twelvedata.com/quote')
    quoteUrl.searchParams.set('symbol', symbol)
    quoteUrl.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY)
  
    const quoteRes = await fetch(quoteUrl.toString())
    const quoteData = await quoteRes.json()
    if (quoteData.status === 'error') {
      throw new ApiError(502, `TwelveData quote error: ${quoteData.message}`)
    }
  
    // 3) Fetch historical time series
    const tsUrl = new URL('https://api.twelvedata.com/time_series')
    tsUrl.searchParams.set('symbol', symbol)
    tsUrl.searchParams.set('interval', interval)
    tsUrl.searchParams.set('outputsize', outputsize)
    tsUrl.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY)
  
    const tsRes = await fetch(tsUrl.toString())
    const tsData = await tsRes.json()
    if (tsData.status === 'error') {
      throw new ApiError(502, `TwelveData time_series error: ${tsData.message}`)
    }
  
    // 4) Normalize payloads
    const summary = {
        symbol:        quoteData.symbol,
        name:          quoteData.name,
        currency:      quoteData.currency,
        // use `close`, not `price`
        price:         parseFloat(quoteData.close),
        changePercent: parseFloat(quoteData.percent_change),
        high:          parseFloat(quoteData.high),
        low:           parseFloat(quoteData.low),
        close:         parseFloat(quoteData.close),
        // only parse if present
        volume:        quoteData.volume != null
                         ? parseFloat(quoteData.volume)
                         : null,
        timestamp:     quoteData.timestamp,
      }
  
      const history = tsData.values.map(point => ({
        datetime: point.datetime,
        open:     parseFloat(point.open),
        high:     parseFloat(point.high),
        low:      parseFloat(point.low),
        close:    parseFloat(point.close),
        volume:   point.volume != null
                     ? parseFloat(point.volume)
                     : null,
      }))
      
  
    // 5) If user is logged in (via your auth middleware), fetch their open positions
    let positions = []
    if (req.user && req.user.id) {
      positions = await Position.find({
        userId: req.user.id,
        symbol,
        status: 'OPEN'
      }).select('symbol size entryPrice leverage unrealizedPnl takeProfit stopLoss margin fees')
    }
  
    // 6) (Optional) Order book stub — you can integrate your own order-book service here
    const orderBook = {
      bids: [],  // e.g. [{ price: 10200, size: 1.5 }, …]
      asks: []   // …
    }
  
    // 7) Return unified response
    return res
      .status(200)
      .json(new ApiResponse(
        200,
        { summary, history, positions, orderBook },
        `Fetched asset details for ${symbol}.`
      ))
})

// binary option trading

const resolveExpiredTrades = asyncHandler(async (userId) => {
    const now = new Date();

    const expiredTrades = await UserOptionTrade.find({
        userId,
        status: 'Active',
        expiryTime: { $lte: now }
    });

    if (!expiredTrades.length) return;

    for (const trade of expiredTrades) {
        try {
            subscribeSymbol(trade.assetPair);
            let actualExpiryPrice = getCachedPrice(trade.assetPair);

            if (actualExpiryPrice == null) {
                try {
                    const tsUrl = new URL('https://api.twelvedata.com/time_series');
                    tsUrl.searchParams.set('symbol', trade.assetPair);
                    tsUrl.searchParams.set('interval', '1min');
                    tsUrl.searchParams.set('outputsize', '1');
                    tsUrl.searchParams.set('end_date', trade.expiryTime.toISOString());
                    tsUrl.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);

                    const tsRes = await fetch(tsUrl.toString());
                    const tsData = await tsRes.json();
                    if (tsData.status === 'error' || !tsData.values || tsData.values.length === 0) {
                        console.error(`[resolveExpiredTrades] TwelveData time_series error for ${trade.assetPair}:`, tsData.message || 'No data found');
                        continue;
                    }
                    actualExpiryPrice = parseFloat(tsData.values[0].close);
                } catch (err) {
                    console.error(`[resolveExpiredTrades] HTTP fallback failed for trade ${trade._id}:`, err);
                    continue;
                }
            }

            let finalOutcome; // 'Win' or 'Loss'
            let totalCreditAmount = 0; // Total amount to credit back to user (principal + profit)
            let priceForDisplay = actualExpiryPrice; // Price to store in expiryPrice

            // Determine outcome based on admin control or market
            if (trade.adminControlledOutcome === 'Profit') {
                finalOutcome = 'Win';
                const profit = trade.investmentAmount * (trade.returnPercentage / 100);
                totalCreditAmount = trade.investmentAmount + profit;
                // Synthesize expiryPrice for display (small move in winning direction)
                priceForDisplay = trade.openingPrice * (trade.direction === 'Bullish' ? 1.0005 : 0.9995);
                await Transaction.create({
                    userId: trade.userId,
                    amount: totalCreditAmount,
                    type: 'credit',
                    description: `Trade payout for ${trade.assetPair}`,
                    referenceId: trade._id,
                    category: 'trading',
                    status: 'completed'
                });
            } else if (trade.adminControlledOutcome === 'Loss') {
                finalOutcome = 'Loss';
                totalCreditAmount = 0; // Principal is lost
                // Synthesize expiryPrice for display (small move in losing direction)
                priceForDisplay = trade.openingPrice * (trade.direction === 'Bullish' ? 0.9995 : 1.0005);
                await Transaction.create({
                    userId: trade.userId,
                    amount: trade.investmentAmount,
                    type: 'debit',
                    description: `Trade loss for ${trade.assetPair}`,
                    referenceId: trade._id,
                    category: 'trading',
                    status: 'completed'
                });

            } else if (trade.adminControlledOutcome === 'Default') {
                const isWin = Math.random() < 0.5; // 50% chance for random win/loss
                if (isWin) {
                    finalOutcome = 'Win';
                    const profit = trade.investmentAmount * (trade.returnPercentage / 100);
                    totalCreditAmount = trade.investmentAmount + profit;
                    priceForDisplay = trade.openingPrice * (trade.direction === 'Bullish' ? 1.0005 : 0.9995);
                    await Transaction.create({
                        userId: trade.userId,
                        amount: totalCreditAmount,
                        type: 'credit',
                        description: `Trade payout for ${trade.assetPair} `,
                        referenceId: trade._id,
                        category: 'trading',
                        status: 'completed'
                    });
                } else {
                    finalOutcome = 'Loss';
                    totalCreditAmount = 0;
                    priceForDisplay = trade.openingPrice * (trade.direction === 'Bullish' ? 0.9995 : 1.0005);
                    await Transaction.create({
                        userId: trade.userId,
                        amount: trade.investmentAmount,
                        type: 'debit',
                        description: `Trade loss for ${trade.assetPair}`,
                        referenceId: trade._id,
                        category: 'trading',
                        status: 'completed'
                    });
                }
            } else {
                // No admin intervention (adminControlledOutcome is null) - Use market logic
                const winByMarket = (
                    (trade.direction === 'Bullish' && actualExpiryPrice > trade.openingPrice) ||
                    (trade.direction === 'Bearish' && actualExpiryPrice < trade.openingPrice)
                );

                if (winByMarket) {
                    finalOutcome = 'Win';
                    const profit = trade.investmentAmount * (trade.returnPercentage / 100);
                    totalCreditAmount = trade.investmentAmount + profit;
                    await Transaction.create({
                        userId: trade.userId,
                        amount: totalCreditAmount,
                        type: 'credit',
                        description: `Trade payout for ${trade.assetPair}`,
                        referenceId: trade._id,
                        category: 'trading',
                        status: 'completed'
                    });
                } else {
                    finalOutcome = 'Loss';
                    totalCreditAmount = 0;
                    await Transaction.create({
                        userId: trade.userId,
                        amount: trade.investmentAmount,
                        type: 'debit',
                        description: `Trade loss for ${trade.assetPair}`,
                        referenceId: trade._id,
                        category: 'trading',
                        status: 'completed'
                    });
                }
                priceForDisplay = actualExpiryPrice; 
            }

            // Atomically mark the trade resolved
            const updateRes = await UserOptionTrade.updateOne(
                { _id: trade._id, status: 'Active' },
                {
                    $set: {
                        status:       finalOutcome === 'Win' ? 'Expired_Win'  : 'Expired_Loss',
                        outcome:      finalOutcome,
                        expiryPrice:  priceForDisplay,
                        payoutAmount: totalCreditAmount
                    }
                }
            );

            if (updateRes.matchedCount === 0) {
                console.warn(`[resolveExpiredTrades] Trade ${trade._id} already processed or status changed concurrently.`);
                continue;
            }

            // Unlock funds & credit payout to the user's wallet
            try {
                await User.updateOne(
                    { _id: userId },
                    {
                        $inc: {
                            lockedBalance:  -trade.investmentAmount,
                            accountBalance:  totalCreditAmount
                        }
                    }
                );
                console.log(`[resolveExpiredTrades] User ${userId} trade ${trade._id} settled as ${finalOutcome}. Payout: ${totalCreditAmount}`);
            } catch (err) {
                console.error(`[resolveExpiredTrades] Failed to update wallet for user ${userId} after resolving trade ${trade._id}:`, err);
                // Consider robust error handling/reconciliation for balance discrepancies
            }
        } catch (err) {
            console.error(`[resolveExpiredTrades] Error processing trade ${trade._id}:`, err);
        }
    }
});

const placeOptionTrade = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { assetPair, durationSeconds, investmentAmount, direction } = req.body;

    // 1) Payload validation
    if (!assetPair || !durationSeconds || !investmentAmount || !direction) {
        throw new ApiError(400, 'assetPair, durationSeconds, investmentAmount, and direction are all required.');
    }
    if (investmentAmount <= 0) {
        throw new ApiError(400, 'investmentAmount must be greater than 0.');
    }
    if (!['Bullish', 'Bearish'].includes(direction)) {
        throw new ApiError(400, 'direction must be "Bullish" or "Bearish".');
    }

    // --- NEW LOGIC: Fetch profit rate from siteSettings ---
    const settings = await siteSettings.findOne({});
    if (!settings || !settings.optionProfitRates) {
        throw new ApiError(500, 'Site settings or option profit rates not configured.');
    }

    const durationKey = getDurationKey(durationSeconds); // Use the helper function
    const returnPercentage = settings.optionProfitRates.get(durationKey);

    if (typeof returnPercentage === 'undefined' || returnPercentage === null) {
        throw new ApiError(400, `Profit rate not defined for duration: ${durationKey}. Please check site settings.`);
    }
    // --- END NEW LOGIC ---

    // 2) Settle any expired trades first (existing logic)
    await resolveExpiredTrades(userId);

    // 3) Load user & check balance (existing logic)
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found.');
    if (investmentAmount > user.accountBalance) {
        throw new ApiError(400, 'Insufficient available balance.');
    }

    // 4) Lock funds immediately (existing logic)
    user.accountBalance -= investmentAmount;
    user.lockedBalance += investmentAmount;
    await user.save();
    await Transaction.create({
        userId: user._id,
        amount: investmentAmount,
        type: 'debit',
        description: `Option trade placed for ${assetPair}`,
        referenceId: null, 
        category: 'trading',
        status: 'completed'
    });

    // 5) Fetch openingPrice via WS cache, fallback to HTTP (existing logic)
    subscribeSymbol(assetPair);
    let openingPrice = getCachedPrice(assetPair);
    if (openingPrice == null) {
        const quoteUrl = new URL('https://api.twelvedata.com/quote');
        quoteUrl.searchParams.set('symbol', assetPair);
        quoteUrl.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);
        const quoteRes = await fetch(quoteUrl.toString());
        const quoteData = await quoteRes.json();
        if (quoteData.status === 'error') {
            // refund locked funds on error
            await User.updateOne(
                { _id: userId },
                { $inc: { accountBalance: investmentAmount, lockedBalance: -investmentAmount } }
            );
            throw new ApiError(502, `TwelveData quote error: ${quoteData.message}`);
        }
        openingPrice = parseFloat(quoteData.close);
    }

    // 6) Compute expiry timestamp (existing logic)
    const purchaseTime = new Date();
    const expiryTime = new Date(purchaseTime.getTime() + durationSeconds * 1000);

    // 7) Get payout percentage (OLD: was here, now moved above)

    // 8) Create trade record (with compensating refund on failure)
    let trade;
    try {
        trade = await UserOptionTrade.create({
            userId,
            assetPair,
            direction,
            investmentAmount,
            openingPrice,
            purchaseTime,
            durationSeconds,
            expiryTime,
            returnPercentage // THIS IS THE UPDATED ASSIGNMENT
        });
    } catch (err) {
        // refund if creation fails
        await User.updateOne(
            { _id: userId },
            { $inc: { accountBalance: investmentAmount, lockedBalance: -investmentAmount } }
        );
        throw err;
    }

    // 9) Respond (existing logic)
    res.status(200).json(new ApiResponse(
        200,
        {
            tradeId: trade._id,
            openingPrice,
            expiryTime,
            returnPercentage // Ensure this is returned in the response for frontend
        },
        'Option trade placed successfully.'
    ));
});

const getUserOptionTrades = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1) Settle expired trades first
  await resolveExpiredTrades(userId);

  // 2) Reload user & fetch last 20 trades
  const user   = await User.findById(userId);
  const trades = await UserOptionTrade
    .find({ userId })
    .sort({ purchaseTime: -1 })
    .limit(20);

  // 3) Return data
  res.status(200).json(new ApiResponse(
    200,
    {
      accountBalance: user.accountBalance,
      lockedBalance:  user.lockedBalance,
      totalBalance:   user.accountBalance + user.lockedBalance,
      trades
    },
    'Fetched wallet and option trades.'
  ));
});

const addInvestmentToOptionTrade = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const tradeId = req.params.id;
    const { additionalAmount } = req.body;

    if (additionalAmount === undefined || additionalAmount === null) {
        throw new ApiError(400, 'additionalAmount is required.');
    }

    const parsedAdditionalAmount = parseFloat(additionalAmount);

    if (isNaN(parsedAdditionalAmount) || parsedAdditionalAmount <= 0) {
        throw new ApiError(400, 'Invalid additionalAmount. Must be a positive number.');
    }

    const trade = await UserOptionTrade.findOne({ _id: tradeId, userId });

    if (!trade) {
        throw new ApiError(404, 'Option trade not found.');
    }

    if (trade.status !== 'Active') {
        throw new ApiError(400, `Cannot add investment to a trade with status: ${trade.status}. Only 'Active' trades can be modified.`);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(500, 'User associated with trade not found.');
    }

    if (user.accountBalance < parsedAdditionalAmount) {
        throw new ApiError(400, 'Insufficient available balance to add this investment.');
    }

    const userUpdateResult = await User.updateOne(
        { _id: userId, accountBalance: { $gte: parsedAdditionalAmount } },
        {
            $inc: {
                accountBalance: -parsedAdditionalAmount,
                lockedBalance: parsedAdditionalAmount
            }
        }
    );

    if (userUpdateResult.matchedCount === 0) {
        throw new ApiError(400, 'Failed to lock funds for additional investment. Please try again.');
    }

    try {
        const tradeUpdateResult = await UserOptionTrade.updateOne(
            { _id: tradeId, userId, status: 'Active' },
            {
                $inc: {
                    investmentAmount: parsedAdditionalAmount
                }
            }
        );

        if (tradeUpdateResult.matchedCount === 0) {
             // Trade might have expired or been updated concurrently
             // CRITICAL: User balance was updated, but trade was NOT. Need to refund user.
             console.error(`[addInvestmentToOptionTrade] Failed to update trade ${tradeId} for user ${userId} after wallet update.`);
             try {
                  await User.updateOne(
                      { _id: userId },
                      { $inc: { accountBalance: parsedAdditionalAmount, lockedBalance: -parsedAdditionalAmount } }
                  );
                  console.log(`[addInvestmentToOptionTrade] Successfully refunded funds for user ${userId} after trade update failure.`);
             } catch (refundErr) {
                  console.error(`[addInvestmentToOptionTrade] CRITICAL: Failed to refund funds for user ${userId} after trade update failure! Funds may be stuck.`, refundErr);
             }
             throw new ApiError(500, 'Failed to update trade. Please try again.');
        }

        const updatedTrade = await UserOptionTrade.findById(tradeId); // Fetch the updated trade to return in response

        res.status(200).json(new ApiResponse(
            200,
            {
                trade: updatedTrade,
                addedAmount: parsedAdditionalAmount
            },
            'Investment added to option trade successfully.'
        ));

    } catch (err) {
        // If an error occurred during the trade update (after successful user update)
        console.error(`[addInvestmentToOptionTrade] Error during trade update for ${tradeId}:`, err);
        // The refund logic is inside the catch block above, so it should be attempted.
        throw new ApiError(500, 'Failed to update trade. Please try again.');
    }
});


// contract trading

const placeContractTrade = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    assetPair,
    direction,       // 'Buy' or 'Sell'
    quantity,        // number of contracts
    leverage,        // e.g. 20
    type = 'market', // 'market' or 'limit'
    limitPrice = null,
    takeProfitPrice = null,
    stopLossPrice  = null
  } = req.body;

  // 1) Validate required fields
  if (!assetPair || !direction || !quantity || !leverage) {
    throw new ApiError(400, 'assetPair, direction, quantity and leverage are all required.');
  }
  if (!['Buy','Sell'].includes(direction)) {
    throw new ApiError(400, 'direction must be "Buy" or "Sell".');
  }
  if (quantity <= 0 || leverage < 1) {
    throw new ApiError(400, 'quantity must be > 0 and leverage ≥ 1.');
  }
  if (type === 'limit' && !limitPrice) {
    throw new ApiError(400, 'limitPrice is required for limit orders.');
  }

  // 2) Attempt to get openingPrice from WebSocket cache
  subscribeSymbol(assetPair);
  let openingPrice = getCachedPrice(assetPair);

  // 3) Fallback to HTTP quote if cache empty
  if (openingPrice == null) {
    const quoteUrl = new URL('https://api.twelvedata.com/quote');
    quoteUrl.searchParams.set('symbol', assetPair);
    quoteUrl.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);

    const quoteRes  = await fetch(quoteUrl.toString());
    const quoteData = await quoteRes.json();

    if (quoteData.status === 'error') {
      throw new ApiError(502, `TwelveData quote error: ${quoteData.message}`);
    }

    openingPrice = parseFloat(quoteData.close);
  }

  // 4) Load maintenance margin percentage
  const settings = await siteSettings.findOne();
  const mmPct    = settings.maintenanceMarginPercentage ?? 0.005;

  // 5) Calculate margin & liquidationPrice
  const marginUsed = (openingPrice * quantity) / leverage;
  const liquidationPrice = calculateLiquidationPrice(
    openingPrice,
    leverage,
    direction,
    mmPct
  );

  // 6) Load user & check funds
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (marginUsed > user.accountBalance) {
    throw new ApiError(400, 'Insufficient available balance for required margin.');
  }

  // 7) Lock margin
  user.accountBalance -= marginUsed;
  user.lockedBalance  += marginUsed;
  await user.save();

  // 8) Create the new position
  const position = await ContractPosition.create({
    userId,
    assetPair,
    direction,
    quantity,
    leverage,
    openingPrice,
    marginUsed,
    stopLossPrice,
    takeProfitPrice,
    liquidationPrice,
    openingTime: new Date(),
    status: 'Open'
  });

  // 9) Respond
  res.status(201).json(new ApiResponse(
    201,
    { position },
    'Contract position opened successfully.'
  ));
});

const getOpenPositions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1) Load open positions
  const positions = await ContractPosition.find({ userId, status: 'Open' }).lean();

  // 2) Enrich each with currentPrice and unrealizedPnl
  const enriched = await Promise.all(positions.map(async pos => {
    subscribeSymbol(pos.assetPair);
    let currentPrice = getCachedPrice(pos.assetPair);

    // HTTP fallback if needed
    if (currentPrice == null) {
      const url = new URL('https://api.twelvedata.com/quote');
      url.searchParams.set('symbol', pos.assetPair);
      url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);
      const resp = await fetch(url.toString());
      const body = await resp.json();
      if (body.status !== 'error') {
        currentPrice = parseFloat(body.close);
      }
    }

    // If we still have no price, mark as null
    const unrealizedPnl = (currentPrice != null)
      ? (currentPrice - pos.openingPrice)
          * pos.quantity
          * (pos.direction === 'Buy' ? 1 : -1)
      : null;

    return {
      ...pos,
      currentPrice,
      unrealizedPnl
    };
  }));

  res.json(new ApiResponse(200, { positions: enriched }, 'Open positions fetched.'));
});

const updatePositionTpSl = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const { takeProfitPrice, stopLossPrice } = req.body;

  // 1) Validate input
  if (takeProfitPrice == null && stopLossPrice == null) {
    throw new ApiError(400, 'At least one of takeProfitPrice or stopLossPrice is required.');
  }

  // 2) Fetch the position
  const pos = await ContractPosition.findOne({ _id: id, userId, status: 'Open' });
  if (!pos) throw new ApiError(404, 'Open position not found.');

  // 3) Update fields
  if (takeProfitPrice != null) pos.takeProfitPrice = takeProfitPrice;
  if (stopLossPrice  != null) pos.stopLossPrice  = stopLossPrice;
  await pos.save();

  res.json(new ApiResponse(200, { position: pos }, 'Take-profit/Stop-loss updated.'));
});

const closePosition = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  // 1) Load the position
  const pos = await ContractPosition.findOne({ _id: id, userId, status: 'Open' });
  if (!pos) throw new ApiError(404, 'Open position not found.');

  // 2) Get closingPrice from WS cache (with HTTP fallback)
  subscribeSymbol(pos.assetPair);
  let closingPrice = getCachedPrice(pos.assetPair);
  if (closingPrice == null) {
    const url = new URL('https://api.twelvedata.com/quote');
    url.searchParams.set('symbol', pos.assetPair);
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);
    const resp = await fetch(url.toString());
    const body = await resp.json();
    if (body.status === 'error') {
      throw new ApiError(502, `Failed to fetch closing price: ${body.message}`);
    }
    closingPrice = parseFloat(body.close);
  }

  // 3) Compute realized P/L
  const directionFactor = pos.direction === 'Buy' ? 1 : -1;
  const pnl = (closingPrice - pos.openingPrice) * pos.quantity * directionFactor;

  // 4) Compute closing fee (optional; here 0% if no siteSettings)
  const settings = await siteSettings.findOne();
  const feePct   = settings.contractClosingFeePct ?? 0; 
  const fee      = pos.marginUsed * feePct;

  // 5) Settle user balances
  const user = await User.findById(userId);
  user.lockedBalance  -= pos.marginUsed;
  user.accountBalance += pos.marginUsed + pnl - fee;
  await user.save();

  // 6) Update position as closed
  pos.status       = 'Closed';
  pos.closingPrice = closingPrice;
  pos.closingTime  = new Date();
  pos.realizedPnl  = pnl;
  await pos.save();

  // 7) Return settlement details
  res.json(new ApiResponse(200, {
    position: pos,
    settlement: {
      realizedPnl: pnl,
      fee,
      newAccountBalance: user.accountBalance,
      newLockedBalance:  user.lockedBalance
    }
  }, 'Position closed successfully.'));
});

const getCompletedContractTrades = asyncHandler(async (req, res) => {
    const userId = req.user._id; // Assuming req.user is populated by auth middleware

    // Find all contract positions for the user with status 'Closed' or 'Liquidated'
    const completedTrades = await ContractPosition.find({
        userId,
        status: { $in: ['Closed', 'Liquidated'] } // Use $in operator to match multiple statuses
    })
    .sort({ closingTime: -1 }) // Sort by closing time, newest first
    .lean(); // Return plain JavaScript objects

    // Return the list of completed trades
    res.status(200).json(new ApiResponse(
        200,
        { trades: completedTrades },
        'Completed contract trades fetched successfully.'
    ));
});


export { addInvestmentToOptionTrade, assetHistory, assets, closePosition, getAssetDetails, getCompletedContractTrades, getOpenPositions, getTwdAssets, getUserOptionTrades, placeContractTrade, placeOptionTrade, updatePositionTpSl };

