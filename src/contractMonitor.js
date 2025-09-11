import { ContractPosition } from './models/UserContractTrade.model.js';
import { siteSettings } from './models/siteSettings.model.js';
import { User } from './models/user.model.js';
import { getCachedPrice, subscribeSymbol } from './priceService.js';
import { ApiError } from './utils/apiError.js';

async function closePositionAutomated(pos, currentPrice) {
  const user = await User.findById(pos.userId);
  if (!user) throw new ApiError(500, `User ${pos.userId} not found during automated close`);

  const dirFactor = pos.direction === 'Buy' ? 1 : -1;
  const pnl       = (currentPrice - pos.openingPrice) * pos.quantity * dirFactor;

  const settings = await siteSettings.findOne();
  const feePct   = settings.contractClosingFeePct ?? 0;
  const fee      = Math.abs(pos.marginUsed * feePct);

  user.lockedBalance -= pos.marginUsed;

  if (pos.status === 'Liquidated') {
    user.accountBalance += pnl - fee;
  } else {
    user.accountBalance += pos.marginUsed + pnl - fee;
  }

  await user.save();

  pos.closingPrice = currentPrice;
  pos.closingTime  = new Date();
  pos.realizedPnl  = pnl;
  await pos.save();

}

export async function monitorAllContractPositions() {

  const openPositions = await ContractPosition.find({ status: 'Open' });

  for (const pos of openPositions) {
    try {
      subscribeSymbol(pos.assetPair);

      // 1) Try WS cache first
      let currentPrice = getCachedPrice(pos.assetPair);
      if (currentPrice != null) {
      } else {
        // 2) HTTP fallback
        const url = new URL('https://api.twelvedata.com/quote');
        url.searchParams.set('symbol', pos.assetPair);
        url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY);

        const resp = await fetch(url.toString());
        const body = await resp.json();
        if (body.status === 'error') {
          console.error(`[Monitor] HTTP quote error for ${pos.assetPair}: ${body.message}`);
          continue;  // skip this position this cycle
        }
        currentPrice = parseFloat(body.close);
      }

      // 3) Evaluate closure conditions
      const { takeProfitPrice: tp, stopLossPrice: sl, liquidationPrice: liq } = pos;

      const isLiqHit = (pos.direction === 'Buy'  && currentPrice <= liq) ||
                       (pos.direction === 'Sell' && currentPrice >= liq);
      const isTpHit  = tp != null && (
                         (pos.direction === 'Buy'  && currentPrice >= tp) ||
                         (pos.direction === 'Sell' && currentPrice <= tp)
                       );
      const isSlHit  = sl != null && (
                         (pos.direction === 'Buy'  && currentPrice <= sl) ||
                         (pos.direction === 'Sell' && currentPrice >= sl)
                       );

      if (isLiqHit) {
        pos.status = 'Liquidated';
        await closePositionAutomated(pos, currentPrice);
      }
      else if (isTpHit) {
        pos.status = 'Closed';
        await closePositionAutomated(pos, currentPrice);
      }
      else if (isSlHit) {
        pos.status = 'Closed';
        await closePositionAutomated(pos, currentPrice);
      }
      // otherwise, leave open

    } catch (err) {
      console.error(`[Monitor] Error processing position ${pos._id}:`, err);
    }
  }

}

export function startContractMonitor(intervalMs = 5000) {
 
  monitorAllContractPositions().catch(err => console.error('[Monitor] Initial cycle error:', err));
  
  setInterval(() => {
    monitorAllContractPositions().catch(err => console.error('[Monitor] Cycle error:', err));
  }, intervalMs);
}