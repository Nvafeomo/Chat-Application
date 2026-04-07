import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { ConnectionConfig } from '../App'
import {
  saveCreatorPassword,
  pushRecentJoin,
  migrateLegacyJoinedToRecent,
  getSubscribedRooms,
  getRecentJoins,
  getCreatorPassword,
  getCreatorRoomNames,
  getJoinedRoomsForServer,
  lookupRoomKind,
} from '../roomStorage'

interface LobbyProps {
  onJoin: (config: ConnectionConfig) => void
}

function apiOrigin(serverUrl: string): string {
  const s = serverUrl.trim()
  return s.includes('://') ? s.replace(/\/$/, '') : `http://${s.replace(/\/$/, '')}`
}

export function Lobby({ onJoin }: LobbyProps) {
  const [mode, setMode] = useState<'join' | 'create'>('join')
  const [username, setUsername] = useState('')
  /**
   * Dev default: chat server on :8080 (direct; avoids flaky Vite WS proxy). Production: this site’s origin.
   */
  const [serverUrl, setServerUrl] = useState(() => {
    if (typeof window === 'undefined') return 'http://localhost:8080'
    if (import.meta.env.DEV) return 'http://localhost:8080'
    return window.location.origin
  })

  const [roomList, setRoomList] = useState<string[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [room, setRoom] = useState('')
  const [password, setPassword] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  const [newRoomName, setNewRoomName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPublicRoom, setIsPublicRoom] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false)

  const [subscribedList, setSubscribedList] = useState<
    { room: string; public: boolean; subscribedAt: number }[]
  >([])
  const [recentList, setRecentList] = useState<{ room: string; public: boolean }[]>([])

  const origin = useMemo(() => apiOrigin(serverUrl), [serverUrl])

  const joinBaseUrl = useMemo(() => {
    const host = serverUrl.includes('://') ? serverUrl : `http://${serverUrl}`
    return host.replace(/\/$/, '')
  }, [serverUrl])

  /** Saved when this browser created the room — rejoin without typing the password. */
  const creatorPasswordForRoom = useMemo(
    () => (room.trim() ? getCreatorPassword(joinBaseUrl, room) : null),
    [joinBaseUrl, room],
  )

  const refreshLocalLists = useCallback(() => {
    setSubscribedList(getSubscribedRooms(serverUrl))
    setRecentList(getRecentJoins(serverUrl))
  }, [serverUrl])

  useEffect(() => {
    migrateLegacyJoinedToRecent(serverUrl)
    refreshLocalLists()
  }, [serverUrl, refreshLocalLists])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingRooms(true)
      setError(null)
      try {
        const r = await fetch(`${origin}/api/rooms?limit=24`)
        if (!r.ok) throw new Error('Could not load room list')
        const data = (await r.json()) as string[]
        if (!cancelled) setRoomList(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) {
          setRoomList([])
          setError(
            'Could not reach the chat server. Start it on port 8080 (default in dev) or set Server URL to your backend.',
          )
        }
      } finally {
        if (!cancelled) setLoadingRooms(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [origin])

  const refreshPublicList = async () => {
    setLoadingRooms(true)
    setError(null)
    try {
      const r = await fetch(`${origin}/api/rooms?limit=24`)
      if (!r.ok) throw new Error('Could not load room list')
      const data = (await r.json()) as string[]
      setRoomList(Array.isArray(data) ? data : [])
    } catch {
      setError('Could not refresh public room list.')
    } finally {
      setLoadingRooms(false)
    }
  }

  /**
   * After 3+ characters: names from public API, subscribed, recent, legacy joined,
   * and private rooms you created on this device. Public vs private is labeled in the dropdown.
   */
  const roomSuggestions = useMemo(() => {
    const t = room.trim()
    if (t.length < 3) return [] as { name: string; isPublic: boolean }[]
    const q = t.toLowerCase()

    const flags = new Map<string, boolean>()
    const display = new Map<string, string>()

    const addDisplay = (name: string) => {
      const k = name.trim().toLowerCase()
      if (!k) return
      if (!display.has(k)) display.set(k, name.trim())
    }

    for (const n of roomList) {
      const k = n.toLowerCase()
      flags.set(k, true)
      addDisplay(n)
    }
    for (const s of subscribedList) {
      const k = s.room.toLowerCase()
      if (!flags.has(k)) flags.set(k, s.public)
      addDisplay(s.room)
    }
    for (const r of recentList) {
      const k = r.room.toLowerCase()
      if (!flags.has(k)) flags.set(k, r.public)
      addDisplay(r.room)
    }
    for (const j of getJoinedRoomsForServer(serverUrl)) {
      const k = j.room.toLowerCase()
      if (!flags.has(k)) flags.set(k, j.public)
      addDisplay(j.room)
    }
    for (const c of getCreatorRoomNames(joinBaseUrl)) {
      const k = c.toLowerCase()
      if (!flags.has(k)) flags.set(k, false)
      addDisplay(c)
    }

    const out: { name: string; isPublic: boolean }[] = []
    for (const [k, isPublic] of flags.entries()) {
      const name = display.get(k) ?? k
      if (!name.toLowerCase().includes(q)) continue
      out.push({ name, isPublic })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [room, roomList, subscribedList, recentList, serverUrl, joinBaseUrl])

  const roomKind = useMemo(
    () =>
      lookupRoomKind(
        room,
        roomList,
        subscribedList.map((s) => ({ room: s.room, public: s.public })),
        recentList,
      ),
    [room, roomList, subscribedList, recentList],
  )

  const pickRoom = (rname: string, isPrivate: boolean) => {
    setRoom(rname)
    setError(null)
    const saved = getCreatorPassword(joinBaseUrl, rname)
    if (saved) {
      setPassword(saved)
      return
    }
    setPassword('')
    if (isPrivate) {
      window.setTimeout(() => passwordRef.current?.focus(), 0)
    }
  }

  const applyRoomSuggestion = (name: string, isPublic: boolean) => {
    setSuggestionsDismissed(true)
    pickRoom(name, !isPublic)
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim()) {
      setError('Enter a username.')
      return
    }
    const rname = room.trim().toLowerCase()
    if (!rname) {
      setError('Enter or pick a room name.')
      return
    }
    const joinPassword = creatorPasswordForRoom ?? password.trim()
    if (roomKind === 'private' && !creatorPasswordForRoom && !joinPassword) {
      setError('This room is private — enter the password.')
      passwordRef.current?.focus()
      return
    }
    onJoin({
      username: username.trim(),
      room: rname,
      password: joinPassword,
      serverUrl: joinBaseUrl,
      roomCreator: Boolean(creatorPasswordForRoom),
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!newRoomName.trim()) {
      setError('Enter a room name.')
      return
    }
    if (!isPublicRoom) {
      if (newPassword.length < 4) {
        setError('Password must be at least 4 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }
    if (!username.trim()) {
      setError('Enter a username (you will join the room after it is created).')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(`${origin}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName.trim(),
          password: isPublicRoom ? '' : newPassword,
          public: isPublicRoom,
        }),
      })
      if (r.status === 409) {
        setError('That room name is already taken.')
        return
      }
      if (!r.ok) {
        const t = await r.text()
        setError(t || 'Could not create room.')
        return
      }
      const host = serverUrl.includes('://') ? serverUrl : `http://${serverUrl}`
      const base = host.replace(/\/$/, '')
      const created = newRoomName.trim().toLowerCase()
      if (!isPublicRoom) {
        saveCreatorPassword(base, created, newPassword)
      }
      pushRecentJoin(base, created, isPublicRoom)
      refreshLocalLists()
      await refreshPublicList()
      setNewPassword('')
      setConfirmPassword('')
      setNewRoomName('')
      onJoin({
        username: username.trim(),
        room: created,
        password: isPublicRoom ? '' : newPassword,
        serverUrl: base,
        roomCreator: true,
      })
    } catch {
      setError('Network error — is the server running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card lobby-card-wide">
        <div className="lobby-header">
          <h1>Chat App</h1>
          <p>Subscribe in chat to pin rooms here; recent joins help you jump back in</p>
        </div>

        <div className="lobby-tabs" role="tablist">
          <button
            type="button"
            className={mode === 'join' ? 'tab active' : 'tab'}
            onClick={() => { setMode('join'); setError(null) }}
          >
            Join a room
          </button>
          <button
            type="button"
            className={mode === 'create' ? 'tab active' : 'tab'}
            onClick={() => { setMode('create'); setError(null) }}
          >
            Create a room
          </button>
        </div>

        {error && <p className="lobby-error">{error}</p>}

        <div className="field">
          <label htmlFor="server">Server API</label>
          <input
            id="server"
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:8080"
          />
        </div>

        {mode === 'join' ? (
          <form className="lobby-form" onSubmit={handleJoin}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                maxLength={32}
                autoFocus
                required
              />
            </div>

            {subscribedList.length > 0 && (
              <div className="field">
                <div className="field-row">
                  <label>Subscribed rooms</label>
                  <span className="field-hint-inline">Use Subscribe in chat to add</span>
                </div>
                <div className="room-bubbles room-bubbles--subscribed" role="list">
                  {subscribedList.map(({ room: rname, public: pub }) => (
                    <button
                      key={rname}
                      type="button"
                      className={`room-bubble room-bubble--sub ${pub ? 'is-public' : 'is-private'}`}
                      role="listitem"
                      onClick={() => pickRoom(rname, !pub)}
                    >
                      <span className="room-bubble-tag">{pub ? 'Public' : 'Private'}</span>
                      {rname}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <div className="field-row">
                <label htmlFor="room">Room name</label>
                <button type="button" className="btn-link" onClick={refreshPublicList} disabled={loadingRooms}>
                  {loadingRooms ? 'Loading…' : 'Refresh names'}
                </button>
              </div>
              <p className="field-hint">
                Type at least 3 letters for a dropdown of matching names (public and private from this server and your lists).
              </p>
              <div className="room-suggest-wrap">
                <div className="input-clear-wrap">
                  <input
                    id="room"
                    type="text"
                    value={room}
                    onChange={(e) => {
                      setSuggestionsDismissed(false)
                      setRoom(e.target.value)
                    }}
                    onFocus={() => setSuggestionsDismissed(false)}
                    onBlur={() => {
                      window.setTimeout(() => setSuggestionsDismissed(true), 200)
                    }}
                    placeholder="e.g. study-group"
                    maxLength={64}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      room.trim().length >= 3 && roomSuggestions.length > 0 && !suggestionsDismissed
                    }
                  />
                  {room.length > 0 && (
                    <button
                      type="button"
                      className="input-clear-btn"
                      onClick={() => {
                        setRoom('')
                        setSuggestionsDismissed(false)
                      }}
                      aria-label="Clear room name"
                    >
                      ×
                    </button>
                  )}
                </div>
                {room.trim().length >= 3 && roomSuggestions.length > 0 && !suggestionsDismissed && (
                  <ul className="room-suggest-panel" role="listbox">
                    {roomSuggestions.map(({ name, isPublic }) => (
                      <li key={name.toLowerCase()} role="none">
                        <button
                          type="button"
                          role="option"
                          className="room-suggest-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyRoomSuggestion(name, isPublic)}
                        >
                          <span className="room-suggest-name">{name}</span>
                          <span
                            className={`room-suggest-chip ${isPublic ? 'is-public' : 'is-private'}`}
                          >
                            {isPublic ? 'Public' : 'Private'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {recentList.length > 0 && (
              <div className="field field-recent-near">
                <label>Recently joined (last {recentList.length})</label>
                <div className="joined-chips joined-chips--compact" role="list">
                  {recentList.map(({ room: rname, public: pub }) => (
                    <button
                      key={`${rname}-${pub}`}
                      type="button"
                      className={`join-chip ${pub ? 'join-chip--public' : 'join-chip--private'}`}
                      role="listitem"
                      onClick={() => pickRoom(rname, !pub)}
                    >
                      <span className="join-chip-label">{pub ? 'Public' : 'Private'}</span>
                      {rname}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!(roomKind === 'public' && !creatorPasswordForRoom) && (
              <div className="field">
                <label htmlFor="password">Password</label>
                {!creatorPasswordForRoom && roomKind === 'private' && (
                  <p className="password-private-hint">Private room — enter the password you were given.</p>
                )}
                {!creatorPasswordForRoom && roomKind === 'unknown' && room.trim().length > 0 && (
                  <p className="password-public-hint">Private rooms need a password; public rooms can join with none.</p>
                )}
                <input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    creatorPasswordForRoom
                      ? 'Saved for this room'
                      : roomKind === 'private'
                        ? 'Password (required)'
                        : 'Optional if the room is public'
                  }
                  autoComplete="off"
                  disabled={Boolean(creatorPasswordForRoom)}
                />
              </div>
            )}

            <button type="submit" className="btn-primary">
              Join chat
            </button>
          </form>
        ) : (
          <form className="lobby-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="username-create">Username</label>
              <input
                id="username-create"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name in chat"
                maxLength={32}
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newroom">Room name</label>
              <input
                id="newroom"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Choose a unique name"
                maxLength={64}
              />
            </div>
            <div className="field field-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={isPublicRoom}
                  onChange={(e) => {
                    setIsPublicRoom(e.target.checked)
                    if (e.target.checked) {
                      setNewPassword('')
                      setConfirmPassword('')
                    }
                  }}
                />
                <span>Public room (listed in server suggestions for others)</span>
              </label>
              <p className="field-hint">
                {isPublicRoom
                  ? 'Public rooms are open — no password.'
                  : 'Private rooms are invite-only; subscribe in chat to track them here.'}
              </p>
            </div>
            {!isPublicRoom && (
              <>
                <div className="field">
                  <label htmlFor="newpass">Password</label>
                  <input
                    id="newpass"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirmpass">Confirm password</label>
                  <input
                    id="confirmpass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create room'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
