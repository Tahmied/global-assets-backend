# Global Assets - Trading Platform Backend

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-lightgrey.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

Proprietary License

Copyright (c) 2024 Global-Assets.io

All rights reserved.

This code is proprietary and confidential. It is published for educational 
and portfolio demonstration purposes only.

Permission is NOT granted to use, copy, modify, merge, publish, distribute, 
sublicense, and/or sell copies of this software for any purpose, commercial 
or non-commercial.

This software is provided "as is", without warranty of any kind, express or 
implied, including but not limited to the warranties of merchantability, 
fitness for a particular purpose and noninfringement.

For licensing inquiries, contact: contact@global-assets.io

A comprehensive, enterprise-grade trading platform backend supporting real-time options & contract trading, crypto payments, KYC verification, loan management, and advanced admin controls.

[Features](#features) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [API Documentation](#api-documentation) • [Project Structure](#project-structure)

</div>

---

## 📋 Overview

**Global Assets** is a full-featured trading platform backend developed over 6+ months, designed to handle complex financial operations including real-time trading, crypto payments, loan management, and comprehensive admin controls. The platform supports trading across multiple asset classes (crypto, forex, stocks, ETFs) with real-time data integration from Massive.com API.

### Key Highlights

- 🔐 **Secure Authentication** - JWT-based auth with OTP verification and transaction passwords
- 📊 **Real-time Trading** - Live options and contract trading with instant updates
- 💰 **Multi-Asset Support** - Crypto, Forex, Stocks, and ETF trading
- 🏦 **Loan Management** - Complete loan system with admin approval workflows
- ✅ **KYC Verification** - Document verification and approval system
- 💳 **Crypto Payments** - Integrated cryptocurrency payment processing
- 📱 **Real-time Notifications** - Event-driven notification system
- 💬 **Live Chat** - Real-time admin-customer communication
- 🎯 **Practice Mode** - Risk-free trading simulation for users
- 📈 **Advanced Analytics** - Detailed trading history with filtering and charts

---

## ✨ Features

### User Features

#### Authentication & Security
- User registration with email verification
- Secure login with JWT tokens
- OTP-based verification system
- Forgot password & password reset
- Transaction password for sensitive operations
- Two-factor authentication support

#### Trading System
- **Real-time Options Trading** - Buy/sell options with live market data
- **Contract Trading** - Leverage trading with contract positions
- **Practice Mode** - Paper trading for learning without risk
- **Multi-Asset Support** - Trade crypto, forex, stocks, and ETFs
- **Live Market Data** - Real-time price feeds from Massive.com API
- **Advanced Charts** - Interactive price charts with technical indicators
- **Trade History** - Complete trading analytics with filtering options

#### Profile & Account Management
- Rich user profile system
- Profile update capabilities
- Transaction history tracking
- Comprehensive transaction management
- Balance tracking across multiple assets
- Portfolio overview and analytics

#### Financial Operations
- **Crypto Payment Integration** - Deposit/withdraw via cryptocurrency
- **Loan System** - Apply for loans with customizable terms
  - Flexible loan terms selection
  - Admin-set interest rates
  - Complete loan history
  - Repayment tracking
- **Deposit/Withdrawal** - Fiat and crypto support with admin approval
- **Transaction Password** - Additional security layer for transfers

#### KYC & Compliance
- Document upload system
- Identity verification workflow
- Status tracking (pending, approved, rejected)
- Resubmission capability

#### Communication
- Real-time notification system
- User-to-admin messaging
- Live chat with admin support
- Announcement notifications

### Admin Features

#### Dashboard & Overview
- Comprehensive admin dashboard
- User statistics and metrics
- Transaction volume analytics
- KYC approval status overview
- Loan request statistics
- Real-time platform health monitoring

#### User Management
- Complete user control panel
- View all registered users
- User account management
- Balance adjustments
- Account status control (active/suspended)
- User activity logs

#### Transaction Management
- Centralized transaction page
- All deposits and withdrawals listing
- Advanced filtering options
  - By date range
  - By transaction type
  - By status
  - By user
- **Deposit Approval System** - Review and approve pending deposits
- **Withdrawal Approval System** - Review and approve pending withdrawals
- Transaction history export

#### KYC Management
- Dedicated KYC verification page
- Document review interface
- Approve/reject KYC submissions
- KYC status tracking
- Resubmission handling
- Document verification history

#### Loan Management
- Dedicated loan requests page
- Loan application review system
- User detail verification
- Loan approval/rejection workflow
- Interest rate configuration
- Loan repayment tracking
- Default management

#### Trading Oversight
- Live trades monitoring page
- Active positions tracking
- Trade history analytics
- Risk management tools
- Position limits management

#### Communication & Announcements
- **Live Chat Panel** - Real-time customer support
  - Active chat sessions
  - Chat history
  - Multi-user chat support
- **Announcement System** - Publish platform-wide announcements
- **Notification Broadcaster** - Send notifications to:
  - Individual users
  - All users
  - Specific user groups

#### Settings & Configuration
- Platform settings management
- Trading parameters configuration
- Fee structure management
- Payment gateway settings
- System-wide notifications control
- API configuration

---

## 🛠 Tech Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io for live updates
- **File Upload**: Multer for document handling
- **Payment Processing**: Crypto payment gateway integration
- **Market Data**: Massive.com API for real-time asset prices
- **Email Service**: Nodemailer for OTP and notifications
- **Security**: bcrypt, helmet, rate limiting
- **Validation**: express-validator
- **Environment**: dotenv for configuration

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 16.0.0
- MongoDB >= 4.4
- npm 
- Massive.com API key
- SMTP server for email notifications

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/Tahmied/global-assets-backend.git
   cd global-assets-backend
```

2. **Install dependencies**
```bash
   npm install
```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
```env
   PORT = 8000
MONGODB_URI = 
CORS_ORIGIN = *
ADMIN_TEAM_ID="68083fb5d70405e5870c6594" <- replace with any user id

# email settings
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=

# token secret keys
ACCESS_TOKEN_KEY = 
ACCESS_TOKEN_EXPIRY = 
REFRESH_TOKEN_KEY = 
REFRESH_TOKEN_EXPIRY = 

# payment getway details
COINREMITTER_API_KEY = 
COINREMITTER_PASS = 

# API details
CMC_API_KEY = 
TWELVE_DATA_API_KEY = 

PRIMARY_CHAT_ADMIN_ID = 
```

4. **Start the development server**
```bash
   npm run dev
```

5. **Production build**
```bash
   npm start
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api/v1
```

### API Routes Structure

#### User Routes (`/api/v1/users`)
Authentication, profile management, trading operations, and user-specific features.
```
# Authentication & Security
POST   /register              - User registration with profile picture
POST   /send-otp              - Send OTP for verification
POST   /verify-otp            - Verify OTP code
POST   /login                 - User login
POST   /logout                - User logout (requires auth)
POST   /forgot-password       - Request password reset
GET    /logincheck            - Check login status (requires auth)
POST   /set-transaction-pass  - Set transaction password (requires auth)
POST   /check-trx-pass        - Verify transaction password (requires auth)

# Profile Management
GET    /profile               - Get user profile (requires auth)
POST   /update-profile        - Update user profile with avatar (requires auth)
POST   /kyc-verificaiton      - Submit KYC documents (requires auth)

# Notifications
GET    /notificaitons         - Get user notifications (requires auth)
PUT    /notification/mark-as-read - Mark notification as read (requires auth)
PUT    /notifications/mark-all-read - Mark all notifications as read (requires auth)

# Payment & Wallet
GET    /get-wallet-address    - Get deposit wallet address (requires auth)
POST   /add-fund              - Submit deposit request with proof (requires auth)
POST   /withdraw              - Request withdrawal (requires auth)
GET    /account-balance       - Get account balance (requires auth)

# Loan System
POST   /loan-req              - Submit loan application (requires auth)
GET    /intrest-rate          - Get current interest rates
GET    /loan-status           - Get user loan status (requires auth)
GET    /loan-history          - Get loan history (requires auth)
POST   /:id/repay             - Repay loan (requires auth)

# AI Robot Investment
GET    /ai-robot-packages     - Get available AI robot packages
POST   /host-investment       - Host AI robot investment (requires auth)
POST   /get-my-robots         - Get user's active AI investments (requires auth)
POST   /redeem-investment     - Redeem AI robot investment (requires auth)
POST   /revenue-history       - Get AI robot revenue history (requires auth)
GET    /ai-finance-states     - Get AI finance dashboard stats (requires auth)

# Trading
POST   /toggle-demo-mode      - Toggle between demo and live trading (requires auth)
```

#### Admin Routes (`/api/v1/admin`)
Administrative operations, user management, approvals, and system configuration.
```
# User Management
GET    /list-users            - Get all users with filters (requires admin)
GET    /user/:id              - Get user details (requires admin)
PUT    /user/:id              - Update user details (requires admin)
PUT    /user/:id/avatar       - Update user avatar (requires admin)
DELETE /user/:id/notes/:noteId - Delete user note (requires admin)
POST   /user-loan-history     - Get user loan history (requires admin)
POST   /update-robot-limit    - Update user AI robot limit (requires admin)

# KYC Management
GET    /kyc-submissions       - Get all KYC submissions (requires admin)
POST   /set-kyc-status        - Approve/reject KYC (requires admin)
GET    /kyc-states            - Get KYC statistics (requires admin)
POST   /kyc-status-user       - Check if user submitted KYC (requires admin)

# Payment & Wallet Management
POST   /set-wallet-address    - Add deposit wallet address (requires admin)
PUT    /update-wallet-address/:id - Update wallet address (requires admin)
DELETE /delete-wallet-address/:id - Delete wallet address (requires admin)
POST   /set-withdrawal-currencies - Set supported withdrawal currencies (requires admin)
DELETE /delete-withdrawal-currencies/:id - Delete withdrawal currency (requires admin)
GET    /get-supported-currencies - Get supported currencies
POST   /set-withdraw-fee      - Set withdrawal fees (requires admin)
GET    /get-site-settings     - Get site settings

# Deposit & Withdrawal Management
GET    /fund-verification     - Get pending deposit requests (requires admin)
POST   /set-fund-status       - Approve/reject deposit (requires admin)
GET    /get-withdrawal-requests - Get withdrawal requests (requires admin)
POST   /set-withdrawal-status - Approve/reject withdrawal (requires admin)

# Loan Management
GET    /loan-list             - Get all loans (requires admin)
PUT    /loans/status          - Update loan status (requires admin)
POST   /set-term-rate         - Set loan term rates (requires admin)
POST   /updateLoanLimit       - Update user loan limit (requires admin)
GET    /repaymentRequests     - Get loan repayment requests (requires admin)
POST   /approveRepaymentRequest - Approve repayment (requires admin)
POST   /rejectRepaymentRequest - Reject repayment (requires admin)
GET    /getLoanDetailsById/:loanId - Get loan details (requires admin)
POST   /:loanId/settings      - Update loan settings (requires admin)

# Dashboard & Analytics
GET    /site-state            - Get admin dashboard statistics (requires admin)

# AI Robot Management
POST   /ai-robot-packages     - Add AI robot package (requires admin)

# Notification & Announcement Management
POST   /sendAnnouncment       - Send announcement to all users (requires admin)
POST   /sendNotificationToUser - Send notification to specific user (requires admin)
POST   /findAndDeleteNotification - Find and delete notification (requires admin)
POST   /editNotification      - Update notification message (requires admin)
GET    /getAnnouncement       - Get all announcements (requires admin)
PUT    /updateAnnouncement    - Update announcement (requires admin)
DELETE /deleteAnnouncement    - Delete announcement (requires admin)

# Trading Management
PUT    /options/:tradeId/set-outcome - Set option trade outcome (requires admin)
```

#### Market Routes (`/api/v1/market`)
Real-time market data, asset information, and trading operations.
```
# Market Data
GET    /get-twd-assets        - Get all available trading assets
GET    /get-asset-details     - Get specific asset details with real-time data

# Binary Options Trading
POST   /options/trades        - Place option trade (requires auth)
GET    /options/trades        - Get user's option trades (requires auth)
PUT    /options/trades/:id/add-investment - Add investment to option (requires auth)

# Contract Trading
POST   /contracts/trades      - Place contract trade (requires auth)
GET    /contracts/positions   - Get open contract positions (requires auth)
PUT    /contracts/positions/:id - Update position TP/SL (requires auth)
POST   /contracts/positions/:id/close - Close position (requires auth)
GET    /contracts/getCompletedContractTrades - Get completed trades (requires auth)
```

#### Chat Routes (`/api/v1/chats`)
Real-time messaging between users and admins.
```
# User Chat
POST   /chat/send             - Send message (requires auth)
GET    /history/:otherUserId  - Get chat history with user (requires auth)
POST   /chat/mark-read        - Mark messages as read (requires auth)

# Admin Chat
GET    /admin/users-for-chat-list - Get users list for chat (requires admin)
POST   /admin/set-display-status - Set admin online/offline status (requires admin)
```

#### Transaction Routes (`/api/v1/transaction`)
Financial transactions, deposits, and withdrawals. Some routes of transactions are in the user routes
```
GET    /history               - Get complete transaction history (requires auth)
```

### Response Format

All API responses follow this structure:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

---

## 📁 Project Structure
```
global-assets-backend/
├── public/                          # Static assets (images, CSS, JS)
├── src/
│   ├── controllers/                 # Request handlers & business logic
│   │   ├── admin.controller.js      # Admin operations
│   │   ├── airobot.controller.js    # AI robot management
│   │   ├── chat.controller.js       # Chat functionality
│   │   ├── market.controller.js     # Trading & market data
│   │   ├── payment.controller.js    # Payment operations
│   │   ├── transaction.controller.js # Transaction management
│   │   └── user.controller.js       # User operations
│   ├── db/
│   │   └── connectDb.js             # MongoDB connection setup
│   ├── middlewares/                 # Request processing middleware
│   │   ├── admin.middleware.js      # Admin authorization
│   │   ├── auth.middleware.js       # JWT authentication
│   │   └── multer.middleware.js     # File upload handling
│   ├── models/                      # MongoDB schemas
│   │   ├── aiBots.model.js          # AI bot packages
│   │   ├── aiRobotInvestmentOrder.model.js # AI investments
│   │   ├── assets.model.js          # Trading assets
│   │   ├── chat.model.js            # Chat messages
│   │   ├── crypto-historical-data.model.js # Crypto price history
│   │   ├── forex.model.js           # Forex pairs
│   │   ├── forexHistorical-data.model.js # Forex history
│   │   ├── kyc.model.js             # KYC submissions
│   │   ├── loan.model.js            # Loan records
│   │   ├── loanRepaymentRequest.model.js # Repayment requests
│   │   ├── otp.model.js             # OTP storage
│   │   ├── paymentRequest.model.js  # Deposit requests
│   │   ├── siteSettings.model.js    # Platform settings
│   │   ├── transaction.model.js     # Transaction records
│   │   ├── twdata.model.js          # Twelve Data assets
│   │   ├── user.model.js            # User accounts
│   │   ├── userContractTrade.model.js # Contract trades
│   │   ├── userOptionTrade.model.js # Option trades
│   │   ├── wallet.model.js          # Wallet addresses
│   │   ├── withdrawCurrency.model.js # Withdrawal currencies
│   │   └── withdrawRequest.model.js # Withdrawal requests
│   ├── routes/                      # API endpoint definitions
│   │   ├── admin.routes.js          # Admin endpoints
│   │   ├── chat.routes.js           # Chat endpoints
│   │   ├── market.routes.js         # Market & trading endpoints
│   │   ├── transaction.routes.js    # Transaction endpoints
│   │   └── user.routes.js           # User endpoints
│   ├── scripts/                     # Background jobs & automation
│   │   ├── background-detailed-history.js # Historical data sync
│   │   ├── background-job-listing.js # Asset listing updates
│   │   ├── continuousUpdate.js      # Real-time price updates
│   │   └── infrequentTop100Sync.js  # Top assets synchronization
│   ├── utils/                       # Utility functions
│   │   ├── apiError.js              # Error handling utility
│   │   ├── apiResponse.js           # Response formatting
│   │   ├── asyncHandler.js          # Async wrapper
│   │   ├── email.js                 # Email service
│   │   └── twdata.js                # Twelve Data API utilities
│   ├── aiRobotMonitor.js            # AI robot monitoring service
│   ├── app.js                       # Express app configuration
│   ├── chatWebSocketService.js      # WebSocket for chat
│   ├── constants.js                 # Application constants
│   ├── contractMonitor.js           # Contract trade monitoring
│   ├── index.js                     # Application entry point
│   ├── loanCheck.js                 # Loan validation service
│   ├── priceService.js              # Real-time price service
│   └── tradeWebSocketService.js     # WebSocket for trading
├── .env                             # Environment variables
├── .gitignore                       # Git ignore rules
├── .prettierignore                  # Prettier ignore rules
├── package.json                     # Dependencies & scripts
├── README.md                        # Project documentation
```

---

## 🔐 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for password security
- **Rate Limiting** - Protection against brute force attacks
- **Input Validation** - express-validator for request sanitization
- **CORS Configuration** - Controlled cross-origin access
- **Transaction Password** - Additional layer for financial operations
- **OTP Verification** - Two-factor authentication
- **File Upload Validation** - Restricted file types and sizes
- **SQL Injection Prevention** - MongoDB parameterized queries
- **XSS Protection** - Input sanitization

---

## 🧪 Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test -- user.test.js
```

---

## 📊 Database Schema Overview

### Collections

- **users** - User accounts and profiles
- **trades** - Trading history and active positions
- **transactions** - Deposits, withdrawals, and transfers
- **loans** - Loan applications and repayments
- **kyc** - KYC submissions and verifications
- **chats** - Chat conversations and messages
- **notifications** - User notifications
- **settings** - Platform configuration
- **announcements** - System announcements

---

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB URI
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx)
- [ ] Enable PM2 for process management
- [ ] Set up monitoring (New Relic, DataDog)
- [ ] Configure backup strategy
- [ ] Enable logging service
- [ ] Set up CI/CD pipeline
- [ ] Configure domain and DNS
- [ ] Enable rate limiting
- [ ] Set up CDN for static assets

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "global-assets"

