FROM golang:1.26-alpine AS builder

RUN apk add --no-cache gcc musl-dev

RUN go install github.com/air-verse/air@latest

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080
CMD ["air", "-c", ".air.toml"]
