# Frontend — Live System Design Platform

React 19 + TypeScript + Vite application for designing, simulating, and analyzing cloud system architectures.

## Tech

| Category | Libraries |
|----------|-----------|
| Framework | React 19, TypeScript 6, Vite 8 |
| Canvas | ReactFlow 11 (26 node types, custom edges) |
| State | Zustand 5 (canvas, auth, simulation, chaos, deploy, security, finops, export stores) |
| UI | Material-UI 9, Framer Motion, Lucide React |
| Charts | Recharts, D3.js |
| Editor | Monaco Editor |
| Collaboration | Yjs + y-websocket |
| HTTP | Axios |
| Routing | React Router DOM 7 |
| Testing | Vitest, Testing Library |

## Directory Structure

```
src/
├── components/
│   ├── canvas/       # ReactFlow node types (BaseNode, DatabaseNode, etc.) + edges
│   ├── panels/       # Right/bottom panels (config, simulate, chaos, security, finops)
│   ├── toolbar/      # Top toolbar + action dock + status bar
│   ├── ui/           # Shared primitives (modals, toasts, command palette, etc.)
│   └── ...
├── store/            # Zustand stores
├── hooks/            # Custom hooks (simulation, collaboration)
├── pages/            # Route pages (Dashboard, Project, Login, Register, Profile)
├── types/            # TypeScript type definitions
├── utils/            # API client, node registry, command actions, templates
└── theme/            # Spatial tokens, styling constants
```

## Scripts

```bash
npm run dev       # Start dev server with HMR
npm run build     # TypeScript check + Vite production build
npm run test      # Run Vitest tests
npm run lint      # ESLint check
```

## Environment

Set `VITE_API_URL` in `frontend/.env` to point to the backend API (default: `http://localhost:8080/api`).
