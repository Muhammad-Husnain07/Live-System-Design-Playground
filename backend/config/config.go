package config

import "os"

type Config struct {
	DatabaseURL string
	RedisURL    string
	Port        string
	JWTSecret   string
	FrontendURL string
}

func Load() *Config {
	return &Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		Port:        getEnv("PORT", "8080"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
