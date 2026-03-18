import { useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import type { ConnectionConfig } from '../App'

interface ChatRoomProps {
  config: ConnectionConfig
  onLeave: () => void
}

export function ChatRoom({ config, onLeave }: ChatRoomProps) {
  const { messages, members, connected, send, reconnect } = useWebSocket(config)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const content = inputRef.current?.value?.trim()
    if (content) {
      send(content)
      inputRef.current!.value = ''
    }
  }

  return (
    <div className="chat-room">
      <header className="chat-header">
        <div className="header-info">
          <h2>#{config.room}</h2>
          <span className={`status ${connected ? 'online' : 'offline'}`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
          {members && (
            <span className="members">{members} online</span>
          )}
        </div>
        <div className="header-actions">
          {!connected && (
            <button onClick={reconnect} className="btn-secondary">
              Reconnect
            </button>
          )}
          <button onClick={onLeave} className="btn-secondary">
            Leave
          </button>
        </div>
      </header>

      <div className="messages">
        {messages.map((msg, i) => (
          <div
            key={`${msg.type}-${msg.username ?? ''}-${msg.content}-${i}`}
            className={`message ${msg.type === 'system' ? 'system' : ''}`}
          >
            {msg.type === 'system' ? (
              <span className="system-text">{msg.content}</span>
            ) : (
              <>
                <span className="message-username">{msg.username}:</span>
                <span className="message-content">{msg.content}</span>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          disabled={!connected}
          maxLength={1024}
        />
        <button type="submit" disabled={!connected} className="btn-send">
          Send
        </button>
      </form>
    </div>
  )
}
