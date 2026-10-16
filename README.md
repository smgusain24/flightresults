# Flight search

A three-step flight search: enter your details, pick a route and date, then browse the matching flights. You can sort them by price and filter them by rating.

Stack: React + Vite (JavaScript) for the frontend, FastAPI with raw SQL (psycopg 3) for the API, and PostgreSQL in Docker Compose.

```
.
├── docker-compose.yml     PostgreSQL 17 with a named volume and healthcheck
├── .env.example           Compose overrides (credentials, host port)
├── backend/
│   ├── app/
│   │   ├── main.py            App factory: CORS, lifespan, routers, 503 handler
│   │   ├── config.py          Settings from env / backend/.env
│   │   ├── db.py              Connection pool, schema init, `Conn` dependency
│   │   ├── schema.sql         Tables, applied on startup (idempotent)
│   │   ├── seed.sql           The 12-flight daily timetable (idempotent)
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── logging_config.py  JSON logs + X-Request-ID correlation
│   │   └── routes/            health.py, api.py (flight listing)
│   ├── tests/                 pytest, runs against a real `app_test` database
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api.js             fetch client (base URL from VITE_API_BASE_URL)
    │   ├── App.jsx            Flight search wizard: step indicator + current step
    │   ├── wizard/            State (useReducer + context), validation, sort/format helpers
    │   ├── steps/             Traveller details → trip → results screens
    │   └── *.test.js(x)       Vitest + Testing Library
    └── .env.example
```

## Prerequisites

Docker (with Compose v2), Python 3.11+, Node 22.12+ (required by Vitest 5).

## Run it

**1. Start the database**

```bash
docker compose up -d
docker compose ps          # wait for STATUS "healthy"
```

Postgres listens on host port **5433** so it doesn't clash with a local install on 5432. Override it (and the credentials) by copying `.env.example` to `.env`.

**2. Start the backend** (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Check it: `curl http://localhost:8000/api/health` → `{"status":"ok","database":"ok"}`.
Interactive API docs: http://localhost:8000/docs.

**3. Load the flights** (once, after the backend has started and created the tables)

```bash
docker compose exec -T db psql -U app -d app < backend/app/seed.sql
```

This inserts 12 daily flights between Chennai, Hyderabad and Bengaluru. Running it again adds nothing. Without it, every search returns "No flights".

**4. Start the frontend** (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The wizard has three steps:

1. **Your details**: first name, last name, email, and a 10-digit phone number.
2. **Trip**: from and to (Chennai, Hyderabad, Bengaluru) and a travel date (today or later).
3. **Flights**: results from `POST /api/flight-listings`. Sorting by price happens in the browser. The rating filter is sent to the API as `{"field": "stars", "op": "gte", "value": N}`.

## How the frontend keeps state

- **One store for the whole wizard.** `frontend/src/wizard/state.js` is a `useReducer` reducer with four slices: the current step, traveller details, trip, and results view (sort and minimum rating). `WizardProvider.jsx` shares it through React Context. Every keystroke writes to the store, so going back to edit a step keeps every other field, plus the sort and rating choices.
- **Steps unlock in order.** You can always go back. A later step opens only when every earlier step validates (`canEnter` in `state.js`). Validation rules are in `validation.js` and mirror the database constraints.
- **Browser history.** Each step is a history entry, so the browser's Back and Forward buttons move between steps without losing data.
- **No persistence.** A page reload starts over, so email and phone never go into browser storage.
- **Results.** Results are fetched when step 3 opens and again when the rating filter changes. Responses to outdated searches are ignored. Sorting by price happens in the browser, so changing the sort doesn't make a new request.

## Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `.env` | `app` / `app` / `app` | Container credentials |
| `POSTGRES_PORT` | `.env` | `5433` | Host port mapped to the container |
| `DATABASE_URL` | `backend/.env` | `postgresql://app:app@localhost:5433/app` | psycopg connection string |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:5173` | Comma-separated allowed origins |
| `DB_POOL_TIMEOUT` | `backend/.env` | `5` | Seconds to wait for a connection before returning 503 |
| `LOG_LEVEL` | `backend/.env` | `INFO` | Root log level |
| `VITE_API_BASE_URL` | `frontend/.env` | `http://localhost:8000` | Backend origin the browser calls |

If you change the frontend port, add it to `CORS_ORIGINS`.

## API

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/health` | 200 `{"status":"ok","database":"ok"}` | 503 database unavailable |
| POST | `/api/flight-listings` | 200 list of flights | 422 invalid body or filter, 503 |

`flight-listings` returns the daily flights from `travel_from` to `travel_to`, ordered by start time. `travel_date` must be a valid `YYYY-MM-DD` but does not narrow the results, because `flights` is a daily timetable. `filters` is optional. Every filter you send has to match (they're combined with AND), and you can send up to 10:

```json
{
  "data": {
    "first_name": "Asha", "last_name": "Rao", "email_id": "asha@example.com", "phone_no": "9876543210",
    "travel_date": "2026-11-01", "travel_from": "Hyderabad", "travel_to": "Chennai",
    "filters": [
      {"field": "price", "op": "lte", "value": 5000},
      {"field": "stars", "op": "gte", "value": 4}
    ]
  }
}
```

`field` is `price` or `stars`. `op` is `eq`, `lt`, `lte`, `gt` or `gte`. `value` is a finite JSON number ≥ 0; strings and booleans are rejected. Response items look like `{"start_time": "07:00", "journey_time": "45m", "price": 4800, "stars": 4, "set": 1}`.

Every response carries an `X-Request-ID` header. Send your own (`[A-Za-z0-9._-]{1,128}`) to trace a request across systems. Logs are one JSON object per line with `timestamp`, `level`, `logger`, `message` and `correlation_id`.

## Tests

```bash
# backend: needs the database running; creates and uses `app_test`
cd backend && source .venv/bin/activate && pytest

# frontend
cd frontend && npm test
```

Point the backend tests at a different server with `TEST_DATABASE_URL`.

## Database schema

`backend/app/schema.sql` runs on every startup and uses `CREATE TABLE IF NOT EXISTS`, so it only creates tables that are missing. It does not alter existing ones. Before you have data worth keeping, move to versioned migrations.

Reset all data: `docker compose down -v` (deletes the volume).

## Troubleshooting

- **`docker compose up` hangs on "Pulling" (Docker Desktop, macOS):** the credential helper may be blocked on the keychain. Unlock it, or pull the public image anonymously:
  `DOCKER_CONFIG=$(mktemp -d) DOCKER_HOST=unix://$HOME/.docker/run/docker.sock docker pull postgres:17-alpine`
- **Backend exits on startup with `PoolTimeout`:** the database isn't reachable at `DATABASE_URL`. Check `docker compose ps` and the port.
- **Browser shows "Cannot reach API":** the backend isn't running at `VITE_API_BASE_URL`, or the page's origin is missing from `CORS_ORIGINS`.
