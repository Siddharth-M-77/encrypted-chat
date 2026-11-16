# M Talk

**Communication Without Boundaries.** A privacy-focused, end-to-end encrypted messenger where your crypto wallet is your identity. Part of the MASQOO ecosystem.

- **Wallet login**: Sign-In With Ethereum (EIP-4361) on BNB Smart Chain. No email, no password.
- **End-to-end encrypted** chats: the server only ever stores ciphertext.
- **1:1 and group chats**, replies, typing indicators, read receipts, presence.
- **Encrypted media**: images, files and voice notes are encrypted in the browser before upload.
- **1:1 voice and video calls** over WebRTC (STUN/TURN via coturn).
- Blocking, delete for me / for everyone, rate limiting.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Node.js 20+, Express 5, MongoDB (Mongoose), Redis (ioredis), Socket.IO + Redis adapter, siwe + ethers v6, zod, helmet, pino |
| Frontend | React 18, Vite, Redux Toolkit (RTK Query), React Router 6, Tailwind CSS, tweetnacl, idb-keyval, WebRTC |
| Infra | Docker Compose (mongo, redis, coturn), PM2, Nginx |

## Project structure

```
.
├── client/            React + Vite app
│   └── src/  components/ pages/ store/ hooks/ lib/ services/
├── server/            Express + Socket.IO API
│   └── src/  config/ models/ routes/ controllers/ services/ sockets/ middlewares/ utils/
├── docker/coturn/     TURN server config
└── docker-compose.yml mongo, redis, coturn for local development
```

## Getting started

Requirements: Node.js 20+, and MongoDB + Redis (via Docker or installed locally).

```bash
# 1. Infrastructure (or run mongod and redis-server yourself)
docker compose up -d mongo redis          # add "coturn" for calls across networks

# 2. Environment files
cp server/.env.example server/.env        # then set JWT_SECRET to a long random string
cp client/.env.example client/.env

# 3. Backend  ->  http://localhost:4000
cd server && npm install && npm run dev

# 4. Frontend ->  http://localhost:5173   (in a second terminal)
cd client && npm install && npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`: the signed SIWE domain is `localhost:5173`). You need a browser wallet such as MetaMask. To try chatting, use two browser profiles with two different wallet accounts.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Configuration

**`server/.env`**

| Variable | Purpose |
|---|---|
| `FRONTEND_URL` | Allowed CORS origin (the frontend URL, no trailing slash) |
| `SIWE_DOMAIN` | Host the browser signs in on, e.g. `localhost:5173` or `chat.example.com` |
| `ALLOWED_CHAIN_IDS` | Accepted chains: `56` BSC mainnet, `97` BSC testnet |
| `MONGO_URI`, `REDIS_URL` | Database connections |
| `JWT_SECRET` | At least 32 characters. Keep it secret |
| `TURN_SECRET`, `TURN_URL`, `STUN_URL` | Calls. `TURN_SECRET` must equal `static-auth-secret` in `docker/coturn/turnserver.conf` |
| `UPLOAD_DIR` | Where encrypted blobs are stored |

**`client/.env`**: `VITE_CHAIN_ID` (97 or 56) and an optional `VITE_WALLETCONNECT_PROJECT_ID` (get one at dashboard.reown.com to enable WalletConnect).

## How the encryption works

- On first login the browser creates an X25519 keypair. The private key is encrypted with a key derived from your **PIN** (PBKDF2, 310,000 iterations) and stored in IndexedDB. An encrypted backup is also kept on the server so you can restore on a new device. The server never sees your PIN or raw private key.
- **1:1 messages** use `nacl.box`. A second copy is encrypted for the sender so history is readable on other devices.
- **Groups** use a random 32-byte key sealed separately for each member (`nacl.box`) and messages use `nacl.secretbox`. The key rotates when a member is removed or leaves.
- **Files** are encrypted in the browser with a one-time key; the key travels inside the encrypted message.
- A **safety number** in chat info lets two people verify they have each other's real keys.
- Calls are peer-to-peer (DTLS-SRTP); the server only relays signaling.

## What this does and does not protect

Message **content** is hidden from the server. These are **not** hidden:

- Wallet addresses (public on-chain), who talks to whom, message timing and sizes, online status, and call metadata.
- IP addresses, which appear in server and proxy logs.

Known limitations: no forward secrecy (a leaked private key exposes past messages), the encrypted key backup depends on PIN strength, and as a web app the server delivers the JavaScript. Do not market this as "untraceable".

## Deploying (checklist)

1. Set `NODE_ENV=production` (secure cookies), `FRONTEND_URL`, `SIWE_DOMAIN`, a new `JWT_SECRET`, and mainnet chain IDs. Build the client with `cd client && npm run build`.
2. Serve the client build and reverse-proxy `/api` and `/socket.io` (WebSocket upgrade) to the API. Set `client_max_body_size 26m;` for 25 MB uploads, forward `X-Forwarded-Proto`, and use HTTPS (required for camera and microphone).
3. Run the API under PM2. The server does not read `.env` with `npm start`, so provide variables through PM2 or `node --env-file=.env`. If you run several workers, make the Socket.IO client use WebSocket-only transport or enable sticky sessions.
4. coturn: change the shared secret, set `external-ip`, open ports 3478 (TCP/UDP) and 49160-49200 (UDP).
5. Do not expose MongoDB or Redis publicly (the dev `docker-compose.yml` publishes their ports). Keep `server/uploads` on persistent storage and back it up.

## Scripts

| Where | Command | Does |
|---|---|---|
| `server/` | `npm run dev` | API with auto-restart, loads `.env` |
| `server/` | `npm start` | API (environment must come from the shell/PM2) |
| `client/` | `npm run dev` | Vite dev server with `/api` and `/socket.io` proxied to the API |
| `client/` | `npm run build` | Production build into `client/dist` |
