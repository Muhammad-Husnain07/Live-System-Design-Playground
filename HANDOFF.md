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
│   ├── main.go                 # Entry point (DB init, migrations, server)
│   ├── config/                 # App configuration
│   │   ├── config.go           # Env-based config loader
│   │   ├── database.go         # lib/pq connection pool (max 25)
│   │   └── migrate.go          # SQL migration runner
│   ├── migrations/             # Raw SQL migration files (numbered)
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

## Database Schema

### Entity-Relationship Diagram (Text)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                    users                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ id (UUID PK) │ email (VARCHAR UNIQUE) │ username (VARCHAR UNIQUE)           │
│ password_hash (VARCHAR) │ created_at │ updated_at                           │
└────────┬─────────────────────────────────────────────────────────────────────┘
         │ 1
         │
    ┌────┴────────────────────┐
    │         projects        │
    ├─────────────────────────┤
    │ id (UUID PK)            │
    │ user_id (UUID FK) ──────┤── references users(id) ON DELETE CASCADE
    │ name (VARCHAR)          │
    │ description (TEXT)      │
    │ is_public (BOOLEAN)     │
    │ canvas_data (JSONB)     │
    │ metadata (JSONB)        │
    │ created_at / updated_at │
    └────┬─────────┬──────────┘
         │ 1       │ 1
         │         │
    ┌────┴────┐ ┌──┴──────────────────┐
    │ project │ │   simulation_runs   │
    │ collab  │ ├─────────────────────┤
    │ orators │ │ id (UUID PK)        │
    ├─────────┤ │ project_id (FK) ────┤── references projects(id) ON DELETE CASCADE
    │ id PK   │ │ user_id (FK) ───────┤── references users(id)
    │ proj FK │ │ config (JSONB)      │
    │ user FK │ │ results (JSONB)     │
    │ role    │ │ status (VARCHAR)    │
    │ joined  │ │ started_at / done   │
    └─────────┘ │ created_at          │
                └──────────┬──────────┘
                           │ 1
                           │
                     ┌─────┴──────────┐
                     │  chaos_events  │
                     ├────────────────┤
                     │ id (UUID PK)   │
                     │ run_id (FK) ───┤── references simulation_runs(id)
                     │ event_type     │
                     │ target_node_id │
                     │ triggered_at   │
                     │ duration_sec   │
                     │ config (JSONB) │
                     └────────────────┘

┌──────────────────────┐      ┌────────────────────────────────┐
│      challenges      │      │   challenge_submissions        │
├──────────────────────┤      ├────────────────────────────────┤
│ id (UUID PK)         │      │ id (UUID PK)                   │
│ title (VARCHAR)      │      │ challenge_id (FK) ─────────────┤── references challenges(id) ON DELETE CASCADE
│ description (TEXT)   │      │ user_id (FK) ──────────────────┤── references users(id)
│ difficulty (VARCHAR) │      │ project_id (FK) ───────────────┤── references projects(id)
│ requirements (JSONB) │      │ score (FLOAT)                  │
│ initial_canvas (J)   │      │ passed (BOOLEAN)               │
│ time_limit_sec (INT) │      │ submitted_at                   │
│ passing_criteria (J) │      └────────────────────────────────┘
│ created_at           │
└──────────────────────┘
```

### Table Purposes

| Table | Purpose |
|-------|---------|
| **users** | Core identity — stores credentials (bcrypt hash), email, and username for every user. Unique constraints on email and username. |
| **projects** | Design canvas state — each project belongs to one owner. `canvas_data` stores the full React Flow node/edge graph as JSONB. `metadata` holds tags, description, or custom properties. |
| **project_collaborators** | Multi-user access — join table linking users to projects with a role (`viewer`, `editor`, `admin`). Unique composite key on (project_id, user_id). |
| **simulation_runs** | Execution history — records each simulation run against a project. `config` stores the simulation parameters (latency, throughput, failure modes). `results` stores output metrics. Status tracks lifecycle: `pending` → `running` → `completed` / `failed`. |
| **chaos_events** | Fault injection — events triggered during a simulation run. `event_type` describes the fault (e.g. `node_crash`, `network_partition`, `latency_spike`). `target_node_id` references nodes in the canvas graph. |
| **challenges** | Curated exercises — predefined system design problems with requirements, an initial canvas, a time limit, and passing criteria (all JSONB for flexibility). |
| **challenge_submissions** | User progress — tracks each user's attempt at a challenge, linking to their submitted project, with a score and pass/fail status. |

### JSONB Usage Decisions

1. **`projects.canvas_data`** — The React Flow graph (nodes, edges, viewport) is semi-structured and schema-less by nature. Users can add custom node types with arbitrary data fields. JSONB allows querying into specific node properties via `@>` operators without schema migrations.

2. **`projects.metadata`** — Flexible key-value store for tags, descriptions, custom fields. Avoids nullable columns for optional attributes.

3. **`simulation_runs.config`** — Simulation parameters vary by architecture type (load balancer config, cache TTLs, DB pool sizes). JSONB avoids a separate configs table per simulation type.

4. **`simulation_runs.results`** — Output metrics are heterogeneous (latency histograms, throughput curves, error rates). JSONB allows the simulation engine to write results in any shape.

5. **`chaos_events.config`** — Per-event parameters differ by event type. A `latency_spike` event needs `delay_ms` and `jitter`, while a `node_crash` needs `restart_delay`. JSONB keeps the schema flat.

6. **`challenges.requirements`**, **`challenges.initial_canvas`**, **`challenges.passing_criteria`** — Challenge definitions are authored by admins and evolve rapidly. JSONB avoids ALTER TABLE for each new requirement field.

### Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| users | `idx_users_email` | B-tree | Fast login by email |
| users | `idx_users_username` | B-tree | Fast profile lookup |
| projects | `idx_projects_user_id` | B-tree | List projects owned by user |
| projects | `idx_projects_is_public` | B-tree | Filter public projects |
| project_collaborators | `idx_collaborators_project_id` | B-tree | Find collaborators for a project |
| project_collaborators | `idx_collaborators_user_id` | B-tree | Find projects for a collaborator |
| simulation_runs | `idx_simulation_runs_project_id` | B-tree | List runs for a project |
| simulation_runs | `idx_simulation_runs_user_id` | B-tree | Find runs by user |
| simulation_runs | `idx_simulation_runs_status` | B-tree | Filter by status |
| chaos_events | `idx_chaos_events_simulation_run_id` | B-tree | List events for a run |
| chaos_events | `idx_chaos_events_event_type` | B-tree | Filter events by type |
| challenges | `idx_challenges_difficulty` | B-tree | Filter challenges by difficulty |
| challenge_submissions | `idx_submissions_challenge_id` | B-tree | List submissions for a challenge |
| challenge_submissions | `idx_submissions_user_id` | B-tree | Find submissions by user |
| challenge_submissions | `idx_submissions_passed` | B-tree | Filter by pass/fail |

## Verification: PASSED

### Scaffold + DB Schema — Verified 2026-05-16

| Spec Item | Status |
|-----------|--------|
| 001_create_users.sql — all 6 columns, 2 indexes | ✅ |
| 002_create_projects.sql — all 9 columns, 2 indexes, FK to users | ✅ |
| 003_create_project_collaborators.sql — 5 columns + UNIQUE composite, 2 indexes, FK to users+projects | ✅ |
| 004_create_simulation_runs.sql — 9 columns, 3 indexes, FK to projects+users | ✅ |
| 005_create_chaos_events.sql — 7 columns, 2 indexes, FK to simulation_runs | ✅ |
| 006_create_challenges.sql — 9 columns, 1 index | ✅ |
| 007_create_challenge_submissions.sql — 7 columns, 3 indexes, FKs to challenges+users+projects | ✅ |
| config/database.go — lib/pq, pool max 25 open/idle, 5min lifetime, Ping() | ✅ |
| config/migrate.go — reads sorted .sql files, Exec() each, error wrapping | ✅ |
| main.go — InitDatabase → RunMigrations → /api/health with DB status | ✅ |
| Spec-requested indexes: users.email, projects.user_id, collaborators.project_id, submissions.challenge_id, submissions.user_id | ✅ |

### Scaffold Cross-Check (2026-05-15)
| Spec Item | Status |
|-----------|--------|
| Root files (.gitignore, .env.example, docker-compose.yml, HANDOFF.md) | ✅ |
| Frontend: Vite + React + TypeScript scaffold | ✅ |
| Frontend: All 13 dependencies installed (tailwindcss, reactflow, zustand, d3, framer-motion, monaco-editor, yjs, y-websocket, socket.io-client, axios, react-router-dom, recharts, html2canvas) | ✅ |
| Frontend: Tailwind config with zinc palette dark theme | ✅ |
| Frontend: Folder structure (canvas, sidebar, toolbar, panels, ui, store, hooks, types, utils, pages) | ✅ |
| Backend: Go module `systemdesign` | ✅ |
| Backend: All 8 Go deps installed (fiber/v2, gorilla/websocket, lib/pq, go-redis/v9, godotenv, uuid, jwt, bcrypt) | ✅ |
| Backend: Folder structure (config, handlers, middleware, models, services, simulation, ws, iac) | ✅ |
| Backend: main.go with /api/health endpoint + CORS | ✅ |
| Backend: config/config.go with Config struct + Load() | ✅ |
| Docker Compose: postgres (5432), redis (6379), backend (8080, Air hot reload), frontend (5173), bridge network | ✅ |
| .env.example: All 5 variables with default values | ✅ |
| .gitignore: Node, Go, IDE, OS, Docker, log ignores | ✅ |
| Git repo initialized and pushed to GitHub (public) | ✅ |

### Build Results
- `go build ./...` — ✅ PASSED
- `go vet ./...` — ✅ PASSED
- `npx tsc --noEmit` — ✅ PASSED
- `npm run build` (tsc -b + vite build) — ✅ PASSED

### Decisions Made During Scaffold
- Used `reactflow` (v11) instead of deprecated `react-flow-renderer` which doesn't support React 19
- Go deps installed via `go mod edit -require` with `GOPROXY=off` for faster local resolution after initial download cached the modules

### Files Created (58 files)
```
.env.example
.gitignore
HANDOFF.md
docker-compose.yml
frontend/package.json, package-lock.json, index.html, vite.config.ts
frontend/tsconfig.json, tsconfig.app.json, tsconfig.node.json
frontend/eslint.config.js, postcss.config.js, tailwind.config.js
frontend/Dockerfile
frontend/src/main.tsx, src/App.tsx, src/index.css
frontend/src/assets/hero.png, react.svg, vite.svg
frontend/public/favicon.svg, icons.svg
frontend/src/components/{canvas,sidebar,toolbar,panels,ui}/.gitkeep
frontend/src/{store,hooks,types,utils,pages}/.gitkeep
backend/go.mod, go.sum, main.go
backend/config/config.go, config/database.go, config/migrate.go
backend/migrations/001_create_users.sql
backend/migrations/002_create_projects.sql
backend/migrations/003_create_project_collaborators.sql
backend/migrations/004_create_simulation_runs.sql
backend/migrations/005_create_chaos_events.sql
backend/migrations/006_create_challenges.sql
backend/migrations/007_create_challenge_submissions.sql
backend/.air.toml, backend/Dockerfile
backend/{handlers,middleware,models,services,simulation,ws,iac}/.gitkeep
```

## Authentication System

### Files Created/Modified

| File | Purpose |
|------|---------|
| `backend/config/jwt.go` | JWT claims struct, token generation (`GenerateToken`), token parsing (`ParseToken`) |
| `backend/config/redis.go` | Redis client init, ping verification, close |
| `backend/models/user.go` | `User`, `UserResponse`, `RegisterRequest`, `LoginRequest` structs |
| `backend/services/auth.go` | `RegisterUser`, `AuthenticateUser`, `GetUserByID`, validation, bcrypt hashing (cost 12) |
| `backend/handlers/auth.go` | `AuthHandler` with Register/Login/Me/WsTicket methods |
| `backend/middleware/jwt.go` | `JWTAuth` middleware — extracts Bearer token, parses JWT, sets `user` in fiber context |
| `backend/main.go` | Added Redis init, CORS method/header expansion, auth route wiring |

### Auth Endpoints

#### `POST /api/auth/register`

Create a new user account.

```
Request:
{
  "email": "user@example.com",
  "username": "myuser",
  "password": "securepass123"
}

