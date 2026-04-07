# Deploy quickly (Docker Compose)

The app is two containers: **Go** (`server`) and **nginx + static UI** (`client`). Nginx proxies `/ws` to the Go service on the Docker network. The UI defaults to **same-origin** in production builds so WebSockets hit `wss://your-client-host/ws` (no manual server URL on first load).

## Railway (good default)

1. Push this repo to **GitHub** (if it is not already).
2. Sign in at [railway.app](https://railway.app) with GitHub.
3. **New Project** → **Deploy from GitHub repo** → choose this repository.
4. When Railway detects **`docker-compose.yml`**, deploy **both** services (`server` and `client`).
5. Open the **client** service → **Settings** → **Networking** → **Generate Domain** (public URL).
6. Visit that URL — join a room and chat. The **Server** field should already show your site origin (`https://…`).

**Tips**

- Give **only the client** a public domain if you want; the Go server can stay private as long as the client container can reach `http://server:8080` (Compose service name).
- If the client fails health checks, ensure the platform sets **`PORT`** — the client image listens on `$PORT` (defaults to `80` locally).

## Render (alternative)

1. Create two **Web Services** from the same repo.
2. **API service:** Docker → `Dockerfile.server`, port **8080**.
3. **UI service:** Docker → `Dockerfile.client`, set **internal port** to match **`PORT`** (often **80** or whatever Render assigns; the entrypoint maps nginx to `$PORT`).
4. Prefer **one** Compose-friendly host (Railway) unless you enjoy wiring two public URLs and CORS/proxy details.

## Fly.io / others

Same idea: run Compose or two images, public URL on the **client**, internal routing to **server:8080**.

## Verify locally (production-like UI)

```bash
docker compose up --build
```

Open **http://localhost:3000** — the lobby **Server** field should read **http://localhost:3000** (same origin; nginx proxies `/ws`).
