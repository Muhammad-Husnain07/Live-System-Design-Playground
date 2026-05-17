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

## Phase 3.6 — Top Toolbar

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/components/toolbar/TopToolbar.tsx` | Full-width top toolbar with project name, simulation controls, export, and user dropdown |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ProjectPage.tsx` | Replaced inline `<header>` with `<TopToolbar projectId={projectId} saving={saving} />`; removed `saveIndicator` variable and unused destructured fields |

### Toolbar Layout

```
header.h-[52px] (flex items-center, surface-950, border-b surface-800)
├── Left section (flex, gap-3)
│   ├── ← (Back to Dashboard)
│   ├── Project name (inline editable: click → input, Enter/blur → save, Escape → cancel)
│   ├── Role badge (owner/editor/viewer pill)
│   └── Save status (Saving... / Unsaved changes / Saved)
│
├── Center section (flex-1, justify-center, gap-2)
│   ├── ↩ (Undo, disabled when pastStates empty)
│   ├── ↪ (Redo, disabled when futureStates empty)
│   ├── │ separator
│   ├── ▶ Run / ■ Stop (green/red accent)
│   ├── Speed selector (1x / 2x / 5x)
│   └── Timer (mm:ss, visible only while running)
│
└── Right section (flex, gap-2)
    ├── 👥 Collaborators
    ├── Share button
    ├── Export ▾ dropdown (click-away-to-close)
    │   ├── 📷 Export as PNG
    │   └── 📄 Export as JSON
    ├── │ separator
    ├── 📊 Observability → /project/:id/observe
    └── User dropdown (click-away-to-close)
        ├── Avatar (first letter) + username
        ├── email
        ├── Settings → /settings
        └── Sign Out → logout + redirect /login
```

### Store Integration

| Store | Fields Used |
|-------|-------------|
| `useCanvasStore` | `isDirty`, `lastSaved`, `pastStates`, `futureStates`, `undo`, `redo`, `isSimulationRunning`, `simulationSpeed`, `setSimulationRunning`, `setSimulationSpeed` |
| `useProjectStore` | `currentProject` (name, role), `updateProject(projectId, { name })` |
| `useAuthStore` | `user` (username, email), `logout` |

### Props

| Prop | Type | Description |
|------|------|-------------|
| `projectId` | `string` | Current project UUID (passed from ProjectPage) |
| `saving` | `boolean` | Whether an auto-save request is in-flight |

### Design Decisions

- **Inline name editing**: Click the project name to turn it into an `<input>`; Enter or blur commits via `updateProject(id, { name })`; Escape discards changes. Stale-closure-safe via `useCallback`.
- **Simulation timer**: Local `useState` + `useEffect` with `setInterval(1000)` while simulation runs. Resets to `0` on every start.
- **Save indicator**: Derived from `saving` prop (yellow "Saving..."), `isDirty` (orange "Unsaved changes"), or `lastSaved` (green "Saved").
- **Export dropdown**: Uses `useRef` + `mousedown` document listener for click-away-to-close. Export actions are placeholders (no side effects yet).
- **User dropdown**: Same pattern as export dropdown with click-away-to-close. Shows avatar circle, username, email divider, then Settings/Sign Out actions.
- **Undo/Redo**: Buttons match the previous inline header behavior; `disabled` when respective stack is empty.
- **Observability button**: Navigates to `/project/:id/observe` (existing route).

## Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `TopToolbar.tsx` — Left: back button, inline-editable name, role badge, save status | ✅ |
| `TopToolbar.tsx` — Center: undo/redo, run/stop toggle, speed selector (1x/2x/5x), simulation timer | ✅ |
| `TopToolbar.tsx` — Right: collaborators, share, export dropdown, observability, user dropdown | ✅ |
| `TopToolbar.tsx` — Props: `projectId`, `saving` passed from `ProjectPage` | ✅ |
| `TopToolbar.tsx` — Inline name edit: click → input, Enter/blur → save, Escape → cancel | ✅ |
| `TopToolbar.tsx` — Timer: resets on start, setInterval(1000), format mm:ss | ✅ |
| `TopToolbar.tsx` — Export dropdown: click-away-to-close, PNG/JSON placeholder options | ✅ |
| `TopToolbar.tsx` — User dropdown: click-away-to-close, avatar, settings, sign out | ✅ |
| `TopToolbar.tsx` — Undo/Redo disabled state from pastStates/futureStates length | ✅ |
| `ProjectPage.tsx` — Inline `<header>` replaced with `<TopToolbar>` | ✅ |
| `ProjectPage.tsx` — Removed `saveIndicator`, unused `pastStates`/`futureStates`/`isDirty`/`lastSaved` destructuring | ✅ |
| `npm run build` (tsc -b + vite build) — 667 modules, 615KB JS, 0 errors | ✅ |

### Re-Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `TopToolbar.tsx` exists at `frontend/src/components/toolbar/TopToolbar.tsx` with default export | ✅ |
| Props: `projectId: string`, `saving: boolean` | ✅ |
| Left: back button (← → /dashboard) + inline-editable name + role badge + save status | ✅ |
| Center: undo/redo + run/stop toggle + speed selector (1x/2x/5x) + timer (mm:ss) | ✅ |
| Right: collaborators + share + export dropdown (PNG/JSON) + observability + user dropdown (avatar/settings/logout) | ✅ |
| Stores used: `useCanvasStore` (isDirty, lastSaved, pastStates, futureStates, undo, redo, isSimulationRunning, simulationSpeed, setSimulationRunning, setSimulationSpeed) | ✅ |
| Stores used: `useProjectStore` (currentProject, updateProject) | ✅ |
| Stores used: `useAuthStore` (user, logout) | ✅ |
| Inline name edit: click → input, Enter/blur → save via updateProject, Escape → cancel | ✅ |
| Timer: resets on start, setInterval(1000), mm:ss format | ✅ |
| Export dropdown: click-away-to-close, 2 placeholder options | ✅ |
| User dropdown: click-away-to-close, avatar circle, email divider, settings + sign out | ✅ |
| Undo/Redo disabled when respective stack empty | ✅ |
| `ProjectPage.tsx`: inline `<header>` replaced with `<TopToolbar projectId={projectId} saving={saving} />` | ✅ |
| `ProjectPage.tsx`: removed unused `saveIndicator`, `pastStates`, `futureStates`, `isDirty`, `lastSaved` | ✅ |
| `npm run build` (tsc -b + vite build) — 667 modules, 615KB JS, 0 errors | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |

## Phase 4.1 — Advanced Simulation Engine

### Files Created

