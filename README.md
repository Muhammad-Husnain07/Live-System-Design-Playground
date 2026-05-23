# Live System Design Playground

A collaborative web application for designing, simulating, and analyzing cloud system architectures in real-time. Drag-and-drop infrastructure components onto a canvas, configure deployment strategies, run chaos engineering experiments, and export to IaC.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (React)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ ReactFlow│  │ Monaco   │  │ Recharts      │  │
│  │  Canvas  │  │  Editor  │  │  Metrics      │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │             │               │           │
│  ┌────┴─────────────┴───────────────┴────────┐  │
│  │           Zustand Stores                   │  │
│  │  canvas│sim│chaos│deploy│security│finops   │  │
│  └───────────────────┬───────────────────────┘  │
│                      │                          │
│  ┌───────────────────┴───────────────────────┐  │
│  │  Yjs (collaboration) │ WebSocket (tick)  │  │
│  └───────────────────┬───────────────────────┘  │
└──────────────────────┼──────────────────────────┘
                       │
              HTTP/REST │  WS
                       │
┌──────────────────────┴──────────────────────────┐
│              Go (Fiber) Backend                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Auth    │  │  Project │  │  Simulation   │  │
│  │  Handler │  │  Handler │  │  Handler      │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │             │               │           │
│  ┌────┴─────────────┴───────────────┴────────┐  │
│  │           Engine / Services                │  │
│  │ sim│chaos│deploy│finops│security│iac       │  │
│  └───────────────────┬───────────────────────┘  │
│       │             │               │           │
│  ┌────┴─────┐  ┌────┴─────┐  ┌──────┴────────┐  │
│  │PostgreSQL│  │  Redis   │  │  WebSocket Hub │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└──────────────────────────────────────────────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- Node.js 22+ (for local frontend dev)
- Go 1.22+ (for local backend dev)

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/Muhammad-Husnain07/Live-System-Design-Playground.git
cd Live-System-Design-Playground

# 2. Copy environment file
cp .env.example .env
# Edit JWT_SECRET in .env to a random value

# 3. Start all services
docker compose up -d

# 4. Open the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8080/api
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React + Vite dev server with HMR |
| Backend | 8080 | Go Fiber API with Air hot reload |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache, session store, WS tickets |

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
go run .
# or with Air for hot reload:
air -c .air.toml
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Features

| Category | Feature | Status |
|----------|---------|--------|
| Canvas | Drag-and-drop node editor (26 node types) | Complete |
| Canvas | Undo/Redo (50-state history) | Complete |
| Canvas | Export to PNG | Complete |
| Simulation | Load generation (steady/ramp/spike) | Complete |
| Simulation | Real-time metrics via WebSocket | Complete |
| Simulation | Bottleneck detection | Complete |
| Simulation | Async/sync routing visuals | Complete |
| Deployment | Canary deployments (traffic split) | Complete |
| Deployment | Blue/Green deployments | Complete |
| Deployment | Auto-failover on error rate >30% | Complete |
| Chaos | 8 chaos experiment types | Complete |
| Chaos | Visual feedback + auto-expiration | Complete |
| Security | 4 audit rules | Complete |
| Security | Canvas violation highlighting | Complete |
| FinOps | AWS pricing estimates | Complete |
| FinOps | 4-tier scaling projections | Complete |
| FinOps | Optimization recommendations | Complete |
| IaC Export | Terraform (HCL + JSON) | Complete |
| IaC Export | Kubernetes YAML | Complete |
| IaC Export | CloudFormation JSON | Complete |
| IaC Import | Terraform HCL parsing | Complete |
| Collaboration | Yjs real-time sync | Complete |
| Collaboration | Remote cursor awareness | Complete |
| Challenges | 4 system design challenges | Complete |
| Challenges | Timer-based scoring | Complete |
| User Mgmt | Register/Login/Profile | Complete |
| Testing | Frontend: 24 Vitest tests | Complete |
| Testing | Backend: 84 Go tests | Complete |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Canvas | ReactFlow 11 |
| State | Zustand 5 |
| Charts | Recharts, D3.js |
| Editor | Monaco Editor |
| Collaboration | Yjs + y-websocket |
| Backend | Go 1.26, Fiber v2 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | JWT (golang-jwt) |
| Testing | Vitest (frontend), Go testing (backend) |
| IaC | Custom template engine (text/template) |
| Container | Docker + Docker Compose |

## API Endpoints

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user profile (JWT)
- `POST /api/auth/ws-ticket` — Get WebSocket ticket (JWT)

### Projects
- `GET /api/projects/` — List user projects (JWT)
- `POST /api/projects/` — Create project (JWT)
- `GET /api/projects/:id` — Get project details (JWT)
- `PUT /api/projects/:id` — Update project (JWT)
- `DELETE /api/projects/:id` — Delete project (JWT)
- `PUT /api/projects/:id/canvas` — Save canvas data (JWT)
- `POST /api/projects/:id/collaborators` — Add collaborator (JWT)
- `GET /api/projects/:id/collaborators` — List collaborators (JWT)

### Simulations
- `POST /api/simulations/start` — Start simulation (JWT)
- `POST /api/simulations/:id/stop` — Stop simulation (JWT)
- `GET /api/simulations/history/:projectId` — Run history (JWT)

### Deployment
- `POST /api/simulations/:id/deployment/shift` — Shift canary traffic (JWT)
- `POST /api/simulations/:id/deployment/failover` — Failover canary (JWT)
- `POST /api/simulations/:id/deployment/promote` — Promote blue/green (JWT)
- `GET /api/simulations/:id/deployment/state` — Get deployment state (JWT)
- `POST /api/simulations/:id/deployment/set-group` — Set blue/green group (JWT)

### Chaos
- `POST /api/chaos/inject` — Inject chaos event (JWT)
- `GET /api/chaos/active/:simulationRunId` — Active events (JWT)

### Security
- `POST /api/security/audit` — Run security audit (JWT)

### FinOps
- `POST /api/finops/estimate` — Calculate cost estimate (JWT)

### Export / Import
- `POST /api/export/` — Export to IaC (JWT)
- `POST /api/import/` — Import from IaC (JWT)

### Challenges
- `GET /api/challenges/` — List challenges (JWT)
- `GET /api/challenges/:id` — Get challenge details (JWT)
- `POST /api/challenges/:id/start` — Start challenge (JWT)
- `POST /api/challenges/:id/submit` — Submit challenge (JWT)
- `POST /api/challenges/:id/drill` — Start drill (JWT)
- `GET /api/challenges/leaderboard` — Get leaderboard (JWT)

### WebSocket
- `GET /ws/simulation?ticket=&projectId=` — Simulation tick stream
- `GET /ws/yjs/:projectId?ticket=` — Yjs collaboration

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:changeme@localhost:5432/systemdesign` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `8080` | HTTP server port |
| `JWT_SECRET` | — | Secret key for JWT signing |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080/api` | Backend API base URL |

## Testing

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && go test -count=1 ./...

# All backend tests with verbose output
cd backend && go test -count=1 -v ./...
```

## License

MIT
