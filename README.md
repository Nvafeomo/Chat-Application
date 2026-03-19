# Chat App

A production-grade real-time chat application demonstrating **distributed systems**, **concurrent programming**, and **full-stack development**. Built for systems engineering and software engineering roles.

This project originated from a **group assignment** implementing a multi-client TCP chat server in C using POSIX sockets and pthreads. The C server was written and tested in a Linux virtual machine (Ubuntu). The project has since been expanded with a Go WebSocket backend, React frontend, and Docker deployment, while preserving the C implementation as a systems showcase.

![Architecture](https://img.shields.io/badge/Go-WebSocket%20Server-00ADD8?style=flat&logo=go)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB?style=flat&logo=react)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)

---

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  React Client   │ ◄────────────────► │   Go Server      │
│  (TypeScript)   │     ws://          │   (Gorilla WS)    │
└─────────────────┘                    └──────────────────┘
        │                                        │
        │                                        │ Hub (channels)
        │                                        │ - Room management
        │                                        │ - Broadcast
        │                                        ▼
        │                               ┌──────────────────┐
        └──────────────────────────────│  Multiple Rooms   │
                                       │  Concurrent conns │
                                       └──────────────────┘
```

**Tech Stack:**
- **Backend:** Go 1.21, Gorilla WebSocket, channel-based concurrency
- **Frontend:** React 18, TypeScript, Vite
- **Deployment:** Docker Compose, multi-stage builds
- **Legacy (Systems):** C, POSIX sockets, pthreads (see `c-server/`)

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker compose up --build
```

- **Client:** http://localhost:3000  
- **Server:** http://localhost:8080  
- **Health:** http://localhost:8080/health  

### Option 2: Local Development (Go)

**Terminal 1 — Backend:**
```bash
cd server
go run .
# Server on :8080
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
# Client on http://localhost:5173
```

Open http://localhost:5173 in your browser. The lobby defaults to `localhost:8080` as the server URL. Enter a username, room (e.g. `general`), and click **Join Chat**. Both users must join the **same room** to see each other's messages.

### Option 3: Local Development (Node.js — no Go required)

**Backend:**
```bash
cd server-node
npm install
npm start
# Server on :8080
```

**Frontend:** Same as Option 2.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-room** | Create/join rooms by name (e.g. `general`, `dev`) |
| **Real-time** | WebSocket-based, sub-second latency |
| **Concurrent** | Go channels + goroutines for scalable I/O |
| **Thread-safe** | Mutex-protected shared state in hub |
| **Reconnect** | Client can reconnect after disconnect |
| **Member list** | See who's in the room on join |

---

## Project Structure

```
Chat App/
├── server/                 # Go WebSocket server
│   ├── main.go
│   └── internal/
│       ├── hub/            # Room & client management
│       └── websocket/      # Connection handler
├── server-node/            # Node.js WebSocket server (alternative, no Go required)
│   ├── server.js
│   └── package.json
├── client/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
├── c-server/               # C implementation (Linux/WSL)
│   ├── server.c            # Multi-threaded TCP server
│   ├── client.c            # TCP client
│   └── Makefile
├── docker-compose.yml
├── Dockerfile.server
├── Dockerfile.client
└── README.md
```

---

## C Implementation (Systems Showcase)

**Requires Linux or WSL** — The C code uses POSIX sockets and pthreads, which are not available on native Windows. Use WSL (Windows Subsystem for Linux) or a Linux VM.

The `c-server/` directory contains a **POSIX C** implementation for systems-level understanding:

- **POSIX sockets** (TCP stream)
- **pthreads** for concurrent client handling
- **Mutex** synchronization for shared `client_sockets` array
- **Memory safety** (heap-allocated per-client args to avoid race)
- Broadcasts messages from one client to all others
- Gracefully handles client disconnects and server capacity limits (sends `-1` when full)

**Prerequisites (Linux):**
```bash
sudo apt update
sudo apt install build-essential
```

**Build & Run (Linux/WSL):**
```bash
cd c-server
make
./server 8080          # Terminal 1
./client localhost 8080   # Terminal 2+
```

Press **Ctrl+C** in the server terminal to shut down. The C server remains compatible with any standard TCP client.

---

## Requirements

- **Go 1.21+** (for Go backend)
- **Node 18+** (for frontend and Node.js backend)
- **Docker & Docker Compose** (for containerized run)
- **GCC, make** (for C implementation, Linux/WSL only)

## Troubleshooting

- **Port 8080 in use:** Stop any existing server (Ctrl+C) or run `netstat -ano | findstr :8080` to find the PID, then `taskkill /PID <pid> /F`
- **Messages not showing:** Ensure both users join the **same room** (e.g. `general`)
- **WebSocket connection failed:** Verify the Go server is running (`go run .` in `server/`) and the lobby server URL is `localhost:8080`

---

## License

MIT
