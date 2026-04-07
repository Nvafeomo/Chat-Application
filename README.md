# Chat App

A real-time, multi-room chat you can run locally or in Docker. It started as a group exercise: a C TCP server with pthreads on a Linux VM. I later added a **Go** WebSocket server with channels and goroutines, a **React + Vite** client, and a **Node** backend for anyone who does not want to install Go. The original POSIX implementation is still in `c-server/` if you want to compare approaches. Building this gave me a small end-to-end surface for WebSockets, concurrent connection handling, and a simple lobby → room UX.

## What it does

- **Rooms:** **Subscribe** in chat to pin rooms to the lobby; **recent joins** (last 4 on this device) sit near room/password. **Autocomplete** on the room field after **3+ characters** merges public names from the server with subscribed + recent. **Private** rooms prompt for password in the join form when we know they’re private. Passwords stored as **bcrypt** hashes in memory. The **creator** can reopen a saved password from this **browser only** (localStorage) via **Password** in the header.
- **Real-time:** WebSockets for instant delivery; your own messages are styled differently from others in the UI.
- **Resilience:** Reconnect flow and a live member count when the server sends room updates.
- **Backends:** Primary **Go** server, drop-in **Node** alternative, optional **Docker** compose for one-command runs.
- **C variant (Linux/WSL):** Classic sockets + pthreads client/server pair (no password rooms; separate from the Go/Node flow).

## Stack

**Go 1.22+ · Gorilla WebSocket · golang.org/x/crypto/bcrypt · React 18 · TypeScript · Vite · Node.js (optional server) · Docker (optional) · C + pthreads (`c-server/`, POSIX only)**

## Demo

**Lobby — pick a username and room**

<img src="screenshots/enterchat1.png" alt="Chat app lobby: username, server URL, and room name" width="720" />

**Chat room**

<img src="screenshots/chatroom1.png" alt="Chat room with messages and connection status" width="720" />

<img src="screenshots/chatroom2.png" alt="Chat room with message list and input" width="720" />

## Run locally

You will need **Node.js 18+** (LTS is fine). For the default backend you also need **Go 1.22+**, or use the Node server instead. **Docker** is optional but handy for a full stack in one command.

### Docker (simplest)

```bash
docker compose up --build
```

- **Client:** http://localhost:3000  
- **Server:** http://localhost:8080  

### Deploy (PaaS)

See [DEPLOY.md](DEPLOY.md) for a short Railway / Render flow using Docker Compose.

### Go server + React client

**Terminal 1 — backend**

```bash
cd server
go run .
```

**Terminal 2 — frontend**

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. Under **Create a room**, register a name and password, then switch to **Join a room** (or share the name + password with others). Everyone needs the **same room name and password** to chat together.

From the repo root you can start only the client with `npm run dev:client` (still run the Go server separately).

### No Go? Use the Node server

```bash
cd server-node
npm install
npm start
```

Use the same `client` steps as above (`npm install` and `npm run dev` in `client/`).

## C server (Linux / WSL only)

The C code uses POSIX sockets and pthreads; it does not build as-is on native Windows. Use WSL or Linux.

```bash
cd c-server
make
./server 8080           # terminal 1
./client localhost 8080 # terminal 2
```

The server sends `-1` to clients when it is full. Stop with Ctrl+C.

## Project layout

```
├── server/          # Go WebSocket server
├── server-node/     # Node.js alternative (no Go required)
├── client/          # React + Vite frontend
├── c-server/        # Original C implementation (POSIX)
└── screenshots/     # UI screenshots for this README
```

## Troubleshooting

- **Port 8080 in use (Windows):** `netstat -ano | findstr :8080` to find the PID, then `taskkill /PID <pid> /F`.
- **Messages not appearing:** Same room name and password? Did someone **create** the room first (`Create a room`)?
- **WebSocket fails after “Join”:** Wrong password or room name; the room must exist on the server.
- **WebSocket errors:** Ensure the Go (or Node) server is running and the lobby server URL matches (e.g. `http://localhost:8080`).

## License

MIT
