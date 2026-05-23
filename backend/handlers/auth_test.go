package handlers

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"systemdesign/config"
	"systemdesign/services"
)

func TestValidateRegisterInputValid(t *testing.T) {
	err := services.ValidateRegisterInput("test@example.com", "testuser", "password123")
	if err != nil {
		t.Errorf("expected no error for valid input, got: %v", err)
	}
}

func TestValidateRegisterInputInvalidEmail(t *testing.T) {
	err := services.ValidateRegisterInput("not-an-email", "testuser", "password123")
	if err != services.ErrInvalidEmail {
		t.Errorf("expected ErrInvalidEmail, got: %v", err)
	}
}

func TestValidateRegisterInputShortUsername(t *testing.T) {
	err := services.ValidateRegisterInput("test@example.com", "ab", "password123")
	if err != services.ErrInvalidUsername {
		t.Errorf("expected ErrInvalidUsername, got: %v", err)
	}
}

func TestValidateRegisterInputLongUsername(t *testing.T) {
	long := "abcdefghijklmnopqrstuvwxyz12345"
	err := services.ValidateRegisterInput("test@example.com", long, "password123")
	if err != services.ErrInvalidUsername {
		t.Errorf("expected ErrInvalidUsername for long name, got: %v", err)
	}
}

func TestValidateRegisterInputShortPassword(t *testing.T) {
	err := services.ValidateRegisterInput("test@example.com", "testuser", "short")
	if err != services.ErrShortPassword {
		t.Errorf("expected ErrShortPassword, got: %v", err)
	}
}

func TestPasswordHashingAndCheck(t *testing.T) {
	password := "securePassword123!"
	hash, err := services.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash == password {
		t.Error("hash should not equal plaintext password")
	}
	if !services.CheckPassword(hash, password) {
		t.Error("CheckPassword should return true for correct password")
	}
	if services.CheckPassword(hash, "wrongPassword") {
		t.Error("CheckPassword should return false for wrong password")
	}
}

func TestHashPasswordConsistency(t *testing.T) {
	password := "samePassword42"
	hash1, err := services.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	hash2, err := services.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	if hash1 == hash2 {
		t.Error("bcrypt hashes should be unique even for same password")
	}
	if !services.CheckPassword(hash1, password) {
		t.Error("hash1 should verify against the password")
	}
	if !services.CheckPassword(hash2, password) {
		t.Error("hash2 should verify against the password")
	}
}

func TestGenerateToken(t *testing.T) {
	secret := "test-secret-key-12345"
	token, err := config.GenerateToken("user-1", "test@example.com", "testuser", secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestParseValidToken(t *testing.T) {
	secret := "test-secret-key-12345"
	token, err := config.GenerateToken("user-1", "test@example.com", "testuser", secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	claims, err := config.ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Errorf("UserID = %q, want 'user-1'", claims.UserID)
	}
	if claims.Email != "test@example.com" {
		t.Errorf("Email = %q, want 'test@example.com'", claims.Email)
	}
	if claims.Username != "testuser" {
		t.Errorf("Username = %q, want 'testuser'", claims.Username)
	}
}

func TestParseInvalidToken(t *testing.T) {
	secret := "test-secret-key-12345"
	_, err := config.ParseToken("invalid-token-string", secret)
	if err == nil {
		t.Error("expected error for invalid token")
	}
}

func TestParseTokenWrongSecret(t *testing.T) {
	token, err := config.GenerateToken("user-1", "test@example.com", "testuser", "correct-secret")
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	_, err = config.ParseToken(token, "wrong-secret")
	if err == nil {
		t.Error("expected error when parsing with wrong secret")
	}
}

func TestParseExpiredToken(t *testing.T) {
	secret := "test-secret-key-12345"
	claims := config.JWTClaims{
		UserID:   "user-1",
		Email:    "test@example.com",
		Username: "testuser",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}
	_, err = config.ParseToken(tokenStr, secret)
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestValidateRegisterInputLeadingTrailingSpaces(t *testing.T) {
	err := services.ValidateRegisterInput("  test@example.com  ", "testuser", "password123")
	if err != nil {
		t.Errorf("expected validation to trim spaces and pass, got: %v", err)
	}
}
