package hub

import (
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	minPasswordLen = 4
	maxPasswordLen = 72 // bcrypt limit

	// DefaultPublicRoomLimit caps how many public rooms GET /api/rooms returns (newest first).
	DefaultPublicRoomLimit = 24
	// MaxPublicRoomLimit is the hard ceiling for the ?limit= query parameter.
	MaxPublicRoomLimit = 50
)

// RoomMeta holds auth and visibility for a room.
type RoomMeta struct {
	Hash      []byte
	Public    bool
	CreatedAt time.Time
}

// RoomRegistry stores bcrypt password hashes and visibility for named rooms (in-memory).
type RoomRegistry struct {
	mu    sync.RWMutex
	rooms map[string]*RoomMeta // normalized room name -> meta
}

// NewRoomRegistry creates an empty registry.
func NewRoomRegistry() *RoomRegistry {
	return &RoomRegistry{rooms: make(map[string]*RoomMeta)}
}

// NormalizeRoomName trims, lowercases, and validates length (max 64 runes handled by caller length check on bytes).
func NormalizeRoomName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// CreateRoom registers a new room. Public rooms appear in discovery (recent list); private rooms are join-by-name only.
// Public rooms do not use a password (open join). Private rooms require a 4–72 character password.
func (r *RoomRegistry) CreateRoom(name, password string, public bool) error {
	key := NormalizeRoomName(name)
	if key == "" || len(key) > 64 {
		return errors.New("invalid room name")
	}

	var hash []byte
	if public {
		hash = nil
	} else {
		if len(password) < minPasswordLen || len(password) > maxPasswordLen {
			return errors.New("password must be 4–72 characters")
		}
		var err error
		hash, err = bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.rooms[key]; exists {
		return errors.New("room already exists")
	}
	r.rooms[key] = &RoomMeta{
		Hash:      hash,
		Public:    public,
		CreatedAt: time.Now().UTC(),
	}
	return nil
}

// VerifyPassword returns true if the room exists and the client may join.
// Public rooms accept any password (typically empty); private rooms require a matching bcrypt hash.
func (r *RoomRegistry) VerifyPassword(name, password string) bool {
	key := NormalizeRoomName(name)
	if key == "" {
		return false
	}
	r.mu.RLock()
	meta, ok := r.rooms[key]
	r.mu.RUnlock()
	if !ok {
		return false
	}
	if meta.Public {
		return true
	}
	if len(meta.Hash) == 0 {
		return false
	}
	return bcrypt.CompareHashAndPassword(meta.Hash, []byte(password)) == nil
}

// RoomExists reports whether a room was created.
func (r *RoomRegistry) RoomExists(name string) bool {
	key := NormalizeRoomName(name)
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.rooms[key]
	return ok
}

// ListRecentPublicRooms returns up to limit public room names, newest first.
func (r *RoomRegistry) ListRecentPublicRooms(limit int) []string {
	if limit <= 0 || limit > MaxPublicRoomLimit {
		limit = DefaultPublicRoomLimit
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	type pair struct {
		name string
		t    time.Time
	}
	var pairs []pair
	for name, meta := range r.rooms {
		if meta.Public {
			pairs = append(pairs, pair{name, meta.CreatedAt})
		}
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].t.After(pairs[j].t)
	})
	out := make([]string, 0, limit)
	for i := 0; i < len(pairs) && len(out) < limit; i++ {
		out = append(out, pairs[i].name)
	}
	return out
}

// IsPublic reports whether the room exists and was created as public (discovery).
func (r *RoomRegistry) IsPublic(name string) bool {
	key := NormalizeRoomName(name)
	r.mu.RLock()
	defer r.mu.RUnlock()
	meta, ok := r.rooms[key]
	if !ok {
		return false
	}
	return meta.Public
}
