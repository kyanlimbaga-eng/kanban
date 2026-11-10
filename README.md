# Flowboard LAN

Flowboard is a secure, real-time project management and Kanban tool similar to Monday.com, engineered for collaboration across local area networks (LAN) without requiring an internet connection.

## Features

- **LAN Real-Time Collaboration:** Changes to cards, columns, reordering, and labels broadcast instantly across all connected computers on the LAN over WebSockets.
- **Card Updates & Discussions (Monday.com style):** Team members can post discussion updates and comments on cards with timestamps and author names.
- **Optimistic Concurrency & Conflict Prevention:** Card version checks prevent silent overwrites when multiple team members edit records concurrently.
- **Role-Based Access Control (RBAC):**
  - **Administrators:** Full access to manage columns, cards, labels, user accounts, and review audit logs.
  - **Viewers:** Default view-only access to the Kanban board with full ability to view live updates and post comments.
- **Security & Hardening:**
  - Password hashing using cryptographic `scrypt` with individual random salts.
  - Secure HTTP-only session cookies with configurable expiration.
  - Rate-limiting protection on login endpoints to block brute-force attacks.
  - 100% parameterized SQL queries (`node:sqlite`) preventing SQL injection.
  - Content Security Policy, X-Frame-Options, and security headers.
  - Comprehensive administrative audit trail.
- **Centralized Persistence:** SQLite with Write-Ahead Logging (`WAL`) stored centrally on the server (persisted in `./data/flowboard.db`).
- **Connection Resilience:** Automatic reconnection with exponential backoff and automatic state re-synchronization.
- **Network Presence:** Real-time indicator ("Live", "Reconnecting", "Offline") and count of online LAN teammates.

## Default Accounts

| Role | Username | Password | Access Level |
| --- | --- | --- | --- |
| **Administrator** | `admin` | `4dmin@2026!` | Full administrative and board management control |
| **Viewer** | `viewer` | `viewer123` | View-only board access with comment collaboration |

*Admins can create additional accounts and reset passwords in **Settings & Administration → User Accounts**.*

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Zustand, @dnd-kit
- **Backend:** Node.js, Express, `ws` (WebSockets), `node:sqlite` (Node standard library SQLite)
- **Deployment:** Docker & Docker Compose

## Prerequisites

- [Node.js](https://nodejs.org/) 22+ (Node 24 recommended)
- npm

## Local Setup & Development

```bash
# 1. Install dependencies
npm install

# 2. Start the backend server (runs on port 8091)
npm run server

# 3. In another terminal, start the Vite frontend with dev proxy (runs on port 5173)
npm run dev
```

Open `http://localhost:5173` or `http://<your-lan-ip>:5173` on any computer on the local network.

## Production Run (Single Process)

```bash
# Build frontend and start integrated server hosting API, WebSockets, and SPA
npm run build
npm start
```

Access the board at `http://<your-lan-ip>:8091`.

## Docker Deployment

To run as a self-contained container on your central server host:

```bash
docker compose up -d --build
```

The application will be accessible to all authorized devices on your local network at:
`http://<server-lan-ip>:8091`

The SQLite database is stored in `./data/flowboard.db` and is preserved across container restarts.

## Verification & Tests

Run the automated integration and security test suite:

```bash
npm test
```

This verifies:
1. Health check & protected routes
2. Rate-limiting brute force lockout (5 attempts)
3. Cryptographic authentication & session management
4. Role-based access control (Admin vs. Viewer)
5. SQL injection immunity
6. Optimistic concurrency conflict rejection (409 Conflict)
7. Card comment collaboration
8. Security audit trail logging
