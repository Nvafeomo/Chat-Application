export interface ChatMessage {
  type: 'chat' | 'system'
  username?: string
  content: string
  timestamp?: string
}
