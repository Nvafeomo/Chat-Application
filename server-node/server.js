/**
 * Node.js WebSocket Chat Server (parity with Go): password rooms, public/private, REST /api/rooms.
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 8080;

const MIN_PASS = 4;
const MAX_PASS = 72;
const DEFAULT_PUBLIC_LIMIT = 24;
const MAX_PUBLIC_LIMIT = 50;

/** @type {Map<string, { hash: string, public: boolean, createdAt: number }>} */
const roomRegistry = new Map();

function normRoom(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function listRecentPublicRooms(limit) {
  if (!limit || limit < 1 || limit > MAX_PUBLIC_LIMIT) limit = DEFAULT_PUBLIC_LIMIT;
  const arr = [...roomRegistry.entries()]
    .filter(([, m]) => m.public)
    .sort((a, b) => b[1].createdAt - a[1].createdAt)
    .slice(0, limit)
    .map(([name]) => name);
  return arr;
}

// room -> clientId -> { id, username, ws }
const rooms = new Map();

function broadcastToRoom(room, message, excludeClientId = null) {
  const roomClients = rooms.get(room);
  if (!roomClients) return;

  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const [id, client] of roomClients) {
    if (id !== excludeClientId && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function getRoomMembers(room) {
  const roomClients = rooms.get(room);
  if (!roomClients) return '';
  return [...roomClients.values()].map((c) => c.username).join(', ');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const u = new URL(req.url || '/', baseUrl);

  if (u.pathname === '/api/rooms' && req.method === 'GET') {
    let limit = parseInt(u.searchParams.get('limit') || '', 10);
    if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_PUBLIC_LIMIT;
    if (limit > MAX_PUBLIC_LIMIT) limit = MAX_PUBLIC_LIMIT;
    const names = listRecentPublicRooms(limit);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(names));
    return;
  }

  if (u.pathname === '/api/rooms' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => {
      body += c;
    });
    req.on('end', () => {
      try {
        const { name, password, public: isPublic } = JSON.parse(body);
        const key = normRoom(name);
        if (!key || key.length > 64) {
          res.writeHead(400);
          res.end('invalid room name');
          return;
        }
        if (roomRegistry.has(key)) {
          res.writeHead(409);
          res.end('room already exists');
          return;
        }
        const pub = Boolean(isPublic);
        if (pub) {
          roomRegistry.set(key, {
            hash: null,
            public: true,
            createdAt: Date.now(),
          });
        } else {
          if (!password || password.length < MIN_PASS || password.length > MAX_PASS) {
            res.writeHead(400);
            res.end('password must be 4–72 characters');
            return;
          }
          const hash = bcrypt.hashSync(password, 10);
          roomRegistry.set(key, {
            hash,
            public: false,
            createdAt: Date.now(),
          });
        }
        res.writeHead(201);
        res.end();
      } catch {
        res.writeHead(400);
        res.end('invalid JSON');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const username = url.searchParams.get('username')?.trim() || '';
  const roomRaw = url.searchParams.get('room')?.trim() || '';
  const password = url.searchParams.get('password') || '';
  const room = normRoom(roomRaw);

  if (!username || username.length > 32 || !room || room.length > 64) {
    ws.close(4000, 'username and room required');
    return;
  }

  const meta = roomRegistry.get(room);
  if (!meta) {
    ws.close(4004, 'room not found');
    return;
  }
  if (!meta.public && !bcrypt.compareSync(password, meta.hash || '')) {
    ws.close(4001, 'wrong password');
    return;
  }

  const clientId = randomUUID();

  if (!rooms.has(room)) {
    rooms.set(room, new Map());
  }
  rooms.get(room).set(clientId, { id: clientId, username, ws });

  broadcastToRoom(
    room,
    { type: 'system', content: `${username} joined the room`, username },
    clientId
  );

  ws.send(JSON.stringify({ type: 'room_meta', room_public: meta.public }));
  ws.send(JSON.stringify({ type: 'members', content: getRoomMembers(room) }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'chat' && msg.content) {
        broadcastToRoom(room, {
          type: 'chat',
          username,
          content: msg.content,
          client_id: clientId,
        });
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    const roomClients = rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        rooms.delete(room);
      } else {
        broadcastToRoom(room, {
          type: 'system',
          content: `${username} left the room`,
          username,
        });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
