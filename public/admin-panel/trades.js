// public/trades.js

const WEBSOCKET_URL = 'wss://global-assets.io/ws/admin/trades';
const API_BASE_URL   = 'https://global-assets.io/api/v1/admin/options';

const tradesContainer       = document.getElementById('trades-container') || document.querySelector('.trades-grid');
const activeTradesCountElem = document.getElementById('active-trades-count');
const toastContainer        = createToastContainer();

const activeTradesMap       = new Map();      // tradeId → trade data
const pendingOutcomeMap     = new Map();      // tradeId → 'Profit'|'Loss'
let ws;

// ——— Toast System ———
function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  Object.assign(c.style, {position:'fixed', top:'1rem', right:'1rem', zIndex:9999});
  document.body.appendChild(c);
  return c;
}

function showToast(msg, type='info', duration=3000) {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  Object.assign(t.style, {
    marginBottom:'0.5rem', padding:'0.75rem 1rem', borderRadius:'0.375rem',
    boxShadow:'0 2px 6px rgba(0,0,0,0.15)',
    background: type==='error' ? '#fee2e2' : '#d1fae5',
    color:      type==='error' ? '#b91c1c' : '#065f46'
  });
  toastContainer.appendChild(t);
  setTimeout(()=>t.remove(), duration);
}

// ——— Helpers ———
function formatCurrency(v) {
  return new Intl.NumberFormat('en-US',{
    style:'currency',currency:'USD',
    minimumFractionDigits:2,maximumFractionDigits:2
  }).format(v);
}

function calculateTimeLeft(trade) {
  let expiryMs;
  if (trade.purchaseTime && typeof trade.durationSeconds==='number') {
    expiryMs = new Date(trade.purchaseTime).getTime() + trade.durationSeconds*1000;
  } else {
    expiryMs = new Date(trade.expiryTime).getTime();
  }
  const diff = Math.max(0, Math.floor((expiryMs - Date.now())/1000));
  if (diff===0) return 'Expired';
  const d = Math.floor(diff/86400),
        h = Math.floor((diff%86400)/3600),
        m = Math.floor((diff%3600)/60),
        s = diff%60;
  return `${d?d+'d ':''}${h?h+'h ':''}${m?m+'m ':''}${s}s`.trim();
}

// ——— Render / Update ———
function renderTradeCard(trade) {
  const pending = pendingOutcomeMap.get(trade._id); 
  const isSettled = ['Expired_Win','Expired_Loss'].includes(trade.status);
  const statusMap = {
    Active:       { text:'Running', icon:'time-outline',   cls:'running' },
    Expired_Win:  { text:'Win',     icon:'trophy-outline', cls:'settled' },
    Expired_Loss: { text:'Loss',    icon:'close-outline',  cls:'settled' }
  };
  const { text, icon, cls } = statusMap[trade.status] || 
                             { text:'Settled', icon:'checkmark-circle-outline', cls:'settled' };
  let card = document.querySelector(`.trade-card[data-id="${trade._id}"]`);
  if (!card) {
    card = document.createElement('div');
    card.className = 'trade-card';
    card.dataset.id = trade._id;
    tradesContainer.prepend(card);
  }

  // Determine label: settled? or pending? or blank
  let labelText = '';
  if (isSettled) {
    labelText = `Set to ${text}`;
    pendingOutcomeMap.delete(trade._id);
  } else if (pending) {
    labelText = `Set to ${pending==='Profit'?'Win':'Loss'}`;
  }

  const timeLeft = calculateTimeLeft(trade);

  card.innerHTML = `
    <div class="trade-header">
      <div class="trade-label">${labelText}</div>
      <div class="trade-status ${cls}">
        <ion-icon name="${icon}"></ion-icon> ${text}
      </div>
    </div>
    <div class="trade-details">
      <div class="detail-item">
        <div class="detail-label">Asset</div>
        <div class="detail-value">${trade.assetPair}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Direction</div>
        <div class="detail-value ${trade.direction.toLowerCase()}">
          <ion-icon name="${trade.direction==='Bullish'?'arrow-up-circle-outline':'arrow-down-circle-outline'}"></ion-icon>
          ${trade.direction}
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">User</div>
        <div class="detail-value">${trade.userId?.email||trade.userId?.username||'N/A'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Opening Price</div>
        <div class="detail-value">${formatCurrency(trade.openingPrice)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Expiry</div>
        <div class="detail-value">${new Date(trade.expiryTime).toLocaleString('en-US',{
          day:'2-digit',month:'short',year:'numeric',
          hour:'2-digit',minute:'2-digit',hour12:false
        })}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Time Left</div>
        <div class="detail-value" data-countdown="${trade._id}">${timeLeft}</div>
      </div>
    </div>
    <div class="detail-item">
      <div class="detail-label">Investment</div>
      <div class="trade-amount">${formatCurrency(trade.investmentAmount)}</div>
    </div>
    <div class="trade-outcome">
      ${isSettled
        ? `<div class="outcome-set">Outcome: ${text}</div>`
        : `<div class="outcome-actions">
             <button class="outcome-btn win"  data-outcome="Profit" data-id="${trade._id}">
               <ion-icon name="trophy-outline"></ion-icon> Win
             </button>
             <button class="outcome-btn loss"  data-outcome="Loss"   data-id="${trade._id}">
               <ion-icon name="close-outline"></ion-icon> Loss
             </button>
           </div>`}
    </div>
  `;

  if (!isSettled) {
    card.querySelectorAll('.outcome-btn').forEach(btn => {
      btn.onclick = () => {
        const outcome = btn.dataset.outcome;
        // remember pending
        pendingOutcomeMap.set(trade._id, outcome);
        renderTradeCard(trade);
        handleSetOutcome(trade._id, outcome);
      };
    });
  }
}

