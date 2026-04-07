package hub

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Message types for protocol
const (
	MsgJoin    = "join"
	MsgLeave   = "leave"
	MsgChat    = "chat"
	MsgSystem  = "system"
	MsgRooms   = "rooms"
	MsgMembers = "members"
	MsgRoomMeta = "room_meta"
)

// Message represents a chat protocol message
type Message struct {
	Type       string    `json:"type"`
	Room       string    `json:"room,omitempty"`
	Username   string    `json:"username,omitempty"`
	Content    string    `json:"content,omitempty"`
	Timestamp  time.Time `json:"timestamp,omitempty"`
	ClientID   string    `json:"client_id,omitempty"`
	RoomPublic *bool     `json:"room_public,omitempty"`
}

// Client represents a connected WebSocket client
type Client struct {
	ID         string
	Username   string
	Room       string
	RoomPublic bool
	Send       chan []byte
	Hub        *Hub
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Registered clients by room: roomName -> clientID -> *Client
	rooms map[string]map[string]*Client
	// Inbound messages from clients
	broadcast chan *broadcastMsg
	// Register requests from clients
	register chan *Client
	// Unregister requests from clients
	unregister chan *Client
	mu         sync.RWMutex
}

type broadcastMsg struct {
	room   string
	msg    []byte
	sender string
}

// New creates a new Hub
func New() *Hub {
	return &Hub{
		rooms:      make(map[string]map[string]*Client),
		broadcast:  make(chan *broadcastMsg, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case bm := <-h.broadcast:
			h.broadcastToRoom(bm)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[client.Room] == nil {
		h.rooms[client.Room] = make(map[string]*Client)
	}
	h.rooms[client.Room][client.ID] = client

	// Tell this client only whether the room is public (for UI); not broadcast to others
	rp := client.RoomPublic
	metaMsg := Message{Type: MsgRoomMeta, RoomPublic: &rp}
	metaData, _ := json.Marshal(metaMsg)
	select {
	case client.Send <- metaData:
	default:
		close(client.Send)
		delete(h.rooms[client.Room], client.ID)
		return
	}

	// Notify room of new member
	joinMsg := Message{
		Type:      MsgSystem,
		Content:   client.Username + " joined the room",
		Username:  client.Username,
		Timestamp: time.Now(),
	}
	data, _ := json.Marshal(joinMsg)
	h.broadcastToRoomLocked(client.Room, data, client.ID)

	// Send room member list to new client
	members := h.getRoomMembersLocked(client.Room)
	membersMsg := Message{Type: MsgMembers, Content: members}
	membersData, _ := json.Marshal(membersMsg)
	select {
	case client.Send <- membersData:
	default:
		close(client.Send)
		delete(h.rooms[client.Room], client.ID)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[client.Room]; ok {
		if _, exists := room[client.ID]; exists {
			delete(room, client.ID)
			if len(room) == 0 {
				delete(h.rooms, client.Room)
			} else {
				leaveMsg := Message{
					Type:      MsgSystem,
					Content:   client.Username + " left the room",
					Username:  client.Username,
					Timestamp: time.Now(),
				}
				data, _ := json.Marshal(leaveMsg)
				h.broadcastToRoomLocked(client.Room, data, "")
			}
		}
	}
}

func (h *Hub) broadcastToRoom(bm *broadcastMsg) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	h.broadcastToRoomLocked(bm.room, bm.msg, bm.sender)
}

func (h *Hub) broadcastToRoomLocked(room string, msg []byte, excludeClientID string) {
	for id, client := range h.rooms[room] {
		if id != excludeClientID {
			select {
			case client.Send <- msg:
			default:
				close(client.Send)
				delete(h.rooms[room], id)
			}
		}
	}
}

func (h *Hub) getRoomMembersLocked(room string) string {
	var members string
	first := true
	for _, c := range h.rooms[room] {
		if !first {
			members += ", "
		}
		members += c.Username
		first = false
	}
	return members
}

// GetRoomList returns list of active rooms
func (h *Hub) GetRoomList() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	rooms := make([]string, 0, len(h.rooms))
	for name := range h.rooms {
		rooms = append(rooms, name)
	}
	return rooms
}

// CreateClient creates a new client with unique ID
func CreateClient(username, room string, roomPublic bool, h *Hub, send chan []byte) *Client {
	return &Client{
		ID:         uuid.New().String(),
		Username:   username,
		Room:       room,
		RoomPublic: roomPublic,
		Send:       send,
		Hub:        h,
	}
}

// Register adds a client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// Broadcast sends a message to all clients in a room except the sender
func (h *Hub) Broadcast(room string, msg []byte, excludeClientID string) {
	h.broadcast <- &broadcastMsg{room: room, msg: msg, sender: excludeClientID}
}
