import dotenv from 'dotenv'
import http from 'http'
import { startAIRobotMonitor } from './aiRobotMonitor.js'
import { app } from './app.js'
import { initializeChatSystem } from './chatWebSocketService.js'
import { startContractMonitor } from './contractMonitor.js'
import { connectDatabase } from './db/connectDb.js'
import { startLoanMonitor } from './loanCheck.js'
import { initializeTradeWebSocketServer } from './tradeWebSocketService.js'

dotenv.config({path: './.env'})

connectDatabase()
  .then(() => {
    const httpServer = http.createServer(app);
    const tradeWSS = initializeTradeWebSocketServer();
    const chatWSS = initializeChatSystem();
    httpServer.on('upgrade', (req, socket, head) => {
      if (req.url === '/ws/admin/trades') {
        tradeWSS.handleUpgrade(req, socket, head, (ws) => {
          tradeWSS.emit('connection', ws, req);
        });
      } else if (req.url === '/ws/chat') {
        chatWSS.handleUpgrade(req, socket, head, (ws) => {
          chatWSS.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    httpServer.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on http://localhost:${process.env.PORT || 8000}`);
    });

    startContractMonitor(5000);
    startLoanMonitor(10000, 200);
    startAIRobotMonitor();
  })

.catch((err)=> {
    console.log(`can't start the server due to ${err}`);
})