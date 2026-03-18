/**
 * Node.js WebSocket Chat Server
 * Drop-in alternative when Go is not installed.
 * Run: npm install && npm start
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 8080;

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

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const username = url.searchParams.get('username')?.trim() || '';
  const room = url.searchParams.get('room')?.trim() || 'general';

  if (!username || username.length > 32 || room.length > 64) {
    ws.close(4000, 'username and room required');
    return;
  }

  const clientId = randomUUID();

  if (!rooms.has(room)) {
    rooms.set(room, new Map());
  }
  rooms.get(room).set(clientId, { id: clientId, username, ws });

  // Notify others
  broadcastToRoom(
    room,
    { type: 'system', content: `${username} joined the room`, username },
    clientId
  );

  // Send member list to new client
  ws.send(
    JSON.stringify({ type: 'members', content: getRoomMembers(room) })
  );

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'chat' && msg.content) {
  // Broadcast to all in room (everyone sees every message)
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
