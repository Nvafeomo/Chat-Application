import { useState } from 'react'
import type { ConnectionConfig } from '../App'

interface LobbyProps {
  onJoin: (config: ConnectionConfig) => void
}

export function Lobby({ onJoin }: LobbyProps) {
  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('general')
  const [serverUrl, setServerUrl] = useState(() => {
    if (typeof window === 'undefined') return 'localhost:8080'
    // Connect directly to backend; use window.location.host only when on port 3000 (Docker)
    return window.location.port === '3000' ? window.location.host : 'localhost:8080'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    const host = serverUrl.includes('://') ? serverUrl : `http://${serverUrl}`
    onJoin({
      username: username.trim(),
      room: room.trim() || 'general',
      serverUrl: host,
    })
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <h1>Chat App</h1>
          <p>Real-time messaging with WebSockets</p>
        </div>

        <form onSubmit={handleSubmit} className="lobby-form">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={32}
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label htmlFor="room">Room</label>
            <input
              id="room"
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="general"
              maxLength={64}
            />
          </div>

          <div className="field">
            <label htmlFor="server">Server</label>
            <input
              id="server"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="localhost:8080"
            />
          </div>

          <button type="submit" className="btn-primary">
            Join Chat
          </button>
        </form>
      </div>
    </div>
  )
}
