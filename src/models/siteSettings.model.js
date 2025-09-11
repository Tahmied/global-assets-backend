import mongoose from "mongoose";

const siteSettingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
  },
  siteLogo: {
    type: String,
  },
  withdrawalFee: {
    type: Number,
  },
   loanTermRates: [ 
    {
      _id: false, 
      durationDays: { type: Number, required: true, unique: true }, 
      dailyRate: { type: Number, required: true, min: 0 } 
    }
  ],
  returnPercentage: {
    type:Number
  },
  maintenanceMarginPercentage: {
    type : Number
  },
  contractClosingFeePct : {
    type : Number
  },
  optionProfitRates: {
        type: Map, 
        of: Number, 
        default: {
            '120s': 92,
            '180s': 120,
            '300s': 150,
            '3_days': 260,
            '10_days': 360,
            '15_days': 450
        }
  }
});

export const siteSettings = mongoose.model("siteSettings", siteSettingsSchema);


export async function updateSiteSettings(updateFields) {
  const singletonId = "singleton";

  const updatedDoc = await siteSettings.findOneAndUpdate(
    { _id: singletonId },
    { $set: updateFields },
    { new: true, upsert: true }
  );

  return updatedDoc;
}
