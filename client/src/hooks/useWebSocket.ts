import { useEffect, useRef, useState, useCallback } from 'react'
import type { ConnectionConfig } from '../App'
import { isPublicFlag } from '../roomStorage'

export interface WSMessage {
  type: string
  username?: string
  content: string
  timestamp?: string
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed'

export function useWebSocket(config: ConnectionConfig) {
  const [messages, setMessages] = useState<WSMessage[]>([])
  const [members, setMembers] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [roomMeta, setRoomMeta] = useState<{ public: boolean } | null>(null)
  const [closeHint, setCloseHint] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()
  /** Increments each new connection attempt; handlers compare to their captured id (not wsRef — ref is overwritten before old onopen can run). */
  const generationRef = useRef(0)

  const connect = useCallback((): WebSocket => {
    setRoomMeta(null)
    setCloseHint(null)
    setConnectionStatus('connecting')
    generationRef.current += 1
    const myId = generationRef.current

    const protocol = config.serverUrl.startsWith('https') ? 'wss' : 'ws'
    const host = config.serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const wsUrl = `${protocol}://${host}/ws?username=${encodeURIComponent(config.username)}&room=${encodeURIComponent(config.room)}&password=${encodeURIComponent(config.password)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    const isStale = () => generationRef.current !== myId

    ws.onopen = () => {
      if (isStale()) return
      setConnectionStatus('open')
    }

    ws.onmessage = (event) => {
      if (isStale()) return
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>
        const msgType = String(msg?.type ?? '')
        if (msgType === 'members') {
          setMembers(String(msg?.content ?? ''))
        } else if (msgType === 'room_meta') {
          setRoomMeta({ public: isPublicFlag(msg?.room_public) })
        } else {
          setMessages((prev) => [
            ...prev,
            {
              type: msgType || 'chat',
              username: msg?.username as string | undefined,
              content: String(msg?.content ?? ''),
            },
          ])
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = (ev) => {
      if (isStale()) return
      wsRef.current = null
      setConnectionStatus('closed')
      if (ev.code !== 1000) {
        const r = ev.reason?.trim()
        setCloseHint(r ? `${ev.code}: ${r}` : `Closed (${ev.code})`)
      }
    }

    ws.onerror = () => {
      ws.close()
    }

    return ws
  }, [config.username, config.room, config.password, config.serverUrl])

  useEffect(() => {
    const ws = connect()
    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      if (ws) ws.close()
    }
  }, [connect])

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && content.trim()) {
      wsRef.current.send(JSON.stringify({ type: 'chat', content: content.trim() }))
    }
  }, [])

  const reconnect = useCallback(() => {
    wsRef.current?.close()
    reconnectTimeoutRef.current = window.setTimeout(connect, 500)
  }, [connect])

  const connected = connectionStatus === 'open'

  return { messages, members, connected, connectionStatus, roomMeta, closeHint, send, reconnect }
}
