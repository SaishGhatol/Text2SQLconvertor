# SmartQuery AI v2.0
### Final Year Engineering Project — Natural Language to SQL System

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        React Frontend                          │
│   AuthPage │ Sidebar │ ChatPage │ ConnectPage │ Dashboard      │
│               Zustand Store │ Axios API Client                 │
└───────────────────────┬────────────────────────────────────────┘
                        │ REST API (JWT Bearer)
┌───────────────────────▼────────────────────────────────────────┐
│                     FastAPI Backend                            │
│  /api/auth  /api/query  /api/ai  /api/analytics  /api/history  │
│                                                                │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐   │
│  │ Auth Service │  │ Query Service  │  │   AI Service    │   │
│  │ JWT + bcrypt │  │ + Cache + Retry│  │ Prompt Engineer │   │
│  └──────────────┘  └───────┬────────┘  └────────┬────────┘   │
│                             │                    │             │
│  ┌──────────────────────────▼────────────────────▼──────────┐ │
│  │              SQLAlchemy (Async) + Connection Pool        │ │
│  │         SQLite | MySQL | PostgreSQL                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────┬────────────────────────────────────────┘
                        │ HTTP /api/chat
┌───────────────────────▼────────────────────────────────────────┐
│                    Ollama (Local LLM)                          │
│              phi3 / llama3 / mistral                           │
└────────────────────────────────────────────────────────────────┘
```

---

## Modules & Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| Auth Service | `services/auth_service.py` | User CRUD, JWT generation, bcrypt hashing |
| AI Service | `services/ai_service.py` | Prompt engineering, Ollama API, few-shot SQL |
| Query Service | `services/query_service.py` | Pipeline: generate → validate → execute → retry |
| Schema Service | `services/schema_service.py` | DDL extraction, PK/FK, schema-to-JSON |
| History Service | `services/history_service.py` | Save/fetch history, analytics aggregation |
| Cache Module | `core/cache.py` | In-memory TTL query cache (swap Redis in prod) |
| Security | `core/security.py` | JWT encode/decode, OAuth2 middleware |

---

## API Endpoints

```
POST   /api/auth/signup          Register new user
POST   /api/auth/token           Login → JWT token
GET    /api/auth/me              Current user info

POST   /api/query/connect        Connect database, extract schema
POST   /api/query/run            Run NL→SQL pipeline (authenticated)
GET    /api/query/schema         Get current schema tree

POST   /api/upload/csv           Upload CSV → SQLite table

GET    /api/history/             Paginated query history
GET    /api/analytics/summary    Dashboard stats

POST   /api/ai/explain           Explain a SQL query

GET    /api/health               Health check
GET    /api/docs                 Swagger UI
```

---

## Feature Upgrades from v1 → v2

### Security
- **bcrypt** password hashing (v1 used plain SHA-256)
- **JWT** tokens with expiry (v1 had no token-based auth)
- **Role-based** access: admin / user roles in token payload
- SQL injection prevention via SQLAlchemy parameterized queries
- Regex-based forbidden keyword detection with word boundaries

### AI System
- **Few-shot examples** in every prompt — 5 reference SQL patterns
- **System prompt separation** — role-conditioned via `role: system`
- **Multi-turn memory** — last 4 conversation turns sent as context
- **Self-healing SQL** — up to 3 retries with error-aware re-prompting
- **Insight generation** — suggests 3 follow-up questions after results
- **Temperature tuning** — 0.0 for generation, 0.1 for correction, 0.2 for explanation

### Infrastructure
- **Async FastAPI** with aiosqlite — non-blocking I/O
- **Connection pooling** — `pool_pre_ping`, `pool_size=10`, `max_overflow=20`
- **In-memory TTL cache** — same question+schema returns instantly
- **Request ID middleware** — every request gets UUID for traceability
- **GZip middleware** — compresses API responses
- **Global error handler** — structured JSON error responses

### Frontend
- Full **React SPA** with `react-router-dom` — no page reloads
- **Zustand** state management — auth + workspace stores persisted
- **Distinctive design** — Obsidian/Amber/Teal palette, Syne + DM Mono fonts
- **ChatGPT-style** interface with streaming-ready message bubbles
- **3-tab result panel** — Table | Chart | Explain
- **Auto chart detection** — bar/line/pie based on data shape
- **Schema Explorer** — visual tree of connected database
- **Collapsible sidebar** with live DB connection status

---

## Folder Structure

```
smartquery_ai/
├── backend/
│   ├── main.py                  # FastAPI app, middleware, routers
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── setup_demo_db.py         # Demo database generator
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (env vars)
│   │   ├── database.py          # Async SQLAlchemy + connection pool
│   │   ├── security.py          # JWT + bcrypt
│   │   └── cache.py             # In-memory TTL cache
│   ├── models/
│   │   ├── user.py              # User ORM model
│   │   └── history.py           # QueryHistory ORM model
│   ├── services/
│   │   ├── auth_service.py      # Auth business logic
│   │   ├── ai_service.py        # LLM prompt engineering
│   │   ├── query_service.py     # Full pipeline orchestration
│   │   ├── schema_service.py    # DDL extraction
│   │   └── history_service.py   # History + analytics
│   └── routers/
│       ├── auth.py
│       ├── query.py
│       ├── ai.py
│       ├── analytics.py
│       ├── history.py
│       └── upload.py
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles/globals.css   # Design system (tokens, animations)
│       ├── stores/
│       │   ├── authStore.js     # Zustand auth (persisted)
│       │   └── queryStore.js    # Zustand workspace state
│       ├── utils/api.js         # Axios instance + interceptors
│       └── components/
│           ├── auth/AuthPage.jsx
│           ├── layout/
│           │   ├── AppShell.jsx
│           │   └── Sidebar.jsx
│           ├── chat/
│           │   ├── ChatPage.jsx
│           │   └── ResultPanel.jsx
│           ├── query/
│           │   ├── ConnectPage.jsx
│           │   └── HistoryPage.jsx
│           └── dashboard/
│               └── DashboardPage.jsx
│
└── docker-compose.yml
```

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.ai) installed

### Backend
```bash
cd backend
pip install -r requirements.txt
python setup_demo_db.py          # Create demo SQLite DB
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                      # Starts on http://localhost:5173
```

### Pull AI Model
```bash
ollama pull phi3
# or for better results:
ollama pull llama3
```

---

## Docker Deployment
```bash
docker-compose up --build

