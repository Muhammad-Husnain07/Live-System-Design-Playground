package services

import (
	"database/sql"
	"errors"
	"net/mail"
	"strings"
	"time"

	"systemdesign/models"
)

var (
	ErrWrongPassword    = errors.New("current password is incorrect")
	ErrNewPasswordShort = errors.New("new password must be at least 8 characters")
)

func GetFullProfile(db *sql.DB, userID string) (*models.ProfileResponse, error) {
	var user models.User
	err := db.QueryRow(
		`SELECT id, email, username, created_at FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Username, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return &models.ProfileResponse{
		ID:        user.ID,
		Email:     user.Email,
		Username:  user.Username,
		CreatedAt: user.CreatedAt,
	}, nil
}

func UpdateProfile(db *sql.DB, userID string, email, username *string) (*models.ProfileResponse, error) {
	current, err := GetFullProfile(db, userID)
	if err != nil {
		return nil, err
	}

	newEmail := current.Email
	newUsername := current.Username

	if email != nil {
		trimmed := strings.TrimSpace(*email)
		if trimmed != current.Email {
			if _, eerr := mail.ParseAddress(trimmed); eerr != nil {
				return nil, ErrInvalidEmail
			}
			var exists int
			if derr := db.QueryRow("SELECT 1 FROM users WHERE email = $1 AND id != $2 LIMIT 1", trimmed, userID).Scan(&exists); derr == nil {
				return nil, ErrEmailTaken
			}
			newEmail = trimmed
		}
	}

	if username != nil {
		trimmed := strings.TrimSpace(*username)
		if trimmed != current.Username {
			if !usernameRegex.MatchString(trimmed) {
				return nil, ErrInvalidUsername
			}
			var exists int
			if derr := db.QueryRow("SELECT 1 FROM users WHERE username = $1 AND id != $2 LIMIT 1", trimmed, userID).Scan(&exists); derr == nil {
				return nil, ErrUsernameTaken
			}
			newUsername = trimmed
		}
	}

	_, err = db.Exec(
		`UPDATE users SET email = $1, username = $2, updated_at = $3 WHERE id = $4`,
		newEmail, newUsername, time.Now(), userID,
	)
	if err != nil {
		return nil, err
	}

	return &models.ProfileResponse{
		ID:        userID,
		Email:     newEmail,
		Username:  newUsername,
		CreatedAt: current.CreatedAt,
	}, nil
}

func ChangePassword(db *sql.DB, userID, currentPassword, newPassword string) error {
	if len(newPassword) < 8 {
		return ErrNewPasswordShort
	}

	var hash string
	err := db.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&hash)
	if err != nil {
		return ErrUserNotFound
	}

	if !CheckPassword(hash, currentPassword) {
		return ErrWrongPassword
	}

	newHash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}

	_, err = db.Exec(`UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, newHash, time.Now(), userID)
	return err
}

func DeleteAccount(db *sql.DB, userID string) error {
	result, err := db.Exec(`DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrUserNotFound
	}
	return nil
}
