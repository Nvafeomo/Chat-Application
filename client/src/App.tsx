import { useState } from 'react'
import { Lobby } from './components/Lobby'
import { ChatRoom } from './components/ChatRoom'

export type ConnectionConfig = {
  username: string
  room: string
  serverUrl: string
}

function App() {
  const [config, setConfig] = useState<ConnectionConfig | null>(null)

  if (config) {
    return <ChatRoom config={config} onLeave={() => setConfig(null)} />
  }

  return <Lobby onJoin={setConfig} />
}

export default App
