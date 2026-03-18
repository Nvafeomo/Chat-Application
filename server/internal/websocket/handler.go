package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"chat-app/server/internal/hub"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development; restrict in production
	},
}

// HandleConnection upgrades HTTP to WebSocket and handles client lifecycle
func HandleConnection(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	room := r.URL.Query().Get("room")

	if username == "" || room == "" {
		http.Error(w, "username and room required", http.StatusBadRequest)
		return
	}

	username = strings.TrimSpace(username)
	room = strings.TrimSpace(room)

	if len(username) > 32 || len(room) > 64 {
		http.Error(w, "username/room too long", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	send := make(chan []byte, 256)
	client := hub.CreateClient(username, room, h, send)

	h.Register(client)
	defer h.Unregister(client)

	go writePump(client, conn)
	readPump(client, conn)
}

func readPump(client *hub.Client, conn *websocket.Conn) {
	defer conn.Close()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Read error: %v", err)
			}
			break
		}

		var msg hub.Message
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		if msg.Type == hub.MsgChat && msg.Content != "" {
			msg.Username = client.Username
			msg.ClientID = client.ID
			msg.Type = hub.MsgChat
			data, _ := json.Marshal(msg)
			// Broadcast to all in room (everyone sees every message)
			client.Hub.Broadcast(client.Room, data, "")
		}
	}
}

func writePump(client *hub.Client, conn *websocket.Conn) {
	defer conn.Close()

	for message := range client.Send {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}