| File | Purpose |
|------|---------|
| `backend/simulation/models.go` | All simulation data types: `Config`, `Node`, `Edge`, `Tick`, `NodeMetricsSnapshot`, `DeploymentConfig`, `SecurityConfig`, `NodeType` constants with `IsAsyncNodeType()` helper |
| `backend/simulation/propagator.go` | Topological sort (Kahn's algorithm), cycle detection (DFS with temporary marks), cycle breaking at async boundaries, traffic propagation across sync/async paths, deployment strategy splits |
| `backend/simulation/traffic.go` | `LoadGenerator` with 3 traffic patterns (Steady, RampUp, Spike) and ±15% uniform noise |
| `backend/simulation/metrics.go` | `SnapshotTick()` — builds `Tick` struct with per-node metrics snapshots and global aggregates (TotalRPS, GlobalErrorRate, ActiveRequests); `mathRound()` helper |
| `backend/simulation/engine.go` | `Engine` struct with concurrent tick loop: `Start()`, `Stop()`, `RunTick()`, `OnTick()` callback, `Ticks()` history accessor |

### Architecture

```
Engine (goroutine tick loop)
  ├── Start() → launches runLoop() goroutine
  ├── Stop()  → sets running=false, loop exits on next tick
  ├── RunTick()
  │   ├── LoadGenerator.RPSAtTick() → base RPS for this tick
  │   ├── PropagationContext.PropagateTick(rps) → process all nodes
  │   └── SnapshotTick() → collect metrics
  └── OnTick() callback (optional, for real-time streaming)

PropagationContext
  ├── TopologicalSort() → Kahn's algorithm
  ├── BreakCycles() → find async boundaries in cycles
  └── PropagateTick() → per-tick request lifecycle

LoadGenerator
  ├── Steady → baseRPS + noise
  ├── RampUp → 30% → 100% over duration + noise
  └── Spike → 2x-5x bursts every N ticks + noise
```

### Topological Sort with Cycle Detection

The propagator uses **Kahn's algorithm** to compute a topological ordering of the node graph:

1. Compute in-degree for every node by counting incoming edges
2. Enqueue nodes with in-degree 0 (these become **entry nodes**)
3. Dequeue a node, append to `order`, decrement in-degree for each successor
4. If a successor's in-degree reaches 0, enqueue it
5. After processing, any node not in `order` belongs to a **cycle**

**Cycle detection** uses DFS with a temporary mark stack (`inStack` map):
- Traverse unprocessed nodes
- Mark `visited` when first seen, `inStack` when on current DFS path
- If we encounter a node already in `inStack`, we've found a cycle — trace back through the path to extract the cycle members

### Cycle Breaking at Async Boundaries

Cycles are broken at **async boundary nodes** (MessageQueue, EventBus, PubSub):

1. For each detected cycle, scan for the first async node type
2. If found, that node is designated the **break node** — its incoming traffic is processed but its outgoing traffic is **deferred one tick** via `asyncDelayedIncoming`
3. If no async node exists in the cycle, the first node is treated as the break point (the cycle is still valid — traffic flows but downstream nodes appear one tick delayed)
4. This models real-world async boundaries: a queue receives messages in tick N, and consumers only dequeue starting in tick N+1

### Layer Grouping

| Layer | Definition | Use |
|-------|-----------|-----|
| **Entry** | `in-degree == 0` | BaseRPS is injected here |
| **Intermediate** | `in-degree > 0 && out-degree > 0` | Normal processing |
| **Exit** | `out-degree == 0` | Sink nodes (e.g. databases, external APIs) |

### Request Lifecycle per Tick

```
1. Generate base RPS (LoadGenerator.RPSAtTick())
2. Inject BaseRPS at each entry node
3. For each node in topological order:
   a. Sum incoming edge ThroughputRPS → node.IncomingRPS
   b. If node is failed → skip (set CurrentRPS=0)
   c. If async (MessageQueue/EventBus/PubSub):
      - QueueDepth += IncomingRPS * tickDurationSec
      - ServeRPS = min(QueueDepth, Instances * MaxRPS * tickDurationSec)
      - QueueDepth -= ServeRPS
      - CurrentRPS = ServeRPS
      - If break node for a cycle → defer outgoing to next tick
   d. If sync:
      - Capacity = Instances * MaxRPS
      - If IncomingRPS > Capacity: IsBottleneck=true, OverflowRPS=incoming-capacity, CurrentRPS=Capacity
      - Else: CurrentRPS = IncomingRPS
   e. Apply error rate: CurrentRPS -= CurrentRPS * ErrorRate
   f. Apply deployment strategy (canary split)
   g. Distribute CurrentRPS to outgoing edges by TrafficPercent
   h. Set Edge.ThroughputRPS and Edge.LatencyMs

4. Compute utilization metrics:
   - CPU%  = CurrentRPS / Capacity * 100
   - MEM%  = 50 + CPU% * 0.5 (base + load correlation)
   - P99   = linear regression on LatencyMs * load factors
```

### Sync vs Async Propagation

| Property | Sync Node | Async Node (Queue) |
|----------|-----------|-------------------|
| Incoming | Sum of all edge throughput | Added to QueueDepth |
| Capacity check | Immediate: `incoming > max × instances` | `serveRPS = min(queue, max × instances × tick)` |
| Bottleneck | When incoming exceeds capacity | When queue grows unbounded |
| Backpressure | OverflowRPS reported | QueueDepth grows |
| Timing | Same tick | Outgoing deferred one tick when cycle break |

### Deployment Strategy Splits

When `Deployment.IsCanaryActive == true` and `Deployment.Strategy == "canary"`:

1. **CanaryRPS** = `CurrentRPS * (CanaryPercent / 100)`
2. This split is tracked as a separate metric (`NodeMetricsSnapshot.CanaryRPS`) but doesn't physically split the node — both versions share capacity
3. In future phases, canary RPS could route to separate canary node instances

The `TrafficPercent` on each edge determines how a node's `CurrentRPS` is distributed:
- Edges from a node are normalized by total percent (if sum is 0, equal distribution assumed)
- Each edge gets `CurrentRPS * (TrafficPercent / totalPercent)` throughput

### Traffic Patterns

| Pattern | Behavior | Noise |
|---------|----------|-------|
| **Steady** | Constant `baseRPS` every tick | ±15% uniform |
| **RampUp** | Linear from 30% to 100% over duration | ±15% uniform |
| **Spike** | 2x-5x bursts every N/5 ticks (min 5 ticks between spikes) | ±15% uniform |

Noise is applied as `rps * (1.0 + uniform(-0.15, +0.15))` for realism.

### Engine Lifecycle

```
NewEngine(cfg) → creates PropagationContext + LoadGenerator

Start() → launches goroutine with time.Ticker
  │ Tick interval = cfg.TickRateMs / cfg.SpeedMultiplier
  │ Loop until tickNum >= totalTicks or Stop() called
  │
  └─ each tick → RunTick()
       ├── gen.RPSAtTick()
       ├── ctx.PropagateTick(rps)
       ├── SnapshotTick()
       └── onTick callback (if set)

Stop() → sets running=false, goroutine exits on next tick
Ticks() → returns copy of all recorded ticks
```

### Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `backend/simulation/models.go` — Config, Node, Edge, Tick, NodeMetricsSnapshot, 25 NodeType constants, IsAsyncNodeType() | ✅ |
| `backend/simulation/models.go` — DeploymentConfig (strategy, canaryPercent, canaryVersion, isCanaryActive), SecurityConfig, TrafficPattern | ✅ |
| `backend/simulation/propagator.go` — TopologicalSort with Kahn's algorithm, DFS cycle detection, BreakCycles at async boundaries | ✅ |
| `backend/simulation/propagator.go` — GroupIntoLayer (Entry/Intermediate/Exit), UtilizationMetrics (CPU/MEM/P99) | ✅ |
| `backend/simulation/propagator.go` — PropagateTick: sync capacity check, async queue depth, edge traffic distribution, error rate loss, canary split | ✅ |
| `backend/simulation/traffic.go` — LoadGenerator with Steady/RampUp/Spike patterns, ±15% noise | ✅ |
| `backend/simulation/metrics.go` — SnapshotTick builds NodeMetricsSnapshot per node + global totals | ✅ |
| `backend/simulation/engine.go` — Engine with Start/Stop/RunTick, goroutine tick loop, OnTick callback, Ticks() history | ✅ |
| `backend/simulation/engine.go` — respect DurationSeconds, TickRateMs, SpeedMultiplier for timing | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |

### Re-Verification: FIXED — 2026-05-16

**Fixes applied during re-verification:**

| # | Issue | Fix |
|---|-------|-----|
| 1 | Cycle-break nodes incorrectly skipped incoming edge throughput via `shouldDelayAsync` check, so their queue never accumulated traffic from cycle sources | Removed `shouldDelayAsync` guard from incoming edge summation. Break nodes now receive incoming RPS normally and accumulate queue depth. |
| 2 | Deferred output from cycle-break nodes used a local `asyncDelayedIncoming` map (cleared per-tick), so deferred RPS was lost rather than persisted to the next tick | Replaced local map with persistent `ctx.DeferredOutput map[string]float64` on `PropagationContext`. Applied at the start of the next `PropagateTick`. |
| 3 | BFS traversal skipped enqueuing successors of cycle-break nodes, causing downstream cycle nodes to be missed during BFS | Removed special-case `continue` for break nodes in BFS. All nodes are now traversed via BFS regardless of cycle-break status. |
| 4 | Break nodes still set `ThroughputRPS` on edges (same-tick delivery) while also writing to `asyncDelayedIncoming` | Break nodes now **only** write to `ctx.DeferredOutput` (per-target map) and do NOT set edge `ThroughputRPS`. Normal nodes still use edge throughput as before. |

**Corrected cycle-break behavior:**
```
Tick N:   A → B(MessageQueue) → [deferred to Tick N+1] → C → A
                           ↓
                   ctx.DeferredOutput["C"] += served

Tick N+1: Apply deferred["C"] → C.IncomingRPS
          C processes normally → sends to A
          A processes → sends to B
          B (break) defers output to C again → deferred["C"] for N+2
          (cycle continues with one tick of latency at the async boundary)
```

| Check | Result |
|-------|--------|
| `backend/simulation/models.go` — `Config` (ProjectID, Nodes, Edges, TargetRPS, DurationSeconds, SpeedMultiplier), `Node` (ID, NodeType, MaxRPS, LatencyMs, ErrorRate, Instances, IsFailed, DeploymentConfig, SecurityConfig), `Edge` (ID, Source, Target, IsSync, TrafficPercent, RequiresTLS), `Tick` (TickNumber, Timestamp, NodeMetrics, TotalRPS, GlobalErrorRate, ActiveRequests) | ✅ |
| `backend/simulation/models.go` — `NodeMetricsSnapshot` with all 18 fields, `DeploymentConfig`, `SecurityConfig`, 25 `NodeType` constants, `IsAsyncNodeType()` | ✅ |
| `backend/simulation/propagator.go` — `TopologicalSort()` Kahn's algorithm with in-degree queue, `findCycleDFS()` with temporary marks/inStack, `BreakCycles()` at async boundaries | ✅ |
| `backend/simulation/propagator.go` — `GroupIntoLayer()` entry/intermediate/exit, `PropagateTick()` with sync capacity check, async queue depth, traffic distribution, error rate loss, canary split | ✅ |
| `backend/simulation/propagator.go` — `UtilizationMetrics()` computing CPU%, MEM%, P99 latency from utilization factors | ✅ |
| `backend/simulation/propagator.go` — `DeferredOutput` map correctly persists break-node output across ticks; break nodes receive incoming edge throughput normally | ✅ FIXED |
| `backend/simulation/traffic.go` — `LoadGenerator` with Steady (constant), RampUp (30%→100% linear), Spike (2x-5x bursts every N/5 ticks), ±15% uniform noise | ✅ |
| `backend/simulation/metrics.go` — `SnapshotTick()` builds per-node `NodeMetricsSnapshot` slice + global totals (TotalRPS, GlobalErrorRate, ActiveRequests) | ✅ |
| `backend/simulation/engine.go` — `Engine` with `Start()` (goroutine tick loop), `Stop()` (running=false), `RunTick()` (load→propagate→snapshot), `OnTick()` callback, `Ticks()` history | ✅ |
| `backend/simulation/engine.go` — Respects `DurationSeconds`, `TickRateMs`, `SpeedMultiplier` for timing | ✅ |
| Backend: `go build ./...` — 0 errors | ✅ |
| Backend: `go vet ./...` — 0 errors | ✅ |
| Frontend: `npm run build` (tsc -b + vite build) — 667 modules, 0 errors (no regressions) | ✅ |

## Phase 4.2 — Simulation WebSocket Streaming

### Files Created

| File | Purpose |
|------|---------|
| `backend/ws/client.go` | WebSocket client: ticket auth, read/write pumps, ping/pong keepalive, gorilla-compatible fasthttp WebSocket |
| `backend/ws/hub.go` | Hub pattern: clients grouped by `projectID`, register/unregister/broadcast with `sync.RWMutex` |
| `backend/handlers/simulation.go` | REST endpoints: start/stop simulation, run history; WS upgrade handler; canvas-to-simulation type mapper |
| `backend/migrations/008_create_simulation_runs.sql` | `simulation_runs` table (id, project_id, user_id, config JSONB, timestamps, status) + `simulation_ticks` table (run_id, tick_number, data JSONB) |

### Files Modified

| File | Change |
|------|--------|
| `backend/main.go` | Added hub init, simulation routes (`POST /start`, `POST /:id/stop`, `GET /history/:projectId`), WS endpoint at `GET /ws/simulation?ticket=&projectId=` |
| `backend/go.mod` | Added `github.com/fasthttp/websocket@v1.5.8` for Fiber-native WebSocket upgrades |

### WS Ticket Authentication Flow

```
1. Frontend calls POST /api/auth/ws-ticket (JWT-protected)
   → Backend stores "ws_ticket:<uuid>" → user_id in Redis (60s TTL)
   → Returns ticket UUID

2. Frontend opens WebSocket: ws://host/ws/simulation?ticket=<uuid>&projectId=<id>

3. Backend WS handler:
   a. Reads ticket and projectId from query params
   b. Calls ValidateTicket() → Redis GET "ws_ticket:<ticket>"
   c. If found: retrieves user_id, DEL the key (one-time use)
   d. If not found: returns 401, connection rejected

4. On successful auth:
   a. Creates Client struct with conn, hub, projectID, userID
   b. Hub.Register(client) → adds to clients[projectID] set
   c. Starts WritePump goroutine (sends ticks + ping keepalive)
   d. Runs ReadPump (handles pong responses + incoming ping messages)
   e. On disconnect: ReadPump returns → Hub.Unregister(client) removes from set, closes send chan
```

### Hub Architecture

```
Hub (global singleton)
├── clients: map[projectID]map[*Client]bool
├── Register(client)     → Lock, add to map
├── Unregister(client)   → Lock, remove from map, close send chan
└── BroadcastToProject(projectID, tick)
      → RLock, marshal Tick to JSON
      → Iterate clients[projectID], non-blocking send on client.send chan
      → Buffer: 256 messages per client (drops oldest if full)

Client
├── send chan (256 buffer)
├── ReadPump()  → pong handling, incoming "ping" → "pong" response
├── WritePump() → reads from send chan, writes to WS, 54s ping interval
└── TicketAuth → Redis lookup, 5s timeout, one-time-use deletion
```

### REST Endpoints

#### `POST /api/simulations/start` (JWT-protected)

```
Request:
{
  "projectId": "uuid",
  "targetRPS": 2000,
  "durationSeconds": 60,
  "speedMultiplier": 2.0,
  "trafficPattern": "steady" | "ramp_up" | "spike"
}

Response 201:
{
  "simulationRunId": "uuid",
  "status": "running",
  "totalTicks": 600
}
```

**Flow:**
1. Parse request body (with defaults: targetRPS=1000, duration=60, speed=1, pattern=steady)
2. `services.GetProjectByID()` to fetch project + canvas_data
3. `parseCanvasToSimNodes()` converts canvas JSON → `[]simulation.Node` + `[]simulation.Edge`
   - Reads nodeType, instances, maxRPS, latencyMs, errorRate, isFailed, deployment, security from each canvas node
   - Reads trafficPercent, isSync, requiresTLS from each canvas edge
4. Builds `simulation.Config` with TickRateMs=100 (10 ticks/sim-second)
5. Creates `simulation.Engine` + sets `OnTick` callback that calls `Hub.BroadcastToProject()`
6. Stores run in `simulation_runs` DB table (status='running')
7. Returns run ID

#### `POST /api/simulations/:id/stop` (JWT-protected)

```
Response 200:
{ "status": "stopped" }

Response 404:
{ "error": "simulation run not found" }
```

Stops engine + updates DB `status='stopped'`, `stopped_at=now()`.

#### `GET /api/simulations/history/:projectId` (JWT-protected)

```
Response 200:
{
  "runs": [
    { "id": "uuid", "projectId": "uuid", "userId": "uuid",
      "config": "{...}", "status": "running|stopped",
      "startedAt": "...", "stoppedAt": "..." }
  ]
}
```

Returns last 50 runs for the project, ordered by `started_at DESC`.

#### `GET /ws/simulation?ticket=<uuid>&projectId=<uuid>` (Ticket-auth)

Upgrades to WebSocket. On connection:
- Client sends `{"type":"ping"}` → server responds `{"type":"pong"}`
- Server streams `{"type":"tick","tick":{...}}` every 100ms (configurable via TickRateMs)
- Client disconnect auto-cleans via ReadPump exit → Hub.Unregister

### Canvas-to-Simulation Type Mapping

| Canvas JSON field | Simulation Go type |
|-------------------|--------------------|
| `nodeType` (string) | `simulation.NodeType` (const) |
| `config.instances` (number) | `Node.Instances` (int) |
| `config.maxRPS` (number) | `Node.MaxRPS` (float64) |
| `config.latencyMs` (number) | `Node.LatencyMs` (float64) |
| `config.errorRate` (number 0-1) | `Node.ErrorRate` (float64) |
| `config.isFailed` (bool) | `Node.IsFailed` (bool) |
| `config.deployment.*` (object) | `Node.Deployment` (struct) |
| `config.security.*` (object) | `Node.Security` (struct) |
| `routing.trafficPercent` (number) | `Edge.TrafficPercent` (float64) |
| `routing.isSync` (bool) | `Edge.IsSync` (bool) |
| `routing.requiresTLS` (bool) | `Edge.RequiresTLS` (bool) |

### Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `github.com/fasthttp/websocket` | v1.5.8 | WebSocket server for fasthttp/Fiber — fork of gorilla/websocket with fasthttp-compatible `FastHTTPUpgrader` |
| `golang.org/x/net` | v0.21.0 | Required by fasthttp/websocket for proxy support |

### Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `backend/ws/client.go` — `Client` struct with conn/hub/projectID/userID/send chan | ✅ |
| `backend/ws/client.go` — `ReadPump()` with pong handler, ping/pong keepalive, close detection | ✅ |
| `backend/ws/client.go` — `WritePump()` with non-blocking send channel, ping timer (54s interval) | ✅ |
| `backend/ws/client.go` — `ValidateTicket()` Redis GET lookup, 5s timeout, one-time DEL | ✅ |
| `backend/ws/hub.go` — `Hub` with `map[projectID]map[*Client]bool`, `sync.RWMutex` | ✅ |
| `backend/ws/hub.go` — `Register()` / `Unregister()` with lock, close send chan on unregister | ✅ |
| `backend/ws/hub.go` — `BroadcastToProject()` marshal Tick to JSON, non-blocking per-client send | ✅ |
| `backend/ws/hub.go` — `ClientCount()` for monitoring | ✅ |
| `backend/handlers/simulation.go` — `POST /api/simulations/start`: parse request, fetch canvas, build Config, create Engine, set OnTick → Hub.BroadcastToProject, store run in DB | ✅ |
| `backend/handlers/simulation.go` — `POST /api/simulations/:id/stop`: find engine, stop, update DB status | ✅ |
| `backend/handlers/simulation.go` — `GET /api/simulations/history/:projectId`: last 50 runs, ordered by started_at DESC | ✅ |
| `backend/handlers/simulation.go` — `GET /ws/simulation?ticket=&projectId=`: ticket auth via `ValidateTicket()`, `FastHTTPUpgrader.Upgrade()` with fasthttp context | ✅ |
| `backend/handlers/simulation.go` — `parseCanvasToSimNodes()`: converts canvas_data JSON → simulation.Node/Edge with all fields (instances, maxRPS, latencyMs, errorRate, deployment, security, trafficPercent) | ✅ |
| `backend/handlers/simulation.go` — `storeRun()` / `storeTick()`: persist run and tick data to DB | ✅ |
| `backend/handlers/simulation.go` — `findEngineFromDB()`: reconstruct engine from stored config for stop-by-DB-fallback | ✅ |
| `backend/migrations/008_create_simulation_runs.sql` — `simulation_runs` table with id/project_id/user_id/config/status/timestamps + indexes on project_id, user_id, status | ✅ |
| `backend/migrations/008_create_simulation_runs.sql` — `simulation_ticks` table with id/run_id/tick_number/data JSONB + indexes on run_id and (run_id, tick_number) | ✅ |
| `backend/main.go` — Hub init, simulation routes wired, WS endpoint at `/ws/simulation` | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |

### Re-Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `backend/ws/client.go` — Client struct, ReadPump/WritePump, ValidateTicket (Redis GET+DEL, 5s timeout) | ✅ |
| `backend/ws/hub.go` — Hub with map[projectID]map[*Client]bool, sync.RWMutex, Register/Unregister/BroadcastToProject/ClientCount | ✅ |
| `backend/handlers/simulation.go` — POST /start (parse canvas→sim nodes, engine+OnTick broadcast, store run/ticks in DB) | ✅ |
| `backend/handlers/simulation.go` — POST /stop (engine stop + DB status update + findEngineFromDB fallback) | ✅ |
| `backend/handlers/simulation.go` — GET /history/:projectId (last 50 runs ordered by started_at DESC) | ✅ |
| `backend/handlers/simulation.go` — WS handler via FastHTTPUpgrader + ticket auth + hub register | ✅ |
| `backend/handlers/simulation.go` — parseCanvasToSimNodes() maps nodeType/instances/maxRPS/latencyMs/errorRate/isFailed/deployment/security + edge routing fields | ✅ |
| `backend/migrations/008_create_simulation_runs.sql` — simulation_runs + simulation_ticks tables with all indexes | ✅ |
| `backend/main.go` — hub init, simGroup routes (start/stop/history), `/ws/simulation` endpoint with ticket auth | ✅ |
| `backend/main.go` — Handles missing ticket/projectId (400), invalid ticket (401), upgrade failure (500) | ✅ |
| `backend/go.mod` — github.com/fasthttp/websocket@v1.5.8 added | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |
| `npm run build` (tsc -b + vite build, frontend/) — 667 modules, 615KB JS, 0 errors | ✅ |

## Phase 4.3 — Simulation Fully Integrated

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/store/simulationStore.ts` | Zustand store: `isRunning`, `ticks[]`, `latestTick`, `config` (targetRPS/duration/speed/pattern), `connectionStatus`, `elapsed`; actions: `setConfig`, `setRunning`, `setRunId`, `onTick`, `reset` |
| `frontend/src/hooks/useSimulation.ts` | React hook: WebSocket connection lifecycle (ticket auth via `/api/auth/ws-ticket`, auto-connect on `runId` set), ping keepalive (30s), `applyTickToCanvas` callback that dispatches tick data to canvasStore for live node/edge visual updates, `start()`/`stop()` API orchestration |
| `frontend/src/components/panels/SimulationPanel.tsx` | Right-side panel with config form (traffic pattern selector, target RPS slider 1–10000, duration input, speed selector) and live stats grid (Total RPS, Error Rate, Active Requests, Elapsed time) + per-node metrics list with bottleneck/failed/async markers |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/canvas/CustomEdge.tsx` | Sync vs async animation: sync uses `dur="0.8s"` + dash `"4 4"` (fast pulses); async uses `dur="3s"` + dash `"8 4"` (slow chunky pulses); sync circle r=3, async circle r=4 |
| `frontend/src/components/toolbar/TopToolbar.tsx` | New props: `onStart`, `onStop`, `showSimPanel`, `onToggleSimPanel`. Run/Stop buttons now call real `onStart()`/`onStop()` callbacks instead of toggling local state. Added "Sim" toggle button in right section. Removed unused `setSimRunning`. |
| `frontend/src/pages/ProjectPage.tsx` | Integrated `useSimulation(projectId)` hook; added `showSimPanel` local state; conditionally renders `SimulationPanel` or `NodeConfigPanel` on the right side; passes `onStart`/`onStop`/`showSimPanel`/`onToggleSimPanel` to `TopToolbar` |

### Data Flow

```
User clicks ▶ Run (TopToolbar or SimulationPanel)
  │
  ├─ useSimulation.start()
  │   ├─ POST /api/simulations/start → receives simulationRunId
  │   ├─ Sets runId in simulationStore
  │   ├─ Triggers useEffect([runId]) → connectWs()
  │   ├─ Starts elapsed timer (1s interval)
  │   └─ Sets canvasStore.isSimulationRunning = true
  │
  └─ connectWs()
      ├─ POST /api/auth/ws-ticket → receives WS ticket UUID
      ├─ Opens WebSocket: ws://host/ws/simulation?ticket=<uuid>&projectId=<id>
      ├─ onopen: starts ping interval (30s)
      ├─ onmessage: parses {"type":"tick","tick":{...}}
      │   └─ onTick() → appends to simulationStore.ticks[], sets latestTick
      │   └─ applyTickToCanvas(tick):
      │       ├─ nodeMetrics[].currentRPS/cpuPercent/etc → node.data.metrics
      │       ├─ nodeMetrics[].isBottleneck → node.data.config.isBottleneck
      │       ├─ nodeMetrics[].isFailed → node.data.config.isFailed
      │       ├─ Bottleneck nodes (isBottleneck || cpuPercent>80) → saturatedNodeIds set
      │       ├─ Edges from/to saturated nodes → edge.data.isSaturated = true (orange)
      │       ├─ Edges with throughput>0 → edge.data.isAnimated = true
      │       └─ useCanvasStore.setState({ nodes, edges }) — single batch update
      │
      └─ onclose or catch:
          ├─ If manualClose: cleanup, stop
          └─ If unexpected (isRunning still true):
              ├─ reconnectAttempt += 1
              ├─ delay = min(1000 × 2^attempt, 30000)  [1s, 2s, 4s, 8s, … 30s]
              └─ setTimeout → connectWsRef.current() (fetches new ticket, reopens WS)

User clicks ■ Stop
  │
  └─ useSimulation.stop()
      ├─ POST /api/simulations/:runId/stop
      ├─ closeWs() → closes WebSocket, clears ping timer
      ├─ Clears elapsed timer
      ├─ simulationStore.reset() → clears runId, ticks, latestTick
      └─ canvasStore.setSimulationRunning(false)
```

### WS Message Types

| Direction | Type | Payload | Frequency |
|-----------|------|---------|-----------|
| Server → Client | `tick` | `{"type":"tick","tick":{tickNumber,timestamp,nodeMetrics[],totalRPS,globalErrorRate,activeRequests}}` | Every 100ms × speedMultiplier |
| Client → Server | `ping` | `{"type":"ping"}` | Every 30s (keepalive) |
| Server → Client | `pong` | `{"type":"pong"}` | Response to ping |

### Canvas Live Update Rules

| Condition | Visual Effect |
|-----------|---------------|
| `snap.isBottleneck` + `snap.cpuPercent > 80` | Node gets orange bottleneck indicator (⚠️), outgoing edges turn orange (`isSaturated=true`) |
| `snap.isFailed` | Node shows red ❌ overlay, red pulsing border |
| Edge `throughputRPS > 0` | Edge animates: moving circle along bezier path |
| Sync edge (isSync=true) + animated | Fast pulses: `dur="0.8s"`, dash `"4 4"`, circle `r=3` |
| Async edge (isSync=false) + animated | Slow chunky pulses: `dur="3s"`, dash `"8 4"`, circle `r=4` |
| Source or target node is bottleneck | Edge turns orange (`isSaturated=true`, stroke `#F97316`) |

### SimulationPanel Layout

```
aside.w-80 (bg-surface-950, border-l surface-800)
├── Header: "Simulation" + ConnectionBadge (green/yellow/red dot)
│
├── [Idle state] — ConfigForm
│   ├── Traffic Pattern (select: Steady / Ramp Up / Spike)
│   ├── Target RPS (range slider 1–10000 + numeric label)
│   ├── Duration (number input, min 5, max 3600)
│   ├── Speed (select: 1x / 2x / 5x)
│   └── ▶ Start Simulation button (green accent)
│
└── [Running state] — LiveStats
    ├── 2×2 stat cards: Total RPS, Error Rate, Active Req, Elapsed
    ├── Per-node metrics list (max-height scrollable)
    │   └── Each row: icon (✗/⚠/↻) + label + "N RPS"
    └── ■ Stop Simulation button (red accent)
```

### simulationStore State Shape

```typescript
interface SimulationState {
  isRunning: boolean;
  ticks: TickData[];
  latestTick: TickData | null;
  config: { targetRPS, durationSeconds, speedMultiplier, trafficPattern };
  runId: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  elapsed: number;
}
```

### Build Results

- `go build ./...` — ✅ 0 errors
- `go vet ./...` — ✅ 0 errors
- `npm run build` (tsc -b + vite build) — ✅ 670 modules, 625KB JS, 0 errors

### Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `simulationStore.ts` — State shape (isRunning, ticks, latestTick, config, runId, connectionStatus, elapsed) + actions (setConfig, onTick, reset) | ✅ |
| `useSimulation.ts` — WS lifecycle: ticket auth, connect on runId, ping keepalive, auto-cleanup | ✅ |
| `useSimulation.ts` — `start()`: POST /simulations/start, set runId, elapsed timer, canvasStore.sync | ✅ |
| `useSimulation.ts` — `stop()`: POST /stop, close WS, clear timers, reset store, canvasStore.sync | ✅ |
| `useSimulation.ts` — `applyTickToCanvas()`: updates node metrics, bottleneck/failed flags, edge saturation/animation | ✅ |
| `SimulationPanel.tsx` — Config form: traffic pattern selector, RPS slider (1-10000), duration input, speed selector | ✅ |
| `SimulationPanel.tsx` — Live stats: Total RPS, Error Rate, Active Req, Elapsed (2×2 grid) | ✅ |
| `SimulationPanel.tsx` — Per-node metrics list with bottleneck/failed/async indicators | ✅ |
| `SimulationPanel.tsx` — Start/Stop buttons with proper accent colors | ✅ |
| `CustomEdge.tsx` — Sync animation: dur="0.8s", dash "4 4", r=3 | ✅ |
| `CustomEdge.tsx` — Async animation: dur="3s", dash "8 4", r=4 | ✅ |
| `TopToolbar.tsx` — onStart/onStop/onToggleSimPanel props, Run/Stop wired to real callbacks, "Sim" toggle button | ✅ |
| `ProjectPage.tsx` — useSimulation integrated, showSimPanel toggle, conditional SimulationPanel/NodeConfigPanel render | ✅ |
| `npm run build` — 670 modules, 625KB JS, 0 errors | ✅ |

### Re-Verification: FIXED — 2026-05-16

| Issue | Fix |
|-------|-----|
| `useSimulation.ts` — Missing auto-reconnect on WebSocket disconnect or fetch error | Added exponential backoff reconnection (`1s, 2s, 4s, 8s, …` up to 30s) via `reconnectAttemptRef`, `reconnectTimer`, and `connectWsRef` pattern to avoid circular dependency between `connectWs` and reconnect scheduling. `manualCloseRef` flag prevents reconnection loops on intentional `stop()`. Reconnection only fires when `isRunning` is still true. |

| Check | Result |
|-------|--------|
| `useSimulation.ts` — Auto-reconnect on WS onclose (exponential backoff, capped at 30s) | ✅ FIXED |
| `useSimulation.ts` — Auto-reconnect on WS ticket fetch failure (exponential backoff, capped at 30s) | ✅ FIXED |
| `useSimulation.ts` — `manualCloseRef` prevents reconnect loop on intentional `closeWs()` / `stop()` | ✅ FIXED |
| `useSimulation.ts` — Reconnect only fires when `isRunning` is still true (avoids orphaned reconnects) | ✅ FIXED |

## Phase 5.1 — Chaos Engine

### Files Created

| File | Purpose |
|------|---------|
| `backend/simulation/chaos.go` | `ChaosEventType` (8 types), `ChaosEvent` struct, `ChaosManager` with thread-safe event registry, `ApplyPreTick()` (applies chaos before traffic propagation), `ApplyPostTick()` (gradual effects like memory leak), per-event-type effect logic |
| `backend/handlers/chaos.go` | `ChaosHandler` with `Inject` (POST) and `Active` (GET) endpoints; validates event type, severity range, engine running state; calculates duration in ticks (10 ticks/sim-second) |

### Files Modified

| File | Change |
|------|--------|
| `backend/simulation/engine.go` | Added `RunID` field, `originalNodes []Node` (config copy for per-tick restoration), `SetChaosManager()`, `restoreNodes()` (resets `IsFailed`/`LatencyMs`/`ErrorRate`/`MaxRPS`/`Instances` to original before each tick). `RunTick()` calls `restoreNodes()` + `chaos.ApplyPreTick()` before `PropagateTick()`, and `chaos.ApplyPostTick()` after. |
| `backend/handlers/simulation.go` | `SimulationHandler` now holds `Chaos *simulation.ChaosManager`. `NewSimulationHandler()` takes a `*simulation.ChaosManager`. `Start()` sets `engine.RunID` and calls `engine.SetChaosManager()`. Added exported `FindEngine()` method for ChaosHandler. |
| `backend/main.go` | Imports `systemdesign/simulation`. Creates `chaosMgr` and passes to `NewSimulationHandler`. Wires `/api/chaos/inject` (POST) and `/api/chaos/active/:simulationRunId` (GET) with JWT auth. |

### Chaos Event Types (8)

| Type | Effect | Implementation |
|------|--------|---------------|
| `NodeFailure` | Target node goes down | Sets `IsFailed = true` — PropagateTick skips the node |
| `LatencySpike` | Latency multiplied | `LatencyMs *= (1 + severity × 9)` (up to 10× at severity 1.0) |
| `ErrorRateSpike` | Error rate spikes | Sets `ErrorRate = max(current, severity)` up to 1.0 |
| `NetworkPartition` | Node isolated | Sets `Instances = 0`, `MaxRPS = 0` — all incoming traffic dropped |
| `DDoS` | Node overwhelmed | Reduces `MaxRPS` by `severity × 90%`, reduces instances, raises `ErrorRate` |
| `RegionDown` | Entire region fails | Sets `IsFailed`, `MaxRPS = 0`, `Instances = 0` on all targeted nodes |
| `MemoryLeak` | Gradual degradation | Applied in PostTick: increases `MemoryPercent` and `CPUPercent` each tick; also raises `ErrorRate` and `LatencyMs` pre-tick |
| `CPUSaturation` | CPU pinned at 100% | Reduces `MaxRPS` by `severity × 95%`, sets `CPUPercent = 95` |

### API Endpoints

#### `POST /api/chaos/inject` (JWT-protected)

```
Request:
{
  "simulationRunId": "uuid",
  "nodeId": "node-1",
  "eventType": "NodeFailure",
  "severity": 0.8,
  "durationSeconds": 30
}

Response 201:
{
  "event": {
    "id": "uuid",
    "simulationRunId": "uuid",
    "nodeId": "node-1",
    "eventType": "NodeFailure",
    "severity": 0.8,
    "durationTicks": 300,
    "startedAt": 15,
    "active": true
  }
}

Response 400:
{ "error": "invalid eventType" | "severity must be between 0 and 1" | ... }

Response 404:
{ "error": "simulation run not found" }
```

Validates: `eventType` ∈ {NodeFailure, LatencySpike, ErrorRateSpike, NetworkPartition, DDoS, RegionDown, MemoryLeak, CPUSaturation}, `severity` ∈ (0, 1], engine is running. Converts `durationSeconds` to ticks (×10 for 100ms tick rate). `durationSeconds = 0` = indefinite.

#### `GET /api/chaos/active/:simulationRunId` (JWT-protected)

```
Response 200:
{
  "events": [
    { "id": "uuid", "simulationRunId": "uuid", "nodeId": "node-1", ... }
  ]
}
```

### Chaos Lifecycle

```
POST /api/chaos/inject
  │
  ├─ Validate event type, severity, engine running
  ├─ Convert durationSeconds → ticks (×10)
  ├─ Create ChaosEvent with UUID, StartedAt = engine.CurrentTick()
  ├─ ChaosManager.Inject(event) → adds to events[runID] map
  └─ Return event to caller

Engine.RunTick(tickNum)
  │
  ├─ restoreNodes() → copies original IsFailed/LatencyMs/ErrorRate/MaxRPS/Instances from originalNodes
  │
  ├─ chaos.ApplyPreTick(runID, nodes, tickNum):
  │   ├─ Iterates active events for runID
  │   ├─ Skips expired events (durationTicks > 0 && elapsed >= durationTicks) → marks Active=false
  │   ├─ For each active event:
  │   │   ├─ NodeFailure → n.IsFailed = true
  │   │   ├─ LatencySpike → n.LatencyMs *= (1 + severity×9)
  │   │   ├─ ErrorRateSpike → n.ErrorRate = max(current, severity)
  │   │   ├─ NetworkPartition → n.Instances=0, MaxRPS=0
  │   │   ├─ DDoS → n.MaxRPS *= (1 - severity×0.9), Instances *= factor
  │   │   ├─ RegionDown → n.IsFailed=true, MaxRPS=0, Instances=0
  │   │   ├─ CPUSaturation → n.MaxRPS *= (1 - severity×0.95), CPUPercent=95
  │   │   └─ MemoryLeak → n.ErrorRate += 0.05×severity, LatencyMs *= (1 + 0.1×severity)
  │   └─ Removes expired events from active set
  │
  ├─ ctx.PropagateTick(rps) → traffic flows through chaos-modified nodes
  │
  ├─ chaos.ApplyPostTick(runID, nodes):
  │   └─ MemoryLeak: accumulates MemoryPercent and CPUPercent each tick
  │
  ├─ SnapshotTick → captures metrics with chaos effects visible
  └─ Broadcast tick via WebSocket (frontend sees chaos in real-time)
```

### Per-Tick Restoration

Each tick, `restoreNodes()` resets 5 node fields from the original config copy (`originalNodes []Node`):

| Field | Restored To | Why |
|-------|-------------|-----|
| `IsFailed` | Original canvas value | NodeFailure/RegionDown sets it; must be cleared when event expires |
| `LatencyMs` | Original canvas value | LatencySpike/MemoryLeak multiplies it; reset prevents compounding |
| `ErrorRate` | Original canvas value | ErrorRateSpike/DDoS/MemoryLeak raises it; reset prevents compounding |
| `MaxRPS` | Original canvas value | DDoS/CPUSaturation/NetworkPartition/RegionDown reduces it |
| `Instances` | Original canvas value | NetworkPartition/DDoS/RegionDown sets to 0 |

This ensures chaos effects don't permanently corrupt the node config and that expired events cleanly restore normal behavior.

### Build Results

- `go build ./...` — ✅ 0 errors
- `go vet ./...` — ✅ 0 errors
- `npm run build` — ✅ 670 modules, 0 errors (no regressions)

### Verification: PASSED — 2026-05-16

| Check | Result |
|-------|--------|
| `simulation/chaos.go` — 8 ChaosEventType constants + ValidChaosTypes map + IsValidChaosType() | ✅ |
| `simulation/chaos.go` — ChaosEvent struct (id, runId, nodeId, eventType, severity, durationTicks, startedAt, active) | ✅ |
| `simulation/chaos.go` — ChaosManager with sync.RWMutex, events[runID][eventID] map | ✅ |
| `simulation/chaos.go` — Inject() / RemoveEvent() / ActiveEvents() / ClearRun() | ✅ |
| `simulation/chaos.go` — ApplyPreTick(): iterates active events, applies effects, handles expiry | ✅ |
| `simulation/chaos.go` — ApplyPostTick(): MemoryLeak accumulation (MemoryPercent, CPUPercent) | ✅ |
| `simulation/chaos.go` — NodeFailure: IsFailed=true | ✅ |
| `simulation/chaos.go` — LatencySpike: LatencyMs × (1 + severity×9) | ✅ |
| `simulation/chaos.go` — ErrorRateSpike: ErrorRate = max(original, severity) | ✅ |
| `simulation/chaos.go` — NetworkPartition: Instances=0, MaxRPS=0 | ✅ |
| `simulation/chaos.go` — DDoS: MaxRPS × (1 - severity×0.9), Instances × factor, ErrorRate raised | ✅ |
| `simulation/chaos.go` — RegionDown: IsFailed=true, MaxRPS=0, Instances=0 | ✅ |
| `simulation/chaos.go` — MemoryLeak: pre-tick (ErrorRate, LatencyMs) + post-tick (MemoryPercent, CPUPercent) | ✅ |
| `simulation/chaos.go` — CPUSaturation: MaxRPS × (1 - severity×0.95), CPUPercent=95, MemoryPercent raised | ✅ |
| `simulation/engine.go` — RunID field, originalNodes copy, SetChaosManager() | ✅ |
| `simulation/engine.go` — restoreNodes(): resets IsFailed/LatencyMs/ErrorRate/MaxRPS/Instances from originalNodes | ✅ |
| `simulation/engine.go` — RunTick(): restoreNodes → ApplyPreTick → PropagateTick → ApplyPostTick | ✅ |
| `handlers/simulation.go` — Chaos field, NewSimulationHandler takes chaos, Start() wires chaos and RunID on engine | ✅ |
| `handlers/simulation.go` — FindEngine() exported method for ChaosHandler lookup | ✅ |
| `handlers/chaos.go` — POST /api/chaos/inject: validates eventType/severity/engine, creates event, injects | ✅ |
| `handlers/chaos.go` — GET /api/chaos/active/:simulationRunId: returns active events | ✅ |
| `main.go` — Creates chaosMgr, passes to NewSimulationHandler, wires chaos routes | ✅ |
| `go build ./...` — 0 errors | ✅ |
| `go vet ./...` — 0 errors | ✅ |
| `npm run build` — 670 modules, 0 errors | ✅ |

## Phase 5.2 — Chaos UI

### Files Created

| File | Purpose |
|------|---------|
| `frontend/src/store/chaosStore.ts` | Zustand store: `activeEvents` array, `activeNodeIds` derived set (for canvas reactions), `showChaosPanel` toggle, `CHAOS_TYPES` definitions (8 types with icons/colors/descriptions) |
| `frontend/src/store/toastStore.ts` | Zustand store: auto-dismissing toast notifications (`success`, `error`, `info`, `warning`) with configurable duration |
| `frontend/src/components/ui/Toast.tsx` | Fixed-position bottom-right toast container with per-type styling (success/error/info/warning) and dismiss button |
| `frontend/src/components/panels/ChaosPanel.tsx` | Main chaos panel: danger zone header, 2×4 grid of chaos cards with config popovers, active events list with countdown timers |

### Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/ProjectPage.tsx` | Added `showChaosPanel` from chaosStore, `ChaosPanel` import, `ToastContainer` import; right panel shows `ChaosPanel` when chaos toggled (priority over SimPanel/NodeConfigPanel); passes `showChaosPanel`/`onToggleChaosPanel` to TopToolbar |
| `frontend/src/components/toolbar/TopToolbar.tsx` | Added `showChaosPanel`/`onToggleChaosPanel` props; added skull (☠️) toggle button with red accent styling |
| `frontend/src/components/canvas/BaseNode.tsx` | Added `useChaosStore` subscription per node via `activeNodeIds`; shows skull badge (☠️) on nodes with active chaos; applies orange flashing border (`animate-chaos-flash`) and orange glow shadow when chaos active but node not failed |
| `frontend/src/components/canvas/CustomEdge.tsx` | Added `useChaosStore` subscription for source/target nodes; edges connected to chaos-affected nodes show orange stroke, fast dash pattern (`2 3`), rapid flashing (`animate-chaos-flash` on `<g>`), and fast moving circle (`0.3s` animation) |
| `frontend/src/hooks/useSimulation.ts` | Imports `useChaosStore`; calls `chaosStore.reset()` on simulation `stop()` to clear events |
| `frontend/src/index.css` | Added `@keyframes slide-up` (toast entrance), `.animate-slide-up` utility, `@keyframes chaos-flash` (rapid opacity pulse), `.animate-chaos-flash` utility |

### Chaos Panel UI

**Header**: ☠️ "Chaos Engineering" badge with red active-count pill

**Inject Section** (2×4 grid of cards):

| Card | Icon | Color | Description |
|------|------|-------|-------------|
| Node Failure | 💥 | Red | Target node goes down — traffic is dropped |
| Latency Spike | 🐢 | Orange | Multiply latency up to 10× — requests slow down |
| Error Rate Spike | ⚠️ | Yellow | Spike error rate — responses start failing |
| Network Partition | 🔌 | Purple | Node isolated — all incoming traffic dropped |
| DDoS Attack | ⚡ | Pink | Overwhelm node — capacity crushed |
| Region Down | 🌍 | Red | Entire region fails |
| Memory Leak | 📈 | Cyan | Gradual degradation — memory creeps up over time |
| CPU Saturation | 🔥 | Orange | CPU pinned at 100% — throughput collapses |

**Card Popover** (opens on card click): Target node selector (dropdown from canvas nodes), severity slider (5%–100%), duration input (1–300s), "Inject Chaos" button → calls `POST /api/chaos/inject` → shows toast warning on success or error toast on failure

**Active Events List**: Each event row shows icon + label, countdown timer (M:SS format, updates every 250ms), target node label, severity bar, remove button (x). Polls `GET /api/chaos/active/:simulationRunId` every 3 seconds during simulation.

**Empty State**: "No active chaos events" with helper text

### Canvas Visual Reactions

| Reaction | Trigger | Implementation |
|----------|---------|---------------|
| **Skull badge** | Node has active chaos event | `animate-pulse` ☠️ emoji positioned `-top-2 -right-2` on the node |
| **Orange flashing border** | Node has active chaos event | `animate-chaos-flash` CSS class with `border-orange-500`, 0.5s opacity pulse |
| **Orange glow** | Node has active chaos event | `box-shadow: 0 0 16px rgba(249,115,22,0.5)` |
| **Flashing edges** | Edge source/target has active chaos | `animate-chaos-flash` on `<g>` wrapper, 0.5s opacity pulse |
| **Orange edge stroke** | Edge connected to chaos node | Stroke color set to `#F97316` (orange) |
| **Fast dash pattern** | Edge connected to chaos node | `strokeDasharray: "2 3"` (rapid dash) |
| **Fast moving circle** | Edge connected to chaos node | `<animateMotion dur="0.3s">` (vs 0.8s/3s normal) |

### Toast Notifications

- **Success**: Green theme, used for chaos injection confirmation ("Chaos injected: Node Failure" with severity % and node label)
- **Error**: Red theme, used for injection failures ("Chaos injection failed" with API error message)
- Auto-dismiss after 4 seconds (configurable)
- Fixed bottom-right position with slide-up entrance animation

### Build Results

- `go build ./...` — ✅ 0 errors
- `go vet ./...` — ✅ 0 errors
- `npm run build` — ✅ 674 modules, 0 errors (4 new: chaosStore, toastStore, Toast, ChaosPanel)

### Verification: PASSED — 2026-05-17

| Check | Result |
|-------|--------|
| `chaosStore.ts` — `CHAOS_TYPES` array with 8 entries (type, label, description, icon, color) | ✅ |
| `chaosStore.ts` — `activeEvents: ChaosEventData[]` | ✅ |
| `chaosStore.ts` — `activeNodeIds: string[]` derived from events | ✅ |
| `chaosStore.ts` — `setActiveEvents` / `addActiveEvent` / `removeActiveEvent` / `setShowChaosPanel` / `reset` | ✅ |
| `toastStore.ts` — `Toast` interface (id, type, title, message, duration, createdAt) | ✅ |
| `toastStore.ts` — `addToast` auto-dismiss via setTimeout | ✅ |
| `toastStore.ts` — `removeToast` | ✅ |
| `Toast.tsx` — Fixed bottom-right container with `z-[9999]` | ✅ |
| `Toast.tsx` — 4 type styles (success/error/info/warning) with distinct bg/border/icon | ✅ |
| `Toast.tsx` — `animate-slide-up` entrance animation | ✅ |
| `ChaosPanel.tsx` — Danger zone header with active count pill | ✅ |
| `ChaosPanel.tsx` — 2×4 grid of `ChaosCard` components | ✅ |
| `ChaosPanel.tsx` — `ChaosConfigPopover` with node selector/severity slider/duration/inject button | ✅ |
| `ChaosPanel.tsx` — `ActiveEventRow` with countdown timer (M:SS, 250ms update) | ✅ |
| `ChaosPanel.tsx` — Polls `GET /api/chaos/active/:runId` every 3s during simulation | ✅ |
| `ChaosPanel.tsx` — Calls `POST /api/chaos/inject` with toast feedback | ✅ |
| `ChaosPanel.tsx` — Empty state when no active events | ✅ |
| `BaseNode.tsx` — `nodeId` from ReactFlow `id` prop, `useChaosStore` subscription | ✅ |
| `BaseNode.tsx` — Skull badge (☠️) on nodes with active chaos | ✅ |
| `BaseNode.tsx` — Orange flashing border + glow on chaos-affected nodes | ✅ |
| `CustomEdge.tsx` — `useChaosStore` subscription for source/target | ✅ |
| `CustomEdge.tsx` — Orange stroke + fast dash on chaos-affected edges | ✅ |
| `CustomEdge.tsx` — `animate-chaos-flash` on `<g>` wrapper | ✅ |
| `CustomEdge.tsx` — Fast `0.3s` animated circle on chaos edges | ✅ |
| `TopToolbar.tsx` — ☠️ chaos toggle button with red accent | ✅ |
| `ProjectPage.tsx` — ChaosPanel in right panel stack (priority over SimPanel/NodeConfig) | ✅ |
| `ProjectPage.tsx` — ToastContainer rendered at root level | ✅ |
| `useSimulation.ts` — Resets chaosStore on simulation stop | ✅ |
| `index.css` — `slide-up`, `chaos-flash` keyframes | ✅ |
| `npm run build` — 674 modules, 0 errors | ✅ |
| `go build ./...` — 0 errors | ✅ |

## Next Step

Phase 3.3: Implement WebSocket real-time collaboration — sync canvas state (nodes, edges) across multiple users via WebSocket, with Yjs or Socket.IO integration.
