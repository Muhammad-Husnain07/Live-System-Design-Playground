package services

import (
	"database/sql"
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"systemdesign/models"
)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`)

var (
	ErrEmailTaken        = errors.New("email already in use")
	ErrUsernameTaken     = errors.New("username already in use")
	ErrInvalidEmail      = errors.New("invalid email format")
	ErrInvalidUsername   = errors.New("username must be 3-20 characters, alphanumeric and underscores only")
	ErrShortPassword     = errors.New("password must be at least 8 characters")
	ErrInvalidCreds      = errors.New("invalid email or password")
	ErrUserNotFound      = errors.New("user not found")
)

func ValidateRegisterInput(email, username, password string) error {
	email = strings.TrimSpace(email)
	username = strings.TrimSpace(username)

	if _, err := mail.ParseAddress(email); err != nil {
		return ErrInvalidEmail
	}

	if !usernameRegex.MatchString(username) {
		return ErrInvalidUsername
	}

	if len(password) < 8 {
		return ErrShortPassword
	}

	return nil
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func RegisterUser(db *sql.DB, email, username, password string) (*models.UserResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	username = strings.TrimSpace(username)

	if err := ValidateRegisterInput(email, username, password); err != nil {
		return nil, err
	}

	var exists int
	err := db.QueryRow("SELECT 1 FROM users WHERE email = $1 LIMIT 1", email).Scan(&exists)
	if err == nil {
		return nil, ErrEmailTaken
	}

	err = db.QueryRow("SELECT 1 FROM users WHERE username = $1 LIMIT 1", username).Scan(&exists)
	if err == nil {
		return nil, ErrUsernameTaken
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	var user models.User
	err = db.QueryRow(
		`INSERT INTO users (email, username, password_hash, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, email, username, created_at, updated_at`,
		email, username, hash, time.Now(), time.Now(),
	).Scan(&user.ID, &user.Email, &user.Username, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &models.UserResponse{
		ID:       user.ID,
		Email:    user.Email,
		Username: user.Username,
	}, nil
}

func AuthenticateUser(db *sql.DB, email, password string) (*models.UserResponse, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var user models.User
	err := db.QueryRow(
		`SELECT id, email, username, password_hash FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.Username, &user.PasswordHash)
	if err == sql.ErrNoRows {
		return nil, ErrInvalidCreds
	}
	if err != nil {
		return nil, err
	}

	if !CheckPassword(user.PasswordHash, password) {
		return nil, ErrInvalidCreds
	}

	return &models.UserResponse{
		ID:       user.ID,
		Email:    user.Email,
		Username: user.Username,
	}, nil
}

func GetUserByID(db *sql.DB, userID string) (*models.UserResponse, error) {
	var user models.User
	err := db.QueryRow(
		`SELECT id, email, username FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Username)
	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return &models.UserResponse{
		ID:       user.ID,
		Email:    user.Email,
		Username: user.Username,
	}, nil
}
