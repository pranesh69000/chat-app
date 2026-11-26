# Private One-to-One Messaging Application — Backend

A lightweight, secure, and modular backend for a private 1-to-1 messaging application with a discreet Tic-Tac-Toe (XO) frontend entry mechanism.

Designed for **₹0 local development** with a tiny RAM footprint (< 60 MB), native Node.js ES modules, and a future-ready architecture compatible with AWS Serverless (API Gateway WebSockets, Lambda, DynamoDB, S3).

---

## 1. Key Features

- **Discreet Access & Secure Authentication:**
  - Phone number registration with E.164 normalization.
  - 6-digit OTP verification with 5-minute expiry and SHA-256 cryptographic hashing.
  - Alphanumeric + symbol password registration using `bcrypt`.
  - Day-to-day access unlocked via password (no daily SMS OTP required).
  - Rate limiting and brute-force protection.
- **Permanent 1-to-1 Pairing:**
  - Secret invite code generation (`PAIR-XXXXXX`).
  - Strict mutual exclusivity (1 user pairs with exactly 1 friend forever).
- **Messaging & WhatsApp Delivery Lifecycle:**
  - Persistent message history with pagination.
  - Status tracking:
    - `sent` (Single Tick): Saved to server database.
    - `delivered` (Double Tick): Received by friend.
    - `read` (Blue Tick): Opened by friend.
  - Idempotency / duplicate message protection.
- **Real-Time WebSockets:**
  - Native WebSocket gateway (`ws`) with zero polling.
  - Instant live message push and live double/blue tick status updates.
- **Media Uploads & Access Control:**
  - Images, voice/audio messages, and video files up to 50 MB.
  - Magic-byte file signature validation to prevent extension spoofing.
  - Access-controlled streaming: Only paired users can access media.
- **Discreet Notifications:**
  - Wording customization (e.g. "New game move"). Never exposes private message content.

---

## 2. API Endpoints Reference

### Authentication
- `POST /auth/request-otp` — Request 6-digit SMS OTP (60s cooldown, 5-min validity)
- `POST /auth/verify-otp` — Verify OTP and receive temporary verification token (max 3 attempts)
- `POST /auth/set-password` — Set/reset secret account password
- `POST /auth/login` — Unlock/login using phone number + password (returns session token)
- `GET /auth/me` — Get authenticated user details

### Pairing
- `POST /pairing/generate-code` — Generate 24-hr secret invite code
- `POST /pairing/accept-code` — Enter friend's code to permanently pair
- `GET /pairing/status` — Check pairing status and friend ID

### Messaging
- `POST /messages/send` — Send text or media message
- `GET /messages?limit=50&before=timestamp` — Retrieve chat history
- `PATCH /messages/:id/status` — Update status to `delivered` or `read`
- `GET /ws?token=SESSION_TOKEN` — Real-time WebSocket connection

### Media
- `POST /media/upload` — Multipart upload with magic-byte verification
- `GET /media/:fileId` — Authenticated media stream (owner and friend only)

---

## 3. Local ₹0 Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Verify [.env](file:///C:/CHAT%20APP/.env) has your desired port (default `3000`).

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Start the local server:**
   ```bash
   npm start
   ```
   *(Dev SMS Provider will print OTPs directly to your terminal at ₹0 cost!)*
