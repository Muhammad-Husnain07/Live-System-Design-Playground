# Live System Design Playground

A collaborative web application for designing, simulating, and analyzing system architectures in real-time.

## Tech Stack

### Frontend (React + TypeScript + Vite)
- **Vite**: Fast dev server and build tool for modern web apps
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS** (zinc palette): Utility-first CSS for dark engineering theme
- **React Flow**: Node-based canvas for system architecture diagrams
- **Zustand**: Lightweight state management
- **D3.js**: Data visualization for metrics and charts
- **Framer Motion**: Smooth animations for UI interactions
- **Monaco Editor**: Code editor for configuration and simulation scripts
- **YJS + Y-WebSocket**: Real-time collaborative editing
- **Socket.IO Client**: WebSocket communication with backend
- **Axios**: HTTP client for API requests
- **React Router DOM**: Client-side routing
- **Recharts**: Charting library for performance metrics
- **html2canvas**: Export diagrams to images

### Backend (Go + Fiber)
- **Fiber v2**: Fast, Express-like HTTP framework
- **Gorilla WebSocket**: WebSocket support for real-time collaboration
- **PostgreSQL (lib/pq)**: Persistent storage for user data, diagrams, and sessions
- **Redis (go-redis v9)**: In-memory cache and real-time state management
- **godotenv**: Environment variable loading
- **google/uuid**: UUID generation
- **golang-jwt/jwt**: JWT-based authentication
- **golang.org/x/crypto (bcrypt)**: Password hashing

## Folder Structure

```
/
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/         # React Flow canvas components
│   │   │   ├── sidebar/        # Sidebar panels and toolboxes
│   │   │   ├── toolbar/        # Top toolbar actions
│   │   │   ├── panels/         # Bottom/right detail panels
│   │   │   └── ui/             # Reusable UI primitives
│   │   ├── store/              # Zustand stores
│   │   ├── hooks/              # Custom React hooks
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Helper functions
│   │   └── pages/              # Route-level page components
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── package.json
├── backend/                    # Go + Fiber
│   ├── main.go                 # Entry point
│   ├── config/                 # App configuration
│   ├── handlers/               # HTTP request handlers
│   ├── middleware/              # Auth, CORS, logging middleware
│   ├── models/                 # Data models / DB schemas
│   ├── services/               # Business logic layer
│   ├── simulation/             # System simulation engine
│   ├── ws/                     # WebSocket hub and client management
│   └── iac/                    # Infrastructure-as-code configs
├── docker-compose.yml          # Multi-service orchestration
├── .env.example                # Environment variable template
├── .gitignore
└── HANDOFF.md
```

## Environment Variables

| Variable       | Description                  | Default                                 |
|----------------|------------------------------|-----------------------------------------|
| DATABASE_URL   | PostgreSQL connection string | postgresql://postgres:4JJVDD8F@localhost:5432/systemdesign |
| REDIS_URL      | Redis connection URL         | redis://localhost:6379                  |
| PORT           | Backend server port          | 8080                                    |
| JWT_SECRET     | JWT signing secret           | your_secret_here                        |
| FRONTEND_URL   | Frontend URL for CORS        | http://localhost:5173                   |

## Status

**Phase 0 complete — scaffold ready**

## Next Step

Phase 1: Implement backend core — database schema, user authentication (register/login with JWT), WebSocket hub for real-time collaboration, and simulation engine skeleton.
