/** Browser-only: creator passwords, subscriptions, and recent joins (per device). */

const CREATOR_PW_KEY = 'chatapp_creator_passwords_v1'
const JOINED_KEY = 'chatapp_joined_rooms_v1'
const SUBSCRIBED_KEY = 'chatapp_subscribed_v1'
const RECENT_KEY = 'chatapp_recent_joins_v1'

const MAX_RECENT = 4

export function normalizeServerOrigin(serverUrl: string): string {
  const s = serverUrl.trim()
  return s.includes('://') ? s.replace(/\/$/, '') : `http://${s.replace(/\/$/, '')}`
}

function joinKey(serverUrl: string, room: string): string {
  return `${normalizeServerOrigin(serverUrl)}::${room.trim().toLowerCase()}`
}

/** Only explicit true counts as public (avoids Boolean("false") === true). */
export function isPublicFlag(value: unknown): boolean {
  return value === true
}

/** Saved when you create a room — only this browser can show recovery. */
export function saveCreatorPassword(serverUrl: string, room: string, password: string): void {
  try {
    const raw = localStorage.getItem(CREATOR_PW_KEY)
    const data: Record<string, string> = raw ? JSON.parse(raw) : {}
    data[joinKey(serverUrl, room)] = password
    localStorage.setItem(CREATOR_PW_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function getCreatorPassword(serverUrl: string, room: string): string | null {
  try {
    const raw = localStorage.getItem(CREATOR_PW_KEY)
    if (!raw) return null
    const data: Record<string, string> = JSON.parse(raw)
    return data[joinKey(serverUrl, room)] ?? null
  } catch {
    return null
  }
}

/** Room names you created on this device (private rooms only — public creators have no saved password). */
export function getCreatorRoomNames(serverUrl: string): string[] {
  const prefix = `${normalizeServerOrigin(serverUrl)}::`
  try {
    const raw = localStorage.getItem(CREATOR_PW_KEY)
    if (!raw) return []
    const data: Record<string, string> = JSON.parse(raw)
    const out: string[] = []
    for (const k of Object.keys(data)) {
      if (!k.startsWith(prefix)) continue
      const r = k.slice(prefix.length)
      if (r) out.push(r)
    }
    return out.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** @deprecated use pushRecentJoin — kept for one-way migration */
export function saveJoinedRoomMeta(serverUrl: string, room: string, isPublic: boolean): void {
  pushRecentJoin(serverUrl, room, isPublic)
}

type SubscribedEntry = { public: boolean; subscribedAt: number }

/** Subscribe to a room (e.g. from chat header). */
export function subscribeRoom(serverUrl: string, room: string, isPublic: boolean): void {
  try {
    const raw = localStorage.getItem(SUBSCRIBED_KEY)
    const data: Record<string, SubscribedEntry> = raw ? JSON.parse(raw) : {}
    data[joinKey(serverUrl, room)] = {
      public: isPublic === true,
      subscribedAt: Date.now(),
    }
    localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function unsubscribeRoom(serverUrl: string, room: string): void {
  try {
    const raw = localStorage.getItem(SUBSCRIBED_KEY)
    if (!raw) return
    const data: Record<string, SubscribedEntry> = JSON.parse(raw)
    delete data[joinKey(serverUrl, room)]
    localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function isSubscribed(serverUrl: string, room: string): boolean {
  try {
    const raw = localStorage.getItem(SUBSCRIBED_KEY)
    if (!raw) return false
    const data: Record<string, SubscribedEntry> = JSON.parse(raw)
    return Boolean(data[joinKey(serverUrl, room)])
  } catch {
    return false
  }
}

export function getSubscribedRooms(serverUrl: string): { room: string; public: boolean; subscribedAt: number }[] {
  const prefix = `${normalizeServerOrigin(serverUrl)}::`
  try {
    const raw = localStorage.getItem(SUBSCRIBED_KEY)
    if (!raw) return []
    const data: Record<string, SubscribedEntry> = JSON.parse(raw)
    const out: { room: string; public: boolean; subscribedAt: number }[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith(prefix)) continue
      const room = k.slice(prefix.length)
      if (room && v) {
        out.push({
          room,
          public: isPublicFlag(v.public),
          subscribedAt: typeof v.subscribedAt === 'number' ? v.subscribedAt : 0,
        })
      }
    }
    out.sort((a, b) => b.subscribedAt - a.subscribedAt)
    return out
  } catch {
    return []
  }
}

/** Last few joins per server (for quick bubbles near room/password). */
export function pushRecentJoin(serverUrl: string, room: string, isPublic: boolean): void {
  try {
    const origin = normalizeServerOrigin(serverUrl)
    const raw = localStorage.getItem(RECENT_KEY)
    const data: Record<string, { room: string; public: boolean; joinedAt: number }[]> = raw
      ? JSON.parse(raw)
      : {}
    const rname = room.trim().toLowerCase()
    if (!rname) return
    let list = data[origin] ?? []
    list = list.filter((e) => e.room.toLowerCase() !== rname)
    list.unshift({ room: rname, public: isPublic === true, joinedAt: Date.now() })
    list = list.slice(0, MAX_RECENT)
    data[origin] = list
    localStorage.setItem(RECENT_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function getRecentJoins(serverUrl: string): { room: string; public: boolean }[] {
  const origin = normalizeServerOrigin(serverUrl)
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const data: Record<string, { room: string; public: boolean }[]> = JSON.parse(raw)
    const list = data[origin] ?? []
    return list.map((e) => ({ room: e.room, public: isPublicFlag(e.public) }))
  } catch {
    return []
  }
}

/** Legacy joined list — used only to migrate into recent if needed. */
export function getJoinedRoomsForServer(serverUrl: string): { room: string; public: boolean }[] {
  const prefix = `${normalizeServerOrigin(serverUrl)}::`
  try {
    const raw = localStorage.getItem(JOINED_KEY)
    if (!raw) return []
    const data: Record<string, { public: boolean }> = JSON.parse(raw)
    const out: { room: string; public: boolean }[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith(prefix)) continue
      const room = k.slice(prefix.length)
      if (room) out.push({ room, public: isPublicFlag(v?.public) })
    }
    out.sort((a, b) => a.room.localeCompare(b.room))
    return out
  } catch {
    return []
  }
}

/** One-time: copy legacy joined entries into recent if recent is empty. */
export function migrateLegacyJoinedToRecent(serverUrl: string): void {
  try {
    const recent = getRecentJoins(serverUrl)
    if (recent.length > 0) return
    const legacy = getJoinedRoomsForServer(serverUrl)
    for (const { room, public: pub } of legacy.slice(-MAX_RECENT)) {
      pushRecentJoin(serverUrl, room, pub)
    }
  } catch {
    /* ignore */
  }
}

/** Whether we know a room is public, private, or unknown (typed manually / not in lists). */
export function lookupRoomKind(
  roomName: string,
  publicApiNames: string[],
  subscribed: { room: string; public: boolean }[],
  recent: { room: string; public: boolean }[],
): 'public' | 'private' | 'unknown' {
  const n = roomName.trim().toLowerCase()
  if (!n) return 'unknown'
  if (publicApiNames.some((x) => x.toLowerCase() === n)) return 'public'
  const s = subscribed.find((x) => x.room.toLowerCase() === n)
  if (s) return s.public ? 'public' : 'private'
  const r = recent.find((x) => x.room.toLowerCase() === n)
  if (r) return r.public ? 'public' : 'private'
  return 'unknown'
}
