package ws

import (
	"context"
	"encoding/binary"
	"log"
	"sync"
	"time"

	"github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/valyala/fasthttp"
)

const (
	messageSync      = 0
	messageAwareness = 1

	syncStep1 = 0
	syncStep2 = 1
	syncUpdate = 2

	yjsWriteWait   = 10 * time.Second
	yjsPongWait    = 60 * time.Second
	yjsPingPeriod  = (yjsPongWait * 9) / 10
	yjsSendBufSize = 4096
)

type YjsClient struct {
	conn      *websocket.Conn
	projectID string
	userID    string
	send      chan []byte
	mu        sync.Mutex
}

type YjsRoom struct {
	mu      sync.RWMutex
	clients map[*YjsClient]bool
}

func (r *YjsRoom) broadcast(sender *YjsClient, data []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for client := range r.clients {
		if client == sender {
			continue
		}
		select {
		case client.send <- data:
		default:
			log.Printf("yjs send buffer full for user=%s", client.userID)
		}
	}
}

func (r *YjsRoom) count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.clients)
}

var (
	yjsHubMu sync.RWMutex
	yjsRooms = make(map[string]*YjsRoom)
)

func getYjsRoom(projectID string) *YjsRoom {
	yjsHubMu.RLock()
	defer yjsHubMu.RUnlock()
	return yjsRooms[projectID]
}

func createYjsRoom(projectID string) *YjsRoom {
	yjsHubMu.Lock()
	defer yjsHubMu.Unlock()
	if r, ok := yjsRooms[projectID]; ok {
		return r
	}
	r := &YjsRoom{clients: make(map[*YjsClient]bool)}
	yjsRooms[projectID] = r
	return r
}

func deleteYjsRoom(projectID string) {
	yjsHubMu.Lock()
	defer yjsHubMu.Unlock()
	delete(yjsRooms, projectID)
}

var yjsUpgrader = websocket.FastHTTPUpgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(_ *fasthttp.RequestCtx) bool { return true },
}

func UpgradeYjs(c *fiber.Ctx, rdb *redis.Client, projectID, userID string) error {
	return yjsUpgrader.Upgrade(c.Context(), func(conn *websocket.Conn) {
		ServeYjsWS(conn, rdb, projectID, userID)
	})
}

func ServeYjsWS(conn *websocket.Conn, rdb *redis.Client, projectID, userID string) {
	client := &YjsClient{
		conn:      conn,
		projectID: projectID,
		userID:    userID,
		send:      make(chan []byte, yjsSendBufSize),
	}

	room := createYjsRoom(projectID)
	room.mu.Lock()
	room.clients[client] = true
	room.mu.Unlock()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		yjsWritePump(client)
	}()

	yjsReadPump(client, room, rdb)

	room.mu.Lock()
	delete(room.clients, client)
	isEmpty := len(room.clients) == 0
	room.mu.Unlock()

	close(client.send)
	wg.Wait()
	conn.Close()

	if isEmpty {
		deleteYjsRoom(projectID)
	}
}

func yjsReadPump(client *YjsClient, room *YjsRoom, rdb *redis.Client) {
	client.conn.SetReadLimit(10 * 1024 * 1024)
	client.conn.SetReadDeadline(time.Now().Add(yjsPongWait))
	client.conn.SetPongHandler(func(string) error {
		client.conn.SetReadDeadline(time.Now().Add(yjsPongWait))
		return nil
	})

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			break
		}

		client.conn.SetReadDeadline(time.Now().Add(yjsPongWait))

		msgType, n := binary.Uvarint(message)
		if n <= 0 {
			continue
		}

		switch msgType {
		case messageSync:
			if len(message) <= n {
				continue
			}
			syncSubType, m := binary.Uvarint(message[n:])
			if m <= 0 {
				continue
			}
			payloadStart := n + m
			payload := message[payloadStart:]

			switch syncSubType {
			case syncStep1:
				if rdb == nil {
					continue
				}
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				state, err := rdb.Get(ctx, "yjs:"+client.projectID).Bytes()
				cancel()
				if err != nil || len(state) == 0 {
					continue
				}
				var buf []byte
				var tmp [8]byte
				wn := binary.PutUvarint(tmp[:], messageSync)
				buf = append(buf, tmp[:wn]...)
				wn = binary.PutUvarint(tmp[:], syncStep2)
				buf = append(buf, tmp[:wn]...)
				buf = append(buf, state...)
				client.writeYjsSafe(websocket.BinaryMessage, buf)

			case syncStep2:
				if rdb != nil {
					ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
					rdb.Set(ctx, "yjs:"+client.projectID, payload, 0)
					cancel()
				}
				room.broadcast(client, message)

			case syncUpdate:
				room.broadcast(client, message)
			}

		case messageAwareness:
			room.broadcast(client, message)
		}
	}
}

func yjsWritePump(client *YjsClient) {
	ticker := time.NewTicker(yjsPingPeriod)
	defer ticker.Stop()

	for {
		select {
		case message, ok := <-client.send:
			if !ok {
				client.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			client.conn.SetWriteDeadline(time.Now().Add(yjsWriteWait))
			if err := client.conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			client.conn.SetWriteDeadline(time.Now().Add(yjsWriteWait))
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *YjsClient) writeYjsSafe(messageType int, data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.SetWriteDeadline(time.Now().Add(yjsWriteWait))
	c.conn.WriteMessage(messageType, data)
}
