package ws

import (
	"encoding/json"
	"log"
	"sync"

	"systemdesign/simulation"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[client.projectID] == nil {
		h.clients[client.projectID] = make(map[*Client]bool)
	}
	h.clients[client.projectID][client] = true
	log.Printf("ws client registered: user=%s project=%s", client.userID, client.projectID)
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.clients[client.projectID]; ok {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			close(client.send)
			log.Printf("ws client unregistered: user=%s project=%s", client.userID, client.projectID)
			if len(clients) == 0 {
				delete(h.clients, client.projectID)
			}
		}
	}
}

func (h *Hub) BroadcastToProject(projectID string, tick *simulation.Tick) {
	h.mu.RLock()
	_, ok := h.clients[projectID]
	h.mu.RUnlock()

	if !ok {
		return
	}

	data, err := json.Marshal(map[string]any{
		"type": "tick",
		"tick": tick,
	})
	if err != nil {
		log.Printf("ws marshal error: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients[projectID] {
		select {
		case client.send <- data:
		default:
			log.Printf("ws client send buffer full, dropping: user=%s", client.userID)
		}
	}
}

func (h *Hub) ClientCount(projectID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[projectID])
}