# Pull model inside Ollama container
docker exec smartquery-ollama ollama pull phi3
```

---

## Data Flow Diagram

```
User types question
       │
       ▼
[React ChatPage] ──POST /api/query/run──► [FastAPI QueryRouter]
                                                  │
                                          [Auth Middleware]
                                          Validates JWT token
                                                  │
                                          [QueryService]
                                          1. Check TTL cache ──► HIT: return cached result
                                          2. MISS: call AI
                                                  │
                                          [AIService.generate_sql()]
                                          - Build system prompt
                                          - Attach few-shot examples
                                          - Add schema DDL
                                          - Send conversation history
                                                  │
                                          [Ollama /api/chat]
                                          phi3 generates SQL
                                                  │
                                          [validate_sql()]
                                          SELECT-only + keyword check
                                                  │
                                          [execute_query()]
                                          SQLAlchemy → pandas DataFrame
                                                  │
                                          ✗ Error? → [AIService.fix_sql()]
                                                      Retry up to 3 times
                                                  │
                                          [explain_sql() + suggest_insights()]
                                                  │
                                          [cache.set()] + [HistoryService.save()]
                                                  │
                                          JSON response ──► React ResultPanel
                                                            Table | Chart | Explain tabs
```

---

## Viva Points — What to Emphasize

### Architecture
- "We separated concerns into 5 microservice-style modules: Auth, Query, AI, Analytics, History"
- "The backend is fully async using FastAPI + aiosqlite for non-blocking database operations"
- "SQLAlchemy connection pooling with pool_pre_ping prevents stale connections under load"

### AI System
- "We use a structured system prompt with few-shot examples to dramatically improve SQL accuracy"
- "Multi-turn conversation history (last 4 turns) allows follow-up questions to work naturally"
- "The self-healing engine analyses the actual DB error message and re-prompts the LLM — not just a retry"

### Security
- "Passwords are hashed with bcrypt (adaptive cost factor) — far stronger than SHA-256 in v1"
- "JWT tokens carry role claims (admin/user) enabling role-based access control"
- "SQL injection is impossible — we use SQLAlchemy's parameterized text() execution"

### Performance
- "Identical question+schema combinations are cached in-memory with TTL — zero LLM overhead"
- "GZip middleware compresses all API responses, reducing frontend load times"
- "Every request is assigned a UUID for distributed tracing in production"

### Frontend
- "We built a full React SPA with Zustand state management — no page reloads, ChatGPT-style UX"
- "The auto-chart detection algorithm inspects column types and row count to pick bar/line/pie"
- "The design system uses CSS custom properties (tokens) for consistent theming across all 7 components"

### Innovation
- "This is an entirely offline system — your data never leaves your machine. Enterprise-grade privacy."
- "The schema-aware prompting includes PK/FK relationships, so JOIN queries are generated correctly"
- "The follow-up suggestion feature acts as an AI data analyst — it reads results and proposes next queries"

---

## Innovation Highlights (for standing out)

1. **Offline Enterprise Analytics** — All computation local. No cloud API costs. Ideal for sensitive enterprise data.

2. **Self-Healing SQL Engine** — 3-tier retry: generate → validate → execute → analyse error → re-generate. Transparent auto-correction badge shown to user.

3. **Conversational Context** — Multi-turn memory means "now filter by department" works naturally after a previous query.

4. **Schema-Semantic Prompting** — Full DDL including foreign keys gives the LLM relational context for JOIN generation.

5. **Production Engineering** — Request IDs, GZip, connection pooling, async I/O, JWT auth, structured logging — not just a demo app.
