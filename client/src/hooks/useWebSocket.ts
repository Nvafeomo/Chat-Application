import { useEffect, useRef, useState, useCallback } from 'react'
import type { ConnectionConfig } from '../App'

export interface WSMessage {
  type: string
  username?: string
  content: string
  timestamp?: string
}

export function useWebSocket(config: ConnectionConfig) {
  const [messages, setMessages] = useState<WSMessage[]>([])
  const [members, setMembers] = useState<string>('')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number>()

  const connect = useCallback((): WebSocket => {
    const protocol = config.serverUrl.startsWith('https') ? 'wss' : 'ws'
    const host = config.serverUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const wsUrl = `${protocol}://${host}/ws?username=${encodeURIComponent(config.username)}&room=${encodeURIComponent(config.room)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>
        const msgType = String(msg?.type ?? '')
        if (msgType === 'members') {
          setMembers(String(msg?.content ?? ''))
        } else {
          // Add chat, system, or any other message to the list
          setMessages((prev) => [...prev, {
            type: msgType || 'chat',
            username: msg?.username as string | undefined,
            content: String(msg?.content ?? ''),
          }])
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      ws.close()
    }

    return ws
  }, [config.username, config.room, config.serverUrl])

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

  return { messages, members, connected, send, reconnect }
}