Response 201:
{
  "user": { "id": "uuid", "email": "user@example.com", "username": "myuser" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}

Response 400:
{ "error": "email already in use" | "invalid email format" | "username must be 3-20 characters..." | "password must be at least 8 characters" }
```

Validations:
- Email: parsed via `mail.ParseAddress`
- Username: 3-20 chars, alphanumeric + underscores (`^[a-zA-Z0-9_]{3,20}$`)
- Password: minimum 8 characters
- Email lowercased before storage
- Duplicate email and username checked before insert

#### `POST /api/auth/login`

Authenticate with email and password.

```
Request:
{
  "email": "user@example.com",
  "password": "securepass123"
}

Response 200:
{
  "user": { "id": "uuid", "email": "user@example.com", "username": "myuser" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}

Response 401:
{ "error": "invalid email or password" }
```

#### `GET /api/auth/me`

Get current user. Requires `Authorization: Bearer <token>` header.

```
Response 200:
{ "user": { "id": "uuid", "email": "user@example.com", "username": "myuser" } }

Response 401:
{ "error": "missing authorization header" | "invalid or expired token" }
```

#### `POST /api/auth/ws-ticket`

Generate a short-lived WebSocket ticket (no JWT in query params). Requires auth.

```
Response 200:
{ "ticket": "550e8400-e29b-41d4-a716-446655440000" }

Response 401:
{ "error": "missing authorization header" }
```

### JWT Implementation

| Property | Value |
|----------|-------|
| Library | `golang-jwt/jwt v5` (HS256 signing) |
| Expiry | 7 days from issuance |
| Payload | `user_id` (UUID), `email`, `username` |
| Secret | From `JWT_SECRET` env var |
| Header | `Authorization: Bearer <token>` |
| Context key | `"user"` (accessible via `c.Locals("user")`) |

JWT Claims struct (`config.JWTClaims`):
```go
type JWTClaims struct {
    UserID   string `json:"user_id"`
    Email    string `json:"email"`
    Username string `json:"username"`
    jwt.RegisteredClaims
}
```

### WS Ticket System

| Property | Value |
|----------|-------|
| Purpose | Authenticate WebSocket connections without exposing JWT in URL query params |
| Ticket | Random UUID v4 string |
| TTL | 60 seconds |
| Redis key | `ws_ticket:<ticket>` → value: `user_id` |
| Redis command | `SET ws_ticket:<uuid> <user_id> EX 60` |
| Cleanup | Automatic via Redis key expiry (EX 60) |

After obtaining a ticket, the WebSocket client connects with `?ticket=<uuid>` in the query string. The WS upgrade handler looks up `ws_ticket:<uuid>` in Redis, retrieves the `user_id`, and deletes the key.

### Password Hashing

- Algorithm: bcrypt
- Cost factor: 12
- Library: `golang.org/x/crypto`
- Hash stored in `users.password_hash` column (VARCHAR 255)

### CORS Configuration

| Setting | Value |
|---------|-------|
| `AllowOrigins` | `FRONTEND_URL` env var |
| `AllowMethods` | `GET, POST, PUT, DELETE, OPTIONS` |
| `AllowHeaders` | `Origin, Content-Type, Accept, Authorization` |
| `ExposeHeaders` | `Content-Length` |

## Auth System Verification — 2026-05-16: PASSED

| Spec Item | Status |
|-----------|--------|
| backend/models/user.go — User, UserResponse, RegisterRequest, LoginRequest structs | ✅ |
| backend/config/jwt.go — JWTClaims (user_id, email, username), GenerateToken (7d expiry, HS256), ParseToken | ✅ |
| backend/config/redis.go — Redis client init via ParseURL, Ping(), CloseRedis() | ✅ |
| backend/services/auth.go — RegisterUser (bcrypt cost 12, email/username/password validation), AuthenticateUser, GetUserByID | ✅ |
| backend/handlers/auth.go — AuthHandler with Register/Login/Me/WsTicket methods | ✅ |
| backend/middleware/jwt.go — JWTAuth middleware, Bearer extraction, `c.Locals("user")` | ✅ |
| backend/main.go — Redis init (non-fatal), CORS methods/headers/expose-headers, route wiring | ✅ |
| POST /api/auth/register — validates email (mail.ParseAddress), username (3-20 alnum+_), password (min 8) | ✅ |
| POST /api/auth/login — authenticates email+password, returns {user, token} | ✅ |
| GET /api/auth/me — protected, returns current user from JWT claims | ✅ |
| POST /api/auth/ws-ticket — protected, UUID ticket with 60s Redis TTL | ✅ |

### Build Results
- `go build ./...` — ✅ PASSED
- `go vet ./...` — ✅ PASSED
- `npx tsc --noEmit` — ✅ PASSED
- `npm run build` — ✅ PASSED

### Fixes Applied During Verification
| Issue | Fix |
|-------|-----|
| `services/auth.go` — `RegisterUser` returned unused `hash` string as 3rd value | Changed signature to return `(*models.UserResponse, error)` only; handler updated to match |
| `handlers/auth.go` — Login handler returned 401 for all errors including DB failures | Now returns 401 only for `ErrInvalidCreds`, otherwise 500 for server errors |

## Frontend Auth UI

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/utils/api.ts` | Axios instance with `VITE_API_URL` base, Bearer token interceptor, 401 auto-logout |
| `frontend/src/store/authStore.ts` | Zustand store: `user`, `token`, `isAuthenticated`, `isLoading`, `error` — actions: `login`, `register`, `logout`, `checkAuth`, `fetchWsTicket` |
| `frontend/src/pages/LoginPage.tsx` | Centered dark form with email/password, error display, loading state, redirect on auth |
| `frontend/src/pages/RegisterPage.tsx` | Centered dark form with email/username/password/confirm, client-side validation, error display |
| `frontend/src/pages/DashboardPage.tsx` | Placeholder dashboard with header (username, sign out) |
| `frontend/src/pages/ProjectPage.tsx` | Placeholder project canvas page |
| `frontend/src/pages/ObservabilityPage.tsx` | Placeholder observability / metrics page |
| `frontend/src/components/ui/ProtectedRoute.tsx` | Auth guard — shows spinner while loading, redirects to `/login` if unauthenticated, renders `<Outlet />` |
| `frontend/src/App.tsx` | Routes: `/`, `/login`, `/register`, `/dashboard`, `/project/:id`, `/project/:id/observe` with `ProtectedRoute` wrapper |

### Files Modified

| File | Change |
|------|--------|
| `frontend/.env` | Added `VITE_API_URL=http://localhost:8080/api` |
| `.env.example` | Added `VITE_API_URL` env variable |

### Auth Flow

```
App mount
  │
  ├─ token in localStorage?
  │   ├─ NO  → isAuthenticated=false, show LoginPage
  │   └─ YES → set isLoading=true, call GET /api/auth/me
  │              │
  │              ├─ 200 → set user + isAuthenticated=true
  │              └─ 401 → clear token, isAuthenticated=false
  │
  └─ isLoading done → render router
```

### Token Persistence

| Key | Value | Set On |
|-----|-------|--------|
| `auth_token` | JWT string | login / register |
| `auth_user` | `{ id, email, username }` JSON | login / register / checkAuth |

Both keys are removed on logout or 401 interceptor trigger.

### Axios Interceptor Behavior

- **Request**: Reads `auth_token` from localStorage, sets `Authorization: Bearer <token>` on every request
- **Response (401)**: Clears localStorage tokens, redirects `window.location.href = "/login"` (hard redirect to reset all state)

### Route Map

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/` | Redirect to `/dashboard` or `/login` | No |
| `/login` | LoginPage | No (redirects away if authed) |
| `/register` | RegisterPage | No (redirects away if authed) |
| `/dashboard` | DashboardPage | Yes |
| `/project/:id` | ProjectPage | Yes |
| `/project/:id/observe` | ObservabilityPage | Yes |
| `*` | Redirect to `/` | No |

### Client-Side Validations (RegisterPage)

| Field | Rule |
|-------|------|
| Email | Must contain `@` |
| Username | 3–20 characters, `[a-zA-Z0-9_]` only |
| Password | Minimum 8 characters |
| Confirm | Must match password |

## Frontend Auth UI Verification — 2026-05-16: PASSED

| Spec Item | Status |
|-----------|--------|
| `store/authStore.ts` — User interface, AuthState with user/token/isAuthenticated/isLoading, login/register/logout/checkAuth/fetchWsTicket actions, localStorage persistence | ✅ |
| `utils/api.ts` — Axios instance with VITE_API_URL base, request interceptor (Bearer token), response interceptor (401 → clear + redirect) | ✅ |
| `pages/LoginPage.tsx` — Email/password form, loading state, error display, link to /register, redirect to /dashboard | ✅ |
| `pages/RegisterPage.tsx` — Email/username/password/confirm form, client-side validation (email format, username 3-20 alnum, password min 8, confirm match), error display | ✅ |
| `components/ui/ProtectedRoute.tsx` — Loading spinner → redirect /login → Outlet for authenticated users | ✅ |
| `pages/DashboardPage.tsx` — Header with username display + sign out button, placeholder project list | ✅ |
| `pages/ProjectPage.tsx` — Header with project ID, placeholder canvas area | ✅ |
| `pages/ObservabilityPage.tsx` — Header with project ID, placeholder metrics area | ✅ |
| `App.tsx` — 6 routes + catch-all, checkAuth() on mount, global loading spinner, BrowserRouter | ✅ |
| `.env.example` / `frontend/.env` — VITE_API_URL added | ✅ |
| Dark engineering theme (zinc palette, surface-950, Tailwind only, centered forms) | ✅ |

### Build Results
- `go build ./...` — ✅ PASSED
- `go vet ./...` — ✅ PASSED
- `npx tsc --noEmit` — ✅ PASSED
- `npm run build` (87 modules, 285KB JS) — ✅ PASSED

### Routes Verified
| Path | Expected | Actual |
|------|----------|--------|
| `/` | Redirect to `/dashboard` or `/login` | ✅ |
| `/login` | LoginPage (dark form) | ✅ |
| `/register` | RegisterPage (dark form, 4 fields + validation) | ✅ |
| `/dashboard` | ProtectedRoute → DashboardPage | ✅ |
| `/project/:id` | ProtectedRoute → ProjectPage | ✅ |
| `/project/:id/observe` | ProtectedRoute → ObservabilityPage | ✅ |
| `*` | Redirect to `/` | ✅ |

---
## User Profile & Settings

### Files Created

| File | Purpose |
|------|---------|
| `backend/services/users.go` | `GetFullProfile`, `UpdateProfile` (optional email/username, uniqueness check), `ChangePassword` (verify current, bcrypt new), `DeleteAccount` (hard delete, CASCADE) |
| `backend/handlers/users.go` | `UserHandler` with GetProfile/UpdateProfile/ChangePassword/DeleteAccount methods |
| `frontend/src/pages/ProfilePage.tsx` | 3-section settings page: edit profile, change password, danger zone (delete account) |

### Files Modified

| File | Change |
|------|--------|
| `backend/main.go` | Wired `/api/users/me/*` routes (all JWT-protected) |
| `frontend/src/pages/DashboardPage.tsx` | Added "Settings" link next to sign out |
| `frontend/src/App.tsx` | Added `/settings` route (ProtectedRoute → ProfilePage) |

### Profile Endpoints

#### `GET /api/users/me/profile`
```
Response 200:
{ "user": { "id": "uuid", "email": "user@example.com", "username": "myuser", "created_at": "..." } }
```

#### `PUT /api/users/me/profile`
```
Request:
{ "email": "new@example.com", "username": "newname" }  // both optional

Response 200:
{ "user": { "id": "uuid", "email": "new@example.com", "username": "newname", "created_at": "..." } }

Response 400:
{ "error": "email already in use" | "invalid email format" | "username must be 3-20 characters..." }
```

#### `PUT /api/users/me/password`
```
Request:
{ "current_password": "oldpass", "new_password": "newpass123" }

Response 200:
{ "message": "password updated successfully" }

Response 400:
{ "error": "current password is incorrect" | "new password must be at least 8 characters" }
```

#### `DELETE /api/users/me/account`
```
Response 200:
{ "message": "account deleted successfully" }

Response 404:
{ "error": "user not found" }
```

## User Profile Verification — 2026-05-16: PASSED

| Spec Item | Status |
|-----------|--------|
| `services/users.go` — GetFullProfile, UpdateProfile (optional fields, uniqueness), ChangePassword (verify current, bcrypt new), DeleteAccount (hard delete) | ✅ |
| `handlers/users.go` — UserHandler with GetProfile/UpdateProfile/ChangePassword/DeleteAccount, proper error codes | ✅ |
| `main.go` — 4 user routes wired under `/api/users/me/*` with JWTAuth middleware | ✅ |
| `frontend/src/pages/ProfilePage.tsx` — 3 sections: edit profile, change password, danger zone, all with loading/error/empty states | ✅ |
| `frontend/src/App.tsx` — `/settings` route added under ProtectedRoute | ✅ |
| ProfilePage loads `/users/me/profile` directly via useEffect (not Zustand store) | ✅ |

### Build Results
- `go build ./...` — ✅ PASSED
- `go vet ./...` — ✅ PASSED
- `npx tsc --noEmit` — ✅ PASSED
- `npm run build` — ✅ PASSED

## Project CRUD API (Phase 2.1)

### Files

| File | Purpose |
|------|---------|
| `backend/models/project.go` | `Project`, `ProjectResponse`, `ProjectDetailResponse`, `CreateProjectRequest` (+`is_public`), `UpdateProjectRequest`, `SaveCanvasRequest`, `AddCollaboratorRequest`, `CollaboratorResponse`, `ProjectListResponse` (paginated) |
| `backend/services/projects.go` | Paginated `ListUserProjects` (page/limit/total), `CreateProject` (init canvas as `{"nodes":[],"edges":[]}`), `GetProjectByID`, `UpdateProject` (COALESCE pattern), `SaveCanvas`, `DeleteProject`, `AddCollaborator`, `ListCollaborators` |
| `backend/handlers/projects.go` | 8 methods: List (paginated query params), Get, Create, Update (COALESCE), SaveCanvas, Delete, AddCollaborator, ListCollaborators |
| `frontend/src/store/projectStore.ts` | Zustand store with pagination state, `saveCanvas`, `addCollaborator`, `fetchCollaborators` actions |

### Modified Files

| File | Change |
|------|--------|
| `backend/main.go` | Added routes: `POST /:id/collaborators`, `GET /:id/collaborators`, `PUT /:id/canvas` |
| `frontend/src/pages/DashboardPage.tsx` | Paginated project grid (Prev/Next), public badge, `is_public` toggle in create modal |
| `frontend/src/pages/ProjectPage.tsx` | Auto-save canvas via `PUT /projects/:id/canvas` (2s debounce), saved indicator in header |

### All Project Endpoints

#### `GET /api/projects/?page=1&limit=20`
Paginated list of projects the user owns or collaborates on.

```
Response 200:
{
  "projects": [
    { "id": "uuid", "user_id": "uuid", "name": "My Design", "description": "...",
      "is_public": false, "created_at": "...", "updated_at": "..." }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Pagination strategy**: Server-side offset-based. Defaults: `page=1`, `limit=20`. Max limit 100. Client renders Prev/Next controls. Total count returned for UI pagination display.

#### `POST /api/projects/`
Create project with empty canvas (`{"nodes":[],"edges":[]}`).

```
Request:
{ "name": "My Design", "description": "Optional", "is_public": true }

Response 201:
{ "project": { "id": "uuid", "user_id": "uuid", "name": "My Design", ... } }

Response 400:
{ "error": "project name is required" }
```

#### `GET /api/projects/:id`
Full project detail including canvas_data and user role.

```
Response 200:
{
  "project": {
    "id": "uuid", "user_id": "uuid", "name": "My Design", "description": "...",
    "is_public": false, "canvas_data": {"nodes":[...],"edges":[...]},
    "metadata": {}, "created_at": "...", "updated_at": "...", "role": "owner"
  }
}

Response 404:
{ "error": "project not found" | "you do not have permission to perform this action" }
```

#### `PUT /api/projects/:id`
Partial update using SQL COALESCE — only provided fields are changed.

```
Request:
{ "name": "New Name", "description": "New desc", "is_public": true,
  "canvas_data": "{\"nodes\":[]}", "metadata": "{\"key\":\"val\"}" }

Response 200:
{ "project": { ... } }

Response 403:
{ "error": "you do not have permission to perform this action" }
```

#### `PUT /api/projects/:id/canvas`
Frequent auto-save endpoint. Called when Yjs is NOT connected. Saves only `canvas_data` and returns the new `updated_at` timestamp.

```
Request:
{ "canvas_data": "{\"nodes\":[...],\"edges\":[...]}" }

Response 200:
{ "saved": true, "updated_at": "2026-05-16T12:00:00Z" }

Response 403:
{ "error": "you do not have permission to perform this action" }
```

#### `DELETE /api/projects/:id`
Owner only.

```
Response 200:
{ "message": "project deleted successfully" }

Response 403:
{ "error": "you do not have permission to perform this action" }
```

#### `POST /api/projects/:id/collaborators`
Add a collaborator by email. Owner only.

```
Request:
{ "email": "user@example.com", "role": "editor" }

Response 201:
{ "collaborator": { "user_id": "uuid", "username": "myuser", "email": "user@example.com",
    "role": "editor", "joined_at": "..." } }

Response 400/403/404:
{ "error": "user is already a collaborator" | "cannot add yourself as a collaborator" |
  "role must be 'editor' or 'viewer'" | "you do not have permission..." | "user not found" }
```

#### `GET /api/projects/:id/collaborators`
List all collaborators with user details.

```
Response 200:
{
  "collaborators": [
    { "user_id": "uuid", "username": "myuser", "email": "user@example.com",
      "role": "editor", "joined_at": "..." }
  ]
}
```

### Updated Route Map

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/` | Redirect to `/dashboard` or `/login` | No |
| `/login` | LoginPage | No |
| `/register` | RegisterPage | No |
| `/dashboard` | DashboardPage (paginated) | Yes |
| `/project/:id` | ProjectPage (ReactFlow + auto-save) | Yes |
| `/project/:id/observe` | ObservabilityPage | Yes |
| `/settings` | ProfilePage | Yes |
| `*` | Redirect to `/` | No |

### Backend Route Summary

| Method | Path | Handler | Access |
|--------|------|---------|--------|
| GET | `/api/projects/` | List | Owner + Collaborator |
| POST | `/api/projects/` | Create | Any authenticated |
| GET | `/api/projects/:id` | Get | Owner + Collaborator |
| PUT | `/api/projects/:id` | Update | Owner + Editor |
| DELETE | `/api/projects/:id` | Delete | Owner only |
| POST | `/api/projects/:id/collaborators` | AddCollaborator | Owner only |
| GET | `/api/projects/:id/collaborators` | ListCollaborators | Owner + Collaborator |
| PUT | `/api/projects/:id/canvas` | SaveCanvas | Owner + Editor |

### Access Control Matrix

| Role | View | Create | Edit Fields | Edit Canvas | Delete | Manage Collabs |
|------|------|--------|-------------|-------------|--------|----------------|
| Owner | ✅ | ✅ (owned) | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Error Handling & Edge Cases

- **Pagination**: page defaults to 1, limit defaults to 20 (max 100), offset-based
- **Empty list**: Returns `"projects": []` with `total: 0`
- **Empty name**: Server returns `400`, client button disabled
- **Delete confirmation**: `confirm()` dialog before DELETE
- **Not found / forbidden**: 404 for project get, 403 for owner-only operations by non-owner
- **Loading**: Full-screen spinner on initial mount
- **Canvas auto-save**: 2-second debounce after any node/edge change; sets `saving`/`saved` indicator
- **Duplicate collaborator**: Returns `400` with "user is already a collaborator"
- **Self-collaborator**: Returns `400` with "cannot add yourself as a collaborator"
- **Invalid role**: Returns `400` with "role must be 'editor' or 'viewer'"

## Dashboard (Phase 2.2)

### Components

| File | Purpose |
|------|---------|
| `frontend/src/store/projectStore.ts` | Store: `{ projects, totalProjects, currentPage, currentProject, isLoading }`; actions: `fetchProjects(page)`, `createProject()`, `deleteProject()`, `setCurrentProject()`, `updateProject()`, `getProject()`, `saveCanvas()` |
| `frontend/src/components/ui/ProjectCard.tsx` | Card showing project name, description, last updated, public/private badge; click navigates to `/project/:id`; hover reveals delete with 2-click confirmation |
| `frontend/src/components/ui/NewProjectModal.tsx` | Modal with fields: name (required), description (optional), public toggle; green accent submit button; loading/error states |
| `frontend/src/pages/DashboardPage.tsx` | LSDP logo header, user menu dropdown (Profile/Logout), New Project button, responsive project grid (1/2/3 cols), empty state with icon + "Create your first architecture" |

### Store Structure

```
State:
  projects: Project[]
  totalProjects: number
  currentPage: number
  currentProject: ProjectDetail | null
  isLoading: boolean
  error: string | null

Actions:
  fetchProjects(page?: number)     — GET /api/projects?page=N&limit=20
  createProject(name, desc, pub?)  — POST /api/projects
  getProject(id)                   — GET /api/projects/:id
  updateProject(id, data)          — PUT /api/projects/:id
  deleteProject(id)                — DELETE /api/projects/:id
  saveCanvas(id, canvasData)       — PUT /api/projects/:id/canvas
  setCurrentProject(project)       — setter
  clearError()                     — reset error
```

### Component Hierarchy

```
DashboardPage
  ├── <header>
  │   ├── "LSDP" logo (links to /dashboard)
  │   └── User dropdown
  │       ├── avatar (first letter)
  │       ├── Profile → /settings
  │       └── Logout → clears auth
  ├── [New Project] button (green)
  ├── Loading state → spinner
  ├── Empty state → icon + "Create your first architecture" + CTA button
  ├── Project grid
  │   └── ProjectCard × N
  │       ├── name, description, date
  │       ├── public/private badge
  │       ├── click → /project/:id
  │       └── hover delete → 2-click confirm
  ├── Pagination (Prev / Page X of Y / Next)
  └── NewProjectModal (conditional)
      ├── name input (required, focus)
      ├── description textarea (optional)
      ├── public checkbox
      ├── Cancel + Create Project (green) buttons
      └── error display
```

### Design Decisions

- **Green accent (#22c55e)**: All primary buttons, active borders, loading spinner, avatar badge use green instead of blue
- **LSDP logo**: Bold text logo in top-left, links to dashboard
- **User dropdown**: Click-to-open with click-away-to-close; shows avatar (first letter of username) + username on desktop
- **ProjectCard delete**: Two-click confirmation with 3-second auto-reset to avoid accidental deletes
- **Empty state**: Central icon (SVG grid), descriptive text, and a CTA button to create first project
- **Responsive grid**: 1 column mobile, 2 columns sm, 3 columns lg

## Phase 3.1 — Advanced Canvas Type System

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/types/canvas.ts` | Core type definitions: node categories, node types, configs, metrics, edge routing, CanvasNode/CanvasEdge interfaces |
| `frontend/src/utils/nodeRegistry.ts` | `NODE_REGISTRY` — metadata for all 25 node types with defaults, icons, colors |

### Type Architecture

```
NodeCategory          NodeType (union)        NodeMetadata
  ├ infrastructure      ├ LoadBalancer         ├ label, description
  ├ data               ├ PostgreSQLDB         ├ icon, color
  ├ network            ├ CDN                  ├ category
  ├ messaging          ├ MessageQueue         └ defaultConfig
  ├ compute            ├ ContainerCluster
  └ external           └ 20 more...

NodeConfig                    CanvasNode (extends ReactFlow Node)
  ├ instances, region          ├ data.nodeType: NodeType
  ├ maxRPS, latencyMs          ├ data.label: string
  ├ errorRate, isFailed        ├ data.config: NodeConfig
  ├ isBottleneck               ├ data.simulationState: SimulationNodeState
  ├ deployment                  └ data.metrics: NodeMetrics
  │  ├ strategy (rolling|blue_green|canary)
  │  ├ canaryPercent (0-100)
  │  └ canaryVersion
  └ security
     ├ isPublicFacing
     ├ requiresTLS
     ├ allowedInbound
     └ vpcId

EdgeRoutingConfig             CanvasEdge (extends ReactFlow Edge)
  ├ protocol (HTTP|gRPC|TCP|WS|AMQP)  ├ data.routing
  ├ isSync (sync vs async)            ├ data.throughputRPS
  ├ trafficPercent (0-100)            ├ data.latencyMs
  └ requiresTLS                       ├ data.isAnimated
                                      ├ data.isSaturated
                                      └ data.isSecure
```

### Node Categories & Types (25 total)

| Category | Color | Types |
|----------|-------|-------|
| **Infrastructure** | `#3B82F6` (blue) | LoadBalancer, APIGateway, WebServer, AppServer, Microservice |
| **Data** | `#F97316` (orange) | PostgreSQLDB, MySQLDB, MongoDB, Redis, Elasticsearch |
| **Network** | `#A855F7` (purple) | CDN, DNS, Firewall, VPC, Subnet |
| **Messaging** | `#06B6D4` (cyan) | MessageQueue, EventBus, PubSub |
| **Compute** | `#22C55E` (green) | ContainerCluster, ServerlessFunction, BatchProcessor, WorkerService |
| **External** | `#6B7280` (gray) | ExternalClient, ThirdPartyAPI, MobileClient, WebBrowser |

### Deployment Config

| Field | Type | Description |
|-------|------|-------------|
| `strategy` | `"rolling" \| "blue_green" \| "canary"` | Deployment strategy for this node |
| `canaryPercent` | `number` (0-100) | Traffic percentage directed to canary version |
| `canaryVersion` | `string` | Version identifier for the canary (e.g. "v2") |
| `isCanaryActive` | `boolean` | Whether canary deployment is currently active |

### Security Config

| Field | Type | Description |
|-------|------|-------------|
| `isPublicFacing` | `boolean` | Whether the node is exposed to the internet |
| `requiresTLS` | `boolean` | Whether TLS is required for incoming connections |
| `allowedInbound` | `string[]` | Node IDs permitted to connect to this node |
| `vpcId` | `string` | VPC or Subnet node ID this node belongs to |

### Edge Routing Config

| Field | Type | Description |
|-------|------|-------------|
| `protocol` | `"HTTP" \| "gRPC" \| "TCP" \| "WebSocket" \| "AMQP"` | Communication protocol |
| `isSync` | `boolean` | Sync (web/REST) vs async (queue) communication |
| `trafficPercent` | `number` (0-100) | Traffic split percentage for load balancer routing |
| `requiresTLS` | `boolean` | Whether TLS is required on this edge |

### Simulation Node State

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"healthy" \| "degraded" \| "failing" \| "down"` | Current health status |
| `uptimeSeconds` | `number` | Seconds since last failure |
| `lastFailure` | `string \| null` | ISO timestamp of last failure event |
| `failureCount` | `number` | Total failure count since simulation start |

### Node Metrics (Runtime Values)

| Field | Type | Description |
|-------|------|-------------|
| `currentRPS` | `number` | Current requests per second |
| `cpuPercent` | `number` (0-100) | CPU utilization |
| `memoryPercent` | `number` (0-100) | Memory utilization |
| `queueDepth` | `number` | Pending request queue depth |
| `errorCount` | `number` | Error count in current window |
| `p99LatencyMs` | `number` | P99 latency in milliseconds |
| `canaryRPS` | `number` | RPS hitting the canary version |

### NODE_REGISTRY Default Configurations

Each of the 25 node types has sensible defaults:

| Node Type | Instances | Max RPS | Latency | Error Rate | Public? | TLS? |
|-----------|-----------|---------|---------|------------|---------|------|
| LoadBalancer | 2 | 10,000 | 5ms | 1% | ✅ | ✅ |
| APIGateway | 2 | 5,000 | 10ms | 1% | ✅ | ✅ |
| WebServer | 3 | 2,000 | 20ms | 1% | ❌ | ❌ |
| AppServer | 3 | 2,000 | 30ms | 1% | ❌ | ❌ |
| Microservice | 3 | 1,500 | 25ms | 1% | ❌ | ❌ |
| PostgreSQLDB | 1 | 1,000 | 50ms | 0.1% | ❌ | ❌ |
| MySQLDB | 1 | 1,000 | 50ms | 0.1% | ❌ | ❌ |
| MongoDB | 1 | 2,000 | 30ms | 0.1% | ❌ | ❌ |
| Redis | 2 | 10,000 | 5ms | 0.1% | ❌ | ❌ |
| Elasticsearch | 3 | 3,000 | 30ms | 0.1% | ❌ | ❌ |
| CDN | 1 | 50,000 | 2ms | 0.1% | ✅ | ✅ |
| DNS | 1 | 50,000 | 2ms | 0.1% | ✅ | ❌ |
| Firewall | 2 | 20,000 | 5ms | 0.1% | ✅ | ❌ |
| VPC | 0 | — | — | — | ❌ | ❌ |
| Subnet | 0 | — | — | — | ❌ | ❌ |
| MessageQueue | 3 | 10,000 | 15ms | 0.5% | ❌ | ❌ |
| EventBus | 3 | 15,000 | 10ms | 0.5% | ❌ | ❌ |
| PubSub | 3 | 20,000 | 8ms | 0.5% | ❌ | ❌ |
| ContainerCluster | 5 | 5,000 | 15ms | 1% | ❌ | ❌ |
| ServerlessFunction | 10 | 1,000 | 100ms | 1% | ✅ | ✅ |
| BatchProcessor | 2 | 500 | 5,000ms | 1% | ❌ | ❌ |
| WorkerService | 4 | 3,000 | 50ms | 1% | ❌ | ❌ |
| ExternalClient | 0 | 1,000 | 100ms | 0.1% | — | — |
| ThirdPartyAPI | 0 | 500 | 200ms | 0.1% | — | — |
| MobileClient | 0 | 2,000 | 150ms | 0.1% | — | — |
| WebBrowser | 0 | 3,000 | 100ms | 0.1% | — | — |

### CanvasState Shape

What `projects.canvas_data` (JSONB) stores:

```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "default",
      "position": { "x": 250, "y": 0 },
      "data": {
        "nodeType": "LoadBalancer",
        "label": "Main LB",
        "config": { "instances": 2, "region": "us-east-1", "maxRPS": 10000, ... },
        "simulationState": { "status": "healthy", "uptimeSeconds": 3600, ... },
        "metrics": { "currentRPS": 4500, "cpuPercent": 62, ... }
      }
    }
  ],
  "edges": [
    {
      "id": "e-1-2",
      "source": "node-1",
      "target": "node-2",
      "data": {
        "routing": { "protocol": "HTTP", "isSync": true, "trafficPercent": 100, "requiresTLS": true },
        "throughputRPS": 4500,
        "latencyMs": 8,
        "isAnimated": true,
        "isSaturated": false,
        "isSecure": true
      }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

## Phase 3.2 — Custom React Flow Node Components & Edges

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/components/canvas/BaseNode.tsx` | Core shared node component — handles, badges, indicators, metrics bar, framer-motion mount animation |
| `frontend/src/components/canvas/DatabaseNode.tsx` | Database cylinder/drum CSS aesthetic (renders inside BaseNode children slot) |
| `frontend/src/components/canvas/LoadBalancerNode.tsx` | Traffic split visual — SVG lines diverging from center node |
| `frontend/src/components/canvas/MessageQueueNode.tsx` | Queue depth fill bar — color-coded by utilization (cyan/orange/red) |
| `frontend/src/components/canvas/ContainerClusterNode.tsx` | Pod grid — 3x3 grid of green/empty boxes representing pod health |
| `frontend/src/components/canvas/CustomEdge.tsx` | Custom bezier edge with sync/async styling, saturation coloring, security violations, animated dots, and hover tooltip |
| `frontend/src/components/canvas/nodeTypes.ts` | Node type ↔ React Flow type mapper + `getReactFlowType()` helper, exports `nodeTypes` and `edgeTypes` registrations |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ProjectPage.tsx` | Replaced static initialNodes with typed demo architecture (WebBrowser → LoadBalancer → App Server + DB + Queue + Cluster); added `enrichNode()` mapper to set correct React Flow type from `data.nodeType`; wired `nodeTypes`/`edgeTypes` to `<ReactFlow>`; new edges now get default routing data |
| `frontend/src/index.css` | Added `@keyframes edge-dash` for animated edge stroke, `@keyframes pulse-red` for failed node |
| `frontend/src/types/canvas.ts` | Changed `CanvasNode`/`CanvasEdge` from `interface extends` to `type = Node<...>` / `type = Edge<...>` for TypeScript 6.0 compatibility (computed symbol in Node type) |
| `frontend/src/utils/nodeRegistry.ts` | Simplified override type helpers — removed overly strict `Omit<>` that prevented security field overrides |

### Node Component Architecture

```
ProjectPage (ReactFlow)
  ├── nodeTypes
  │   ├── "default"         → BaseNode
  │   ├── "database"        → DatabaseNode (wraps BaseNode + cylinder CSS)
  │   ├── "loadBalancer"    → LoadBalancerNode (wraps BaseNode + SVG traffic split)
  │   ├── "messageQueue"    → MessageQueueNode (wraps BaseNode + queue bar)
  │   └── "containerCluster" → ContainerClusterNode (wraps BaseNode + pod grid)
  └── edgeTypes
       └── "default"        → CustomEdge

BaseNode (shared frame)
  ├── Handles: Left(target), Right(source), Top(target), Bottom(source)
  │            (appear on hover via group-hover:opacity-100)
  ├── Header: icon + label + 🌐 badge (if isPublicFacing)
  ├── Type row: colored dot + type name + canary badge (if isCanaryActive)
  ├── Children slot (custom content from specific nodes)
  ├── Bottleneck warning (⚠️ if isBottleneck)
  ├── Metrics bar (CPU bar, MEM bar, RPS text - only when metrics exist)
  ├── Failed overlay (❌ + red pulse border if isFailed)
  ├── Selected glow (blue box-shadow)
  └── Mount animation (framer-motion scale 0.85→1, opacity 0→1)
```

### Specific Node Visuals

| Node | Feature | Implementation |
|------|---------|----------------|
| **DatabaseNode** | Cylinder/drum | CSS half-ellipse at top (`rounded-t-full`) + gradient from `surface-700/40` |
| **LoadBalancerNode** | Traffic split | SVG with 3 lines diverging from center circle, 8px tall |
| **MessageQueueNode** | Queue depth bar | Colored bar (cyan < 50%, orange < 80%, red ≥ 80%) + "N queued" label |
| **ContainerClusterNode** | Pod grid | 3×3 grid of dots; first `instances` dots green, rest gray |

### Custom Edge Visual Rules

| Condition | Stroke | Pattern |
|-----------|--------|---------|
| Normal | `#a1a1aa` (zinc-400) | Solid |
| Saturated (`isSaturated`) | `#F97316` (orange-500) | Solid |
| Async (`isSync=false`) | zinc-400 | Dashed (`8 4`) |
| Insecure (`!isSecure && requiresTLS`) | `#EF4444` (red-500) | Dashed (`6 4`) |
| Animated (`isAnimated`) | Inherited | Dashed (`8 4`) + moving circle via `<animateMotion>` |
| Selected | Inherited | Width 3 instead of 2 |
| Hovered | + tooltip | SVG rect + text showing `Protocol | Traffic% | Throughput RPS` |

Edge path: Smooth bezier via `getBezierPath()` from `@reactflow/core`.

### Canvas State Shape (updated)

When saving, each edge now includes routing data:

```json
{
  "nodes": [
    {
      "id": "web-browser",
      "type": "default",
      "position": { "x": 250, "y": 0 },
      "data": {
        "nodeType": "WebBrowser",
        "label": "Web Browser",
        "config": { "instances": 0, "region": "us-east-1", "maxRPS": 3000, ... },
        "simulationState": { "status": "healthy", "uptimeSeconds": 0, ... },
        "metrics": { "currentRPS": 0, "cpuPercent": 0, ... }
      }
    }
  ],
  "edges": [
    {
      "id": "e-lb-app",
      "source": "lb", "target": "app",
      "type": "default",
      "data": {
        "routing": { "protocol": "HTTP", "isSync": true, "trafficPercent": 80, "requiresTLS": false },
        "throughputRPS": 0, "latencyMs": 0, "isAnimated": true, "isSaturated": false, "isSecure": true
      }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### React Flow Type Mapping

`getReactFlowType(nodeType)` helper maps `NodeType` to React Flow registered component:

| NodeType | React Flow `type` | Component |
|----------|-------------------|-----------|
| `PostgreSQLDB`, `MySQLDB`, `MongoDB`, `Redis`, `Elasticsearch` | `"database"` | DatabaseNode |
| `LoadBalancer` | `"loadBalancer"` | LoadBalancerNode |
| `MessageQueue` | `"messageQueue"` | MessageQueueNode |
| `ContainerCluster` | `"containerCluster"` | ContainerClusterNode |
| All others | `"default"` | BaseNode |

## Status

**Phase 3.2 — Custom React Flow node components and edges complete**

### Verification: PASSED — 2026-05-16

| Check | Status |
|-------|--------|
| `BaseNode.tsx` — Handles on all 4 sides (appear on hover) | ✅ |
| `BaseNode.tsx` — Color-coded border from NODE_REGISTRY | ✅ |
| `BaseNode.tsx` — Selected state: blue glow (`box-shadow` + thicker border) | ✅ |
| `BaseNode.tsx` — isFailed: ❌ overlay + red pulsing border + `bg-red-500/10` | ✅ |
| `BaseNode.tsx` — isBottleneck: ⚠️ warning text | ✅ |
| `BaseNode.tsx` — Canary badge (purple "v2" pill, conditional on `isCanaryActive`) | ✅ |
| `BaseNode.tsx` — Public facing: 🌐 badge in header | ✅ |
| `BaseNode.tsx` — Metrics bar: CPU bar, MEM bar, RPS text (only when `metrics` exists) | ✅ |
| `BaseNode.tsx` — Framer-motion mount animation (scale + opacity) | ✅ |
| `BaseNode.tsx` — Fallback for unknown nodeType (red "Unknown" box) | ✅ |
| `DatabaseNode.tsx` — Cylinder/drum CSS (border half-ellipse + gradient) | ✅ |
| `LoadBalancerNode.tsx` — SVG 3-line traffic split visual | ✅ |
| `MessageQueueNode.tsx` — Queue depth fill bar (cyan/orange/red) + count label | ✅ |
| `ContainerClusterNode.tsx` — 3×3 pod grid, green=healthy gray=unhealthy | ✅ |
| `CustomEdge.tsx` — Smooth bezier path via `getBezierPath()` | ✅ |
| `CustomEdge.tsx` — Normal: zinc-400 solid, Saturated: orange solid | ✅ |
| `CustomEdge.tsx` — Async: dashed stroke (`8 4`), Sync: solid | ✅ |
| `CustomEdge.tsx` — Insecure TLS mismatch: red dashed (`6 4`) | ✅ |
| `CustomEdge.tsx` — Animated: `circle` + `animateMotion` along path | ✅ |
| `CustomEdge.tsx` — Hover tooltip: SVG rect+text with protocol/traffic%/throughput | ✅ |
| `nodeTypes.ts` — `nodeTypes` map (default/database/loadBalancer/messageQueue/containerCluster) | ✅ |
| `nodeTypes.ts` — `edgeTypes` map (default = CustomEdge) | ✅ |
| `nodeTypes.ts` — `getReactFlowType()` maps 7 data node types → "database", LB → "loadBalancer", MQ → "messageQueue", CC → "containerCluster", rest → "default" | ✅ |
| `ProjectPage.tsx` — `nodeTypes`/`edgeTypes` passed to `<ReactFlow>` | ✅ |
| `ProjectPage.tsx` — `enrichNode()` maps `data.nodeType` to correct React Flow type on load | ✅ |
| `ProjectPage.tsx` — `onConnect` creates edges with default routing data | ✅ |
| `index.css` — `@keyframes edge-dash` for animated edge stroke, `@keyframes pulse-red` | ✅ |
| `canvas.ts` — `CanvasNode`/`CanvasEdge` changed to `type = Node<...>` (TS 6.0 compat) | ✅ |
| `nodeRegistry.ts` — Override helpers accept `security` field | ✅ |
| Backend build: `go build ./...` | ✅ |
| Frontend build: `npm run build` (663 modules, 587KB JS) | ✅ |

### Re-Verification: PASSED — 2026-05-16

| Check | Status |
|-------|--------|
| HANDOFF.md structure — no duplicate Status sections (old Phase 3.1 status removed) | ✅ |
| `BaseNode.tsx` — Handles (4 sides, hover reveal), icon+label header, colored dot+badge row, children slot | ✅ |
| `BaseNode.tsx` — Selected glow, failed overlay+pulse, bottleneck warning, canary badge, public badge | ✅ |
| `BaseNode.tsx` — MiniBar CPU/MEM bars, RPS text, framer-motion animation, unknown fallback | ✅ |
| `DatabaseNode.tsx` — Cylinder CSS (rounded-t-full + gradient), renders via children slot | ✅ |
| `LoadBalancerNode.tsx` — SVG 3-line traffic split from center circle, renders via children slot | ✅ |
| `MessageQueueNode.tsx` — Queue fill bar (cyan/orange/red), depth label, renders via children slot | ✅ |
| `ContainerClusterNode.tsx` — 3×3 pod grid (green=healthy, gray=unhealthy), renders via children slot | ✅ |
| `CustomEdge.tsx` — Bezier path via `getBezierPath()`, default zinc-400, saturated orange | ✅ |
| `CustomEdge.tsx` — Async dashed (8 4), TLS violation red dashed (6 4), animated circle+animateMotion | ✅ |
| `CustomEdge.tsx` — Hover tooltip (rect+text) with protocol/traffic%/throughput | ✅ |
| `nodeTypes.ts` — Registers 5 node types + 1 edge type, `getReactFlowType()` maps all 25 NodeTypes | ✅ |
| `ProjectPage.tsx` — `nodeTypes`/`edgeTypes` wired to `<ReactFlow>`, `enrichNode()` for type mapping | ✅ |
| `ProjectPage.tsx` — `onConnect` creates edges with default routing data | ✅ |
| `ProjectPage.tsx` — 3-panel layout (TopToolbar + NodePanel + ReactFlow + ConfigPanel) | ✅ |
| `ProjectPage.tsx` — Undo/redo with Ctrl+Z / Ctrl+Shift+Z, store-backed max 50 states | ✅ |
| `ProjectPage.tsx` — Auto-save with 30s debounce, save indicator (Saved ✓ / Saving... / Unsaved changes) | ✅ |
| `ProjectPage.tsx` — Drag-and-drop from NodePanel via `dataTransfer` | ✅ |
| `ProjectPage.tsx` — `isValidConnection` prevents self-connections | ✅ |
| `ProjectPage.tsx` — Delete nodes/edges via Delete/Backspace key with callback | ✅ |
| `ProjectPage.tsx` — Canvas data loaded from `projectStore.canvas_data` on mount | ✅ |
| `ConfigPanel.tsx` — Node config editor with all fields, type-safe NODE_REGISTRY access | ✅ |
| `canvasStore.ts` — `futureStates` unused variable removed in `pushUndoState` | ✅ |
| `index.css` — `@keyframes edge-dash` and `@keyframes pulse-red` | ✅ |
| Backend build: `go build ./...` | ✅ |
| Frontend build: `npm run build` (tsc -b + vite build, 663 modules, 595KB JS) | ✅ |

### Fixes Applied During Build
| Issue | Fix |
|-------|-----|
| `ConfigPanel.tsx` — `onUpdateMetrics` prop declared but never used (unused var TS error) | Removed unused prop from NodeConfigEditor signature |
| `ConfigPanel.tsx:52` — Implicit `any` type when indexing NODE_REGISTRY with unchecked `nodeType` | Cast to `NodeType` and use null check before indexing |
| `ProjectPage.tsx` — `addEdge` imported from reactflow but unused (uses store version) | Removed unused import |
| `ProjectPage.tsx` — `DEFAULT_CONFIG`, `selectedNodeId`, `selectedEdgeId`, `isSimulationRunning` declared but unused | Removed unused declarations/destructured vars |
| `ProjectPage.tsx` — `Connection` type missing required `id` in `onConnect` Edge creation | Construct `Edge` with explicit `id`, `source`, `target` fields |
| `canvasStore.ts:134` — `futureStates` destructured but never read in `pushUndoState` | Removed from destructuring |

## Phase 3.4 — Node Panel Search, Templates & Drag-Drop

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/sidebar/NodePanel.tsx` | Complete rewrite: search input, Nodes/Templates tab bar, 4 predefined architecture templates, exported `templates` and `TemplateDef` types |
| `frontend/src/store/canvasStore.ts` | Added `loadTemplate(templateNodes, templateEdges)` action — atomically adds multiple nodes+edges with single undo state |
| `frontend/src/pages/ProjectPage.tsx` | Added `handleApplyTemplate` callback with viewport-centric positioning, passed `onApplyTemplate` prop to NodePanel |

### NodePanel Layout

```
aside.w-60 (bg-surface-950, border-r)
├── Tab bar
│   ├── "Nodes" (default active, green bottom border)
│   └── "Templates" (green bottom border when active)
│
├── [Nodes tab]
│   ├── Search input (filters node list in real-time)
│   │   └── "No nodes match your search" empty state
│   └── Categorized section list (6 categories)
│       └── Node items: icon + label + color accent bar
│           └── HTML5 drag: sets "application/node-type" in dataTransfer
│
└── [Templates tab]
    └── 4 template cards (bg-surface-900 border, hover:border-surface-700)
        ├── Icon + name + description + "N nodes · M edges" badge
        └── "Apply Template" button → calls onApplyTemplate
```

### Template Definitions

Each template has `id`, `name`, `description`, `icon`, `nodeCount`, `edgeCount`, and a `build(origin)` function that returns `{ nodes, edges }` with pre-arranged relative positions.

| Template | Icon | Nodes | Edges | Layout |
|----------|------|-------|-------|--------|
| **Simple Web App** | 🌐 | 4 | 3 | WebBrowser → LB → AppServer → PostgreSQL (280px spacing) |
| **Microservices** | 🧩 | 6 | 6 | APIGateway → 3 Microservices (staggered) → Redis + PostgreSQL |
| **Event-Driven** | 📨 | 4 | 3 | WebServer → MessageQueue (async) → WorkerService → MongoDB |
| **Blue/Green Deployment** | 🔄 | 4 | 4 | LB → AppServer-v1 (80%) + AppServer-v2 (20%) → PostgreSQL |

### Drag-Drop Mechanism

1. **NodePanel** `onDragStart`: sets `event.dataTransfer.setData("application/node-type", nodeType)`
2. **ProjectPage** `onDrop`: reads `getData("application/node-type")`, calls `reactFlowInstance.screenToFlowPosition()`, creates Node with defaults from `NODE_REGISTRY`, calls `canvasStore.addNode()`
3. **ProjectPage** `onDragOver`: `event.preventDefault()` with `dropEffect = "move"`
4. Both push undo state via `pushUndoState()` before mutation

### Template Application

1. User clicks "Apply Template" in NodePanel
2. `NodePanel` calls `tpl.build({ x: 0, y: 0 })` to get raw nodes/edges
3. `ProjectPage.handleApplyTemplate` calculates viewport center:
   - `cx = (wrapperWidth / 2 - viewport.x) / viewport.zoom`
   - `cy = (wrapperHeight / 2 - viewport.y) / viewport.zoom`
   - Offsets all node positions by `(cx - 380, cy - 100)` to roughly center the template
4. Calls `canvasStore.loadTemplate(movedNodes, edges)` — atomic add with single undo state

### `canvasStore.loadTemplate()`

```
loadTemplate(templateNodes, templateEdges):
  1. Clone current state (pushUndo internally via clone)
  2. Append all templateNodes to nodes array
  3. Append all templateEdges to edges array
  4. Set isDirty, clear futureStates
  (single atom state update, one undo entry)
```

## Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| HANDOFF.md reflects current Phase 3.4 status with all files, decisions, fixes | ✅ |
| `frontend/src/components/sidebar/NodePanel.tsx` — Search input, Nodes/Templates tab bar, draggable node items | ✅ |
| `frontend/src/components/sidebar/NodePanel.tsx` — 4 templates (Simple Web App, Microservices, Event-Driven, Blue/Green) with build(origin) functions | ✅ |
| `frontend/src/components/sidebar/NodePanel.tsx` — Templates exported as `templates` + `TemplateDef` type | ✅ |
| `frontend/src/components/sidebar/NodePanel.tsx` — Empty search state, color accent bars on nodes | ✅ |
| `frontend/src/store/canvasStore.ts` — `loadTemplate` action: appends nodes+edges atomically, single undo state | ✅ |
| `frontend/src/pages/ProjectPage.tsx` — `handleApplyTemplate` callback with viewport-centering offset | ✅ |
| `frontend/src/pages/ProjectPage.tsx` — `onApplyTemplate` prop wired to `<NodePanel>` | ✅ |
| Drag-drop: `dataTransfer` sets `application/node-type`, `onDrop` reads + `screenToFlowPosition` + `addNode` | ✅ |
| Template nodes use `makeNode()` helper with NODE_REGISTRY defaults + optional config overrides | ✅ |
| Template edges use `makeEdge()` helper with HTTP/async routing defaults + overrides | ✅ |
| Blue/Green template: 80/20 traffic split on edges, canary deployment config on v2 | ✅ |
| `go build ./...` — Backend compiles clean | ✅ |
| `go vet ./...` — Backend vet passes | ✅ |
| `npm run build` (tsc -b + vite build) — Frontend compiles clean, 666 modules | ✅ |
| `go build ./...` — Backend compiles clean | ✅ |
| `go vet ./...` — Backend vet passes | ✅ |

### Re-Verification: PASSED with Fixes — 2026-05-16

| Fix | Detail |
|-----|--------|
| Color accent bar moved to **left** side of node items | Changed from `ml-auto` right-positioned dot to `border-l-2`-style vertical bar as first child, using `backgroundColor: meta.color` |
| Template nodes use `getReactFlowType()` | `makeNode()` now calls `getReactFlowType(nodeType)` instead of hardcoding `"default"` — so PostgreSQL/MongoDB/Redis nodes render as `database`, LB as `loadBalancer`, MQ as `messageQueue`, etc. |
| Imports updated | `NodePanel.tsx` now imports `getReactFlowType` from `../canvas/nodeTypes` |

**Build results**: `npm run build` ✅, `go build ./...` ✅, `go vet ./...` ✅ — zero errors.

## Phase 3.5 — Advanced Config Panel

### Files Created / Modified

| File | Change |
|------|--------|
| `frontend/src/components/panels/NodeConfigPanel.tsx` | **New** — comprehensive config panel with 6 node sections + edge config, framer-motion slide-in animation |
| `frontend/src/store/canvasStore.ts` | Added `updateEdge(id, data)` and `updateNodeData(id, data)` actions with undo push |
| `frontend/src/pages/ProjectPage.tsx` | Switched import from `ConfigPanel` to `NodeConfigPanel` |
| `frontend/src/components/panels/ConfigPanel.tsx` | **Removed** — replaced by NodeConfigPanel |

### Panel Layout

```
aside.w-80 (fixed, slide animation via AnimatePresence + motion.div)
├── [Empty state] — "Select a node or edge to configure" (fade in)
│
├── [Node selected] — NodeConfigContent (slide-in from right)
│   ├── Section 1: Identity
│   │   ├── Label (text input → updateNodeData)
│   │   ├── Type badge (colored pill from NODE_REGISTRY)
│   │   └── Region (dropdown: 7 AWS regions)
│   │
│   ├── Section 2: Capacity
│   │   ├── Instances (number input, 1-100)
│   │   ├── Max RPS (number input)
│   │   └── Avg Latency (number input + visual bar up to 500ms)
│   │
│   ├── Section 3: Reliability
│   │   ├── Error Rate (slider 0-100%, stored as 0.0-1.0)
│   │   ├── Failed (toggle → cfg.isFailed)
│   │   └── Bottleneck (toggle → cfg.isBottleneck)
│   │
│   ├── Section 4: Deployment Strategy
│   │   ├── Strategy (select: Rolling / Blue-Green / Canary)
│   │   ├── Canary Traffic (slider, only when Canary selected)
│   │   ├── Canary Version (text input, only when not Rolling)
│   │   └── Activate Canary (toggle → deployment.isCanaryActive)
│   │
│   ├── Section 5: Security
│   │   ├── Public Facing (toggle → security.isPublicFacing)
│   │   ├── Requires TLS (toggle → security.requiresTLS)
│   │   ├── VPC ID (text input → security.vpcId)
│   │   └── Allowed Inbound (multiselect from all other nodes)
│   │       └── Checkbox per node, toggles node ID in security.allowedInbound[]
│   │
│   └── Section 6: Live Metrics (only when simulation running)
│       ├── Current RPS, CPU%, Memory%, Queue Depth
│       ├── P99 Latency, Error Count
│       └── Canary RPS (conditional on isCanaryActive)
│
└── [Edge selected] — EdgeConfigContent (slide-in from right)
    ├── Connection header: srcLabel → tgtLabel
    ├── Protocol (select: HTTP, gRPC, TCP, WebSocket, AMQP)
    ├── Synchronous (toggle → routing.isSync)
    ├── Requires TLS (toggle → routing.requiresTLS)
    ├── Traffic % (slider 0-100 → routing.trafficPercent)
    └── Stats section
        ├── Throughput (read-only)
        ├── Latency (read-only)
        ├── Animated (toggle → isAnimated)
        ├── Saturated (toggle → isSaturated, orange accent)
        └── Secure (toggle → isSecure)
```

### Store Actions Added

| Action | Signature | Behavior |
|--------|-----------|----------|
| `updateNodeData` | `(id, data)` | Merges `data` into `node.data` (for top-level fields like `label`), pushes undo |
| `updateEdge` | `(id, data)` | Merges `data` into `edge.data` with deep merge on `routing` sub-object, pushes undo |

### Design Decisions

- **All changes push to undo stack**: Every slider move, toggle click, or text input immediately calls `updateNodeConfig`/`updateNodeData`/`updateEdge` which internally push an undo state. This keeps undo granular per-field.
- **Framer-motion AnimatePresence**: Content switches between empty state, node config, and edge config with `mode="wait"` and slide-in from right (20px offset + opacity).
- **Reusable form controls**: `Field`, `Toggle`, `SliderField`, `Select`, `NumInput`, `TextInput` are defined as inline helper components to reduce repetition while keeping full type safety.
- **Error Rate storage**: Stored as 0.0–1.0 in `NodeConfig.errorRate`, displayed as 0–100% in the slider for usability.
- **Allowed Inbound multiselect**: Filters out the selected node itself, shows all other canvas nodes with their icon and label, toggles their IDs in `security.allowedInbound[]`.
- **Live Metrics section**: Conditionally rendered only when `isSimulationRunning` is true, reads from `node.data.metrics`.

## Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| Panel width 280px (`w-80`), border-l, surface-950 | ✅ |
| Framer-motion AnimatePresence slide-in from right | ✅ |
| Empty state: "Select a node or edge to configure" | ✅ |
| Section 1 — Identity: label, type badge, region dropdown | ✅ |
| Section 2 — Capacity: instances, max RPS, avg latency | ✅ |
| Section 3 — Reliability: error rate slider, failed/bottleneck toggles | ✅ |
| Section 4 — Deployment Strategy: strategy dropdown, canary traffic slider, canary version, activate toggle | ✅ |
| Section 5 — Security: public/TLS toggles, VPC ID input, allowed inbound multiselect | ✅ |
| Section 6 — Live Metrics: 6 stat fields + canary RPS toggle | ✅ |
| Edge config: protocol, sync/async toggle, TLS toggle, traffic % slider, stats (throughput, latency, animated, saturated, secure) | ✅ |
| `updateNodeData` action for label editing | ✅ |
| `updateEdge` action with routing deep merge | ✅ |
| All changes push to undo stack | ✅ |
| `npm run build` — 0 errors | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |

### Re-Verification: PASSED — 2026-05-16

Re-verified all Phase 3.5 items. No issues found.

| Check | Result |
|-------|--------|
| `NodeConfigPanel.tsx` — 438 lines, all 6 sections + edge config implemented | ✅ |
| Section 1 — Identity: editable label, type badge, 7-region dropdown | ✅ |
| Section 2 — Capacity: instances (1-100), max RPS, avg latency + visual bar | ✅ |
| Section 3 — Reliability: error rate slider (0-100%), failed + bottleneck toggles | ✅ |
| Section 4 — Deployment: rolling/blue-green/canary selector, canary traffic slider, canary version, activate toggle | ✅ |
| Section 5 — Security: public/TLS toggles, VPC ID input, allowed inbound multiselect | ✅ |
| Section 6 — Live Metrics: 6 fields + canary RPS, conditionally rendered | ✅ |
| Edge config: protocol selector, sync/async, TLS, traffic % slider, 5 stats toggles | ✅ |
| `updateNodeData(id, data)` — merges into `node.data`, pushes undo | ✅ |
| `updateEdge(id, data)` — merges into `edge.data` with routing deep merge, pushes undo | ✅ |
| Framer-motion `AnimatePresence` slide-in animation between states | ✅ |
| `ConfigPanel.tsx` deleted (superseded, no remaining imports) | ✅ |
| `npm run build` — 666 modules, 610KB JS, 0 errors | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |

## Next Step

Phase 3.3: Implement WebSocket real-time collaboration — sync canvas state (nodes, edges) across multiple users via WebSocket, with Yjs or Socket.IO integration.
