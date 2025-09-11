import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import './priceService.js';

const app = express()

// --- build __dirname in ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PUBLIC_ROOT = path.join(__dirname, '..', 'public');

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

app.get('/admin/users/:id', (req, res) => {
    res.sendFile(
      path.join(PUBLIC_ROOT, 'admin-panel', 'user-details.html')
    );
  });

app.get('/asset-detail', (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, 'asset-details.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, 'order.html'));
});

app.get('/ai-order/package-:packageId', (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, 'ai-order.html'));
});

app.get('/ai-order-revenue-details/:orderId', (req, res) => {
  res.sendFile(path.join(PUBLIC_ROOT, 'ai-order-revenue-details.html'));
});

// routes import
import adminRoutes from "./routes/admin.routes.js";
import chatRouter from './routes/chat.routes.js';
import marketRoutes from "./routes/market.routes.js";
import transactionRoutes from './routes/transaction.routes.js';
import userRoutes from "./routes/user.routes.js";

// routes declaration
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/admin' , adminRoutes)
app.use('/api/v1/market' , marketRoutes)
app.use('/api/v1/chats' , chatRouter)
app.use('/api/v1/transaction' , transactionRoutes)



export { app };

