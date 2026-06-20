package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var (
	db        *sql.DB
	rateMutex sync.Mutex
	rateMap   = map[string]int64{}
)

const (
	ListenAddr    = ":8421"
	MaxMessages   = 500
	RateLimitSecs = 10
	MessageMaxLen = 500
)

var adjectives = []string{
	"快乐的", "沉默的", "神秘的", "暴躁的", "温柔的", "孤独的",
	"机敏的", "疯狂的", "优雅的", "慵懒的", "勇敢的", "狡黠的",
	"忧郁的", "欢腾的", "冷静的", "热烈的", "迷糊的", "清醒的",
	"骄傲的", "谦逊的", "淘气的", "严肃的", "活泼的", "安静的",
	"闪耀的", "暗淡的", "炽热的", "冰冷的", "飘渺的", "沉稳的",
}

var nouns = []string{
	"狐狸", "星辰", "旅人", "剑客", "诗人", "月亮",
	"风暴", "猫咪", "渡鸦", "游侠", "梦者", "哨兵",
	"雏菊", "萤火", "礁石", "浪人", "画师", "钟表",
	"齿轮", "影子", "回声", "余烬", "晚星", "晨雾",
	"纸鸢", "棋手", "歌者", "渔夫", "飞鸟", "孤舟",
}

func generateUsername() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return adjectives[r.Intn(len(adjectives))] + nouns[r.Intn(len(nouns))]
}

func initDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			ip TEXT PRIMARY KEY,
			username TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip TEXT NOT NULL,
			username TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(id DESC);
	`)
	return err
}

func getIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func getUsername(ip string) (string, error) {
	var username string
	err := db.QueryRow("SELECT username FROM users WHERE ip = ?", ip).Scan(&username)
	if err == sql.ErrNoRows {
		username = generateUsername()
		_, err = db.Exec("INSERT INTO users (ip, username, created_at) VALUES (?, ?, ?)",
			ip, username, time.Now().Unix())
		if err != nil {
			err = db.QueryRow("SELECT username FROM users WHERE ip = ?", ip).Scan(&username)
		}
	}
	return username, err
}

func cleanupOldMessages() {
	for {
		time.Sleep(10 * time.Minute)
		_, err := db.Exec(`
			DELETE FROM messages WHERE id NOT IN (
				SELECT id FROM messages ORDER BY id DESC LIMIT ?
			)
		`, MaxMessages)
		if err != nil {
			log.Printf("cleanup error: %v", err)
		}
	}
}

func rateLimited(ip string) bool {
	rateMutex.Lock()
	defer rateMutex.Unlock()
	now := time.Now().Unix()
	if last, ok := rateMap[ip]; ok && now-last < RateLimitSecs {
		return true
	}
	rateMap[ip] = now
	return false
}

func writeJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func handleWhoami(w http.ResponseWriter, r *http.Request) {
	ip := getIP(r)
	username, err := getUsername(ip)
	if err != nil {
		writeJSON(w, map[string]string{"error": "internal"}, http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"username": username}, http.StatusOK)
}

func handleGetMessages(w http.ResponseWriter, r *http.Request) {
	limit := 100
	rows, err := db.Query(`
		SELECT id, username, content, created_at, ip FROM messages
		ORDER BY id DESC LIMIT ?
	`, limit)
	if err != nil {
		writeJSON(w, map[string]string{"error": "internal"}, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	ip := getIP(r)
	type Msg struct {
		ID        int64  `json:"id"`
		Username  string `json:"username"`
		Content   string `json:"content"`
		CreatedAt int64  `json:"created_at"`
		IsMine    bool   `json:"is_mine"`
	}
	var messages []Msg
	for rows.Next() {
		var m Msg
		var msgIP string
		if err := rows.Scan(&m.ID, &m.Username, &m.Content, &m.CreatedAt, &msgIP); err != nil {
			continue
		}
		m.IsMine = msgIP == ip
		messages = append(messages, m)
	}
	if messages == nil {
		messages = []Msg{}
	}
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	writeJSON(w, map[string]interface{}{"messages": messages}, http.StatusOK)
}

func handlePostMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, map[string]string{"error": "method_not_allowed"}, http.StatusMethodNotAllowed)
		return
	}
	ip := getIP(r)
	if rateLimited(ip) {
		writeJSON(w, map[string]string{"error": "rate_limited"}, http.StatusTooManyRequests)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, map[string]string{"error": "bad_request"}, http.StatusBadRequest)
		return
	}
	content := strings.TrimSpace(body.Content)
	if content == "" {
		writeJSON(w, map[string]string{"error": "empty"}, http.StatusBadRequest)
		return
	}
	if len([]rune(content)) > MessageMaxLen {
		writeJSON(w, map[string]string{"error": "too_long"}, http.StatusBadRequest)
		return
	}
	username, err := getUsername(ip)
	if err != nil {
		writeJSON(w, map[string]string{"error": "internal"}, http.StatusInternalServerError)
		return
	}
	now := time.Now().Unix()
	result, err := db.Exec(
		"INSERT INTO messages (ip, username, content, created_at) VALUES (?, ?, ?, ?)",
		ip, username, content, now,
	)
	if err != nil {
		writeJSON(w, map[string]string{"error": "internal"}, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, map[string]interface{}{
		"ok": true,
		"message": map[string]interface{}{
			"id":         id,
			"username":   username,
			"content":    content,
			"created_at": now,
			"is_mine":    true,
		},
	}, http.StatusOK)
}

func main() {
	dbPath := os.Getenv("CHAT_DB_PATH")
	if dbPath == "" {
		dbPath = "/data/chat.db"
	}
	dbDir := dbPath
	if idx := strings.LastIndex(dbPath, "/"); idx > 0 {
		dbDir = dbPath[:idx]
	}
	os.MkdirAll(dbDir, 0755)

	if err := initDB(dbPath); err != nil {
		log.Fatalf("init db: %v", err)
	}
	defer db.Close()
	go cleanupOldMessages()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/chat/whoami", handleWhoami)
	mux.HandleFunc("/api/chat/messages", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		switch r.Method {
		case http.MethodGet:
			handleGetMessages(w, r)
		case http.MethodPost:
			handlePostMessage(w, r)
		default:
			writeJSON(w, map[string]string{"error": "method_not_allowed"}, http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/chat/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]string{"status": "ok"}, http.StatusOK)
	})

	log.Printf("chat server listening on %s (db=%s)", ListenAddr, dbPath)
	if err := http.ListenAndServe(ListenAddr, mux); err != nil {
		log.Fatal(err)
	}
}
