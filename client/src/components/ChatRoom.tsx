import { useRef, useEffect, useState, useCallback } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import type { ConnectionConfig } from '../App'
import {
  getCreatorPassword,
  saveJoinedRoomMeta,
  subscribeRoom,
  isSubscribed,
  unsubscribeRoom,
} from '../roomStorage'

interface ChatRoomProps {
  config: ConnectionConfig
  onLeave: () => void
}

export function ChatRoom({ config, onLeave }: ChatRoomProps) {
  const { messages, members, connected, connectionStatus, roomMeta, closeHint, send, reconnect } =
    useWebSocket(config)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showPasswordPanel, setShowPasswordPanel] = useState(false)
  const [subscribed, setSubscribed] = useState(() =>
    isSubscribed(config.serverUrl, config.room),
  )

  const savedPassword = getCreatorPassword(config.serverUrl, config.room)
  const canShowRecovery = Boolean(savedPassword)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!roomMeta) return
    saveJoinedRoomMeta(config.serverUrl, config.room, roomMeta.public)
  }, [roomMeta, config.serverUrl, config.room])

  useEffect(() => {
    setSubscribed(isSubscribed(config.serverUrl, config.room))
  }, [config.serverUrl, config.room])

  const toggleSubscribe = useCallback(() => {
    if (!roomMeta) return
    if (subscribed) {
      unsubscribeRoom(config.serverUrl, config.room)
      setSubscribed(false)
    } else {
      subscribeRoom(config.serverUrl, config.room, roomMeta.public)
      setSubscribed(true)
    }
  }, [config.serverUrl, config.room, roomMeta, subscribed])

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
          <div className="header-title-row">
            <h2>#{config.room}</h2>
            {roomMeta && (
              <span className={`room-kind-badge ${roomMeta.public ? 'is-public' : 'is-private'}`}>
                {roomMeta.public ? 'Public' : 'Private'}
              </span>
            )}
          </div>
          <div className="header-meta-row">
            <span
              className={`status ${
                connectionStatus === 'open'
                  ? 'online'
                  : connectionStatus === 'connecting'
                    ? 'connecting'
                    : 'offline'
              }`}
              title={
                connectionStatus === 'closed'
                  ? closeHint ||
                    'No WebSocket — server may be off, URL wrong, room missing, or password wrong for a private room.'
                  : undefined
              }
            >
              {connectionStatus === 'connecting' && '○ Connecting…'}
              {connectionStatus === 'open' && '● Connected'}
              {connectionStatus === 'closed' && '○ Disconnected'}
            </span>
            {members && (
              <span className="members">{members} online</span>
            )}
          </div>
          {connectionStatus === 'closed' && closeHint && (
            <p className="connection-error-hint">{closeHint}</p>
          )}
        </div>
        <div className="header-actions">
          {roomMeta && (
            <button
              type="button"
              className={`btn-secondary ${subscribed ? 'btn-subscribed' : ''}`}
              onClick={toggleSubscribe}
              title={subscribed ? 'Remove from Subscribed rooms in the lobby' : 'Show this room under Subscribed in the lobby'}
            >
              {subscribed ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          )}
          {canShowRecovery && (
            <div className="password-recovery-wrap">
              <button
                type="button"
                className="btn-secondary btn-password"
                onClick={() => setShowPasswordPanel((v) => !v)}
                title="Only you — saved on this device when you created the room"
              >
                Password
              </button>
              {showPasswordPanel && (
                <div className="password-panel" role="dialog" aria-label="Saved room password">
                  <p className="password-panel-hint">Emergency recovery (this browser only — not sent to others)</p>
                  <code className="password-reveal">{savedPassword}</code>
                </div>
              )}
            </div>
          )}
          {connectionStatus === 'closed' && (
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
            className={`message ${
              msg.type === 'system'
                ? 'system'
                : msg.username === config.username
                  ? 'message-own'
                  : 'message-other'
            }`}
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
