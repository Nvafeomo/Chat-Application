# Chat App

Real-time chat app — Go WebSocket backend, React frontend. Started as a group project (C TCP server with pthreads on a Linux VM), then I added the Go server, React client, and Docker setup. The original C code is still in `c-server/` if you want to mess with it.


## Quick Start

**Docker (easiest):**
```bash
docker compose up --build
```
Client at http://localhost:3000, server at http://localhost:8080

**Local dev — Go backend + React:**
```bash
# terminal 1
cd server && go run .

# terminal 2
cd client && npm install && npm run dev
```
Hit http://localhost:5173, put in a username and room name (e.g. `general`), join. Both people need to be in the same room to see messages.

**No Go?** Use the Node backend instead:
```bash
cd server-node && npm install && npm start
```
Frontend same as above.

## What it does

- Multi-room chat (create/join by name)
- WebSockets, real-time
- Go channels + goroutines for concurrency
- Reconnect works, member list on join

## Project layout

```
├── server/          # Go WebSocket server
├── server-node/     # Node.js alternative (no Go needed)
├── client/          # React + Vite frontend
├── c-server/        # Original C implementation (Linux/WSL only)
```

## C server (Linux/WSL only)

The C version uses POSIX sockets and pthreads — won't build on Windows. Use WSL or a Linux VM.

```bash
cd c-server
make
./server 8080          # terminal 1
./client localhost 8080 # terminal 2
```

Sends `-1` to clients when the server is full. Ctrl+C to stop.

## Requirements

- Go 1.21+ (or use server-node)
- Node 18+
- Docker (optional)

## Troubleshooting

- **Port 8080 in use:** `netstat -ano | findstr :8080` to find PID, then `taskkill /PID <pid> /F`
- **Messages not showing:** Same room? Check that both users joined e.g. `general`
- **WebSocket fails:** Is the Go server running? Lobby URL set to `localhost:8080`?

MIT