function removeTradeCard(id) {
  const c = document.querySelector(`.trade-card[data-id="${id}"]`);
  if (c) c.remove();
}

function updateTradeCount() {
  activeTradesCountElem.textContent = activeTradesMap.size;
}

// ——— Outcome API ———
async function handleSetOutcome(tradeId, outcome) {
  try {
    const res = await fetch(`${API_BASE_URL}/${tradeId}/set-outcome`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ outcome })
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.message||'Error');
    showToast(`Outcome set to ${ outcome==='Profit'?'Win':'Loss' }`);
  } catch (err) {
    showToast(err.message,'error');
    console.error(err);
  }
}

// ——— WebSocket & Reconnect ———
function connectWebSocket() {
  ws = new WebSocket(WEBSOCKET_URL);

  ws.onopen    = () => console.log('✅ WS connected');
  ws.onerror   = e => { console.error('WS error',e); ws.close(); };
  ws.onclose   = () => setTimeout(connectWebSocket,5000);
  ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    switch (msg.type) {
      case 'initialTrades':
        activeTradesMap.clear();
        document.querySelectorAll('.trade-card').forEach(el=>el.remove());
        msg.trades.forEach(t=> {
          activeTradesMap.set(t._id,t);
          renderTradeCard(t);
        });
        break;
      case 'tradeCreated':
      case 'tradeUpdated':
        activeTradesMap.set(msg.trade._id,msg.trade);
        renderTradeCard(msg.trade);
        break;
      case 'tradeSettled':
        activeTradesMap.delete(msg.trade._id);
        renderTradeCard(msg.trade);                   // shows final Outcome: text
        pendingOutcomeMap.delete(msg.trade._id);      // clear pending
        setTimeout(()=>removeTradeCard(msg.trade._id),3000);
        break;
      case 'tradeDeleted':
        activeTradesMap.delete(msg.trade._id);
        pendingOutcomeMap.delete(msg.trade._id);
        removeTradeCard(msg.trade._id);
        break;
      default:
        console.warn('Unknown WS msg',msg.type);
    }
    updateTradeCount();
  };
}

document.addEventListener('DOMContentLoaded', ()=>{
  connectWebSocket();
  requestAnimationFrame(updateCountdowns);
  function updateCountdowns() {
  activeTradesMap.forEach(trade => {
    const el = document.querySelector(`[data-countdown="${trade._id}"]`);
    if (el) el.textContent = calculateTimeLeft(trade);
  });
  requestAnimationFrame(updateCountdowns);
}
});
