import { AIRobotPackage } from '../models/aiBots.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';


const addAIRobotPackage = asyncHandler(async (req, res) => {
    const {
        cycleDurationDays,
        minDailyReturnPercentage,
        maxDailyReturnPercentage,
        minInvestmentAmount,
        maxInvestmentAmount,
        isActive
    } = req.body;

    if (
        !cycleDurationDays ||
        !minDailyReturnPercentage ||
        !maxDailyReturnPercentage ||
        !minInvestmentAmount ||
        !maxInvestmentAmount 
    ) {
        throw new ApiError(400, 'All package fields (cycleDurationDays, minDailyReturnPercentage, maxDailyReturnPercentage, minInvestmentAmount, maxInvestmentAmount) are required.');
    }
    if (
        typeof cycleDurationDays !== 'number' || cycleDurationDays <= 0 ||
        typeof minDailyReturnPercentage !== 'number' || minDailyReturnPercentage < 0 ||
        typeof maxDailyReturnPercentage !== 'number' || maxDailyReturnPercentage < minDailyReturnPercentage ||
        typeof minInvestmentAmount !== 'number' || minInvestmentAmount < 0 ||
        typeof maxInvestmentAmount !== 'number' || maxInvestmentAmount < minInvestmentAmount
    ) {
        throw new ApiError(400, 'Invalid numeric values or ranges for package fields.');
    }

    
    const newPackage = new AIRobotPackage({
        cycleDurationDays,
        minDailyReturnPercentage,
        maxDailyReturnPercentage,
        minInvestmentAmount,
        maxInvestmentAmount,
        isActive: typeof isActive === 'boolean' ? isActive : true 
    });

    const createdPackage = await newPackage.save();

    if (!createdPackage) {
        throw new ApiError(500, 'Failed to create AI Robot package. Please try again.');
    }
    res.status(201).json(
        new ApiResponse(
            201,
            createdPackage,
            'AI Robot package created successfully.'
        )
    );
});

export { addAIRobotPackage };
