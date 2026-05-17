package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/fasthttp/websocket"
	"github.com/redis/go-redis/v9"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	projectID string
	userID    string
	send      chan []byte
	mu        sync.Mutex
}

func NewClient(conn *websocket.Conn, hub *Hub, projectID, userID string) *Client {
	return &Client{
		hub:       hub,
		conn:      conn,
		projectID: projectID,
		userID:    userID,
		send:      make(chan []byte, 256),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("ws read error: %v", err)
			}
			break
		}

		var msg struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "ping":
			c.writeSafe(websocket.TextMessage, []byte(`{"type":"pong"}`))
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) writeSafe(messageType int, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.SetWriteDeadline(time.Now().Add(writeWait))
	c.conn.WriteMessage(messageType, data)
}

type TicketAuth struct {
	UserID string
	OK     bool
}

func ValidateTicket(rdb *redis.Client, ticket string) TicketAuth {
	if rdb == nil {
		return TicketAuth{OK: false}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	key := "ws_ticket:" + ticket
	userID, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return TicketAuth{OK: false}
	}

	rdb.Del(ctx, key)
	return TicketAuth{UserID: userID, OK: true}
}