# Monitor
pm2 monit

# View logs
pm2 logs global-assets
```

---
## 📝 License & Usage

This project was developed for **Global-Assets.io** as a commercial trading platform. The backend repository has been published with permission from the company for educational and portfolio purposes only.

### Important Notes

- ⚠️ **No Contributions Accepted** - This is a showcase repository. Pull requests and contributions are not accepted.
- 🔒 **Private Development** - The original private repository contains 300+ commits spanning 6+ months of development.
- 📚 **Educational Purpose Only** - This code is shared for learning and demonstration purposes.
- 🚫 **No Commercial Use** - You may NOT use this code for commercial purposes or business applications.
- 📄 **All Rights Reserved** - Copyright © 2025 Global-Assets.io. All rights reserved.

### What You Can Do

✅ View and study the code for learning purposes  
✅ Reference the architecture and design patterns  
✅ Use as inspiration for your own projects  

### What You Cannot Do

❌ Use this code in commercial applications  
❌ Redistribute or resell this code  
❌ Submit contributions or pull requests  
❌ Deploy this code for business purposes  

For any questions or permissions, please contact: **contact@global-assets.io**

---

## 👥 Authors

**Tahmied** - [Tahmied](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Massive.com for market data API
- Express.js community
- MongoDB team
- Socket.io contributors
- All open-source contributors

---

</div>
