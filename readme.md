# KYC Verification Web App

A full-stack web application built with **Node.js**, **Express**, and **MongoDB** that enables users to register, authenticate, and submit KYC (Know Your Customer) verification information including identity documents.

---

## 🔧 Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB (Mongoose)
- **Authentication:** Custom Auth Middleware (JWT or session-based)
- **File Uploads:** Multer
- **Frontend:** HTML, CSS, JavaScript (Vanilla)

---

## ✨ Features

### 🔐 Authentication & User Management

- User Registration & Login
- OTP Verification System
- Forgot Password Flow (via OTP)
- Session-aware user authentication using middleware (`req.user`)
- User Profile View & Update

### 📄 KYC Verification

- Dedicated KYC Model
  - Stores full name, country, address, income, investment info, date of birth
  - Accepts ID documents (NID, Passport, Driving License, Residence Permit)
- File Uploads with Multer
  - Stores front and back side of identity document
- Status Tracking
  - Every submission is marked as `pending` by default
  - Admin can approve or reject KYC manually (future feature)
- Form Validation
  - Required field checking
  - Frontend previews uploaded images before submission

### 🌐 Frontend (Vanilla JS)

- Responsive, user-friendly KYC form UI
- Dropdown for ID type selection
- Live image previews before upload
- Form submission using Fetch API and FormData
- Toast-style message alerts

---

## 🗂 Folder Structure (Simplified)

project-root/ │ ├── public/ │ └── contents/kyc-docs/ # Uploaded documents (front/back of ID) │ ├── models/ │ └── User.js │ └── Kyc.js │ ├── middlewares/ │ └── auth.js │ └── mediaUpload.js │ ├── controllers/ │ └── authController.js │ └── kycController.js │ ├── routes/ │ └── userRoutes.js │ ├── utils/ │ └── ApiError.js │ └── asyncHandler.js │ └── server.js / app.js


## 📮 API Endpoints (Key)

| Endpoint                       | Method | Description                      |
|-------------------------------|--------|----------------------------------|
| `/api/v1/users/register`      | POST   | User registration                |
| `/api/v1/users/login`         | POST   | User login                       |
| `/api/v1/users/profile`       | GET    | Get user profile (auth required) |
| `/api/v1/users/kyc-verification` | POST | Submit KYC info (auth + files)   |

---

## 🚀 Future Improvements

- Admin Dashboard for approving/rejecting KYC
- Email notifications for status updates
- Upload to cloud storage (e.g., AWS S3)
- Crypto payment integration

---

## Initial admin routes ( not completed yet )
GET    /api/v1/admin/users               → listUsers
GET    /api/v1/admin/users/:id           → getUser
PATCH  /api/v1/admin/users/:id/lock      → toggleLock
PATCH  /api/v1/admin/users/:id/password  → resetPassword
DELETE /api/v1/admin/users/:id           → deleteUser

GET    /api/v1/admin/kyc                 → listKycRequests
GET    /api/v1/admin/kyc/:kycId          → getKycRequest
PATCH  /api/v1/admin/kyc/:kycId          → updateKycStatus

admin panel colors - 
--text: #dee7ee;
--background: #0b141c;
--primary: #94bcdd;
--secondary: #205d8f;
--accent: #2c8edf;




## 🧑‍💻 Developer Notes

- Uses ES Modules (`type: module` in `package.json`)
- File uploads handled with `multer.fields()` for multiple inputs
- Clean modular structure for scalability

---

## 📄 License

Only for global asset website owner