import { useState } from 'react'
import { Lobby } from './components/Lobby'
import { ChatRoom } from './components/ChatRoom'

export type ConnectionConfig = {
  username: string
  room: string
  password: string
  serverUrl: string
  /** True when joining right after creating this room in the lobby (same session). */
  roomCreator?: boolean
}

function App() {
  const [config, setConfig] = useState<ConnectionConfig | null>(null)

  if (config) {
    return <ChatRoom config={config} onLeave={() => setConfig(null)} />
  }

  return <Lobby onJoin={setConfig} />
}

export default App
