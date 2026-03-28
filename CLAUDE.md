# JTI Promotion Scheduling POC

## Instructions for Claude

- After **any backend change**, run `make be-lint` (auto-fixes black + isort, then checks flake8).
- After **any frontend change**, run `make fe-lint`.
- After adding or changing frontend behaviour, run `make fe-test` to verify tests pass.
- Fix all lint errors before considering a task complete.

---

## Business Context

An AI-powered **promoter scheduling application** piloted in **JTI Greece**. It automates the planning of promoter/informer visits to Points of Sale (POS — retail kiosks) to maximise sales impact.

### The problem

Currently scheduling is entirely manual: field teams check each POS individually in BI tools to decide when to visit and who to send. This is slow, error-prone, and leads to visits at suboptimal times.

### Domain concepts

| Term | Meaning |
|---|---|
| **POS** | Point of Sale — a retail kiosk. Identified by a `CDB Code`. |
| **Promoter / Informer** | Field staff who visit POS to sell devices and conduct customer interviews. |
| **Activity / Visit** | One promoter visit to one POS. Has a date, start/end time, and outcome (devices sold, interviews). |
| **Programme type** | Nature of the promoter assignment: `Permanent` (JTI full-time), `Exclusive` (JTI dedicated contractor), `Radical` (external collaborator). |
| **Schedule** | A planning period (e.g. next month) containing a set of assigned visits. Created by a scheduling admin. |

### Tool outputs

1. Complete visit plan per POS — day, time, frequency, promoter assignment
2. Peak time detection per POS from historical data
3. Optimised visit frequency per POS
4. Promoter–POS matching based on past performance
5. Exportable plan (Excel / CSV / PDF)

### Scope

Pilot POC for Greece. Goal is to validate approach before broader rollout.

---

## Project Structure

```
jti-promotion-scheduling-poc/
├── CLAUDE.md
├── Makefile
├── .gitignore
├── .github/workflows/ci.yml
├── backend/
│   ├── .venv/                        # Python 3.14, managed by uv
│   ├── .env                          # gitignored — copy from .env.example
│   ├── .env.example                  # documents required env vars
│   ├── manage.py
│   ├── setup.cfg                     # flake8 + isort config
│   ├── pyproject.toml                # black config
│   ├── config/                       # Django project settings, urls, wsgi, asgi
│   ├── api/                          # Auth endpoints
│   ├── scheduling/                   # Core domain models, views, serializers, AI
│   │   ├── ai/                       # LLM client, prompt builder, streaming generator
│   │   │   ├── _client.py            # OpenAI-compatible client factory
│   │   │   ├── _prompts.py           # System prompt + domain formatters
│   │   │   └── _generate.py          # stream_generate_schedule + blocking wrapper
│   │   ├── views/                    # Split view modules (schedule, generate, transfer…)
│   │   └── fixtures/initial_data.json
│   ├── metrics/                      # POSMetrics model
│   └── data_integration/             # CSV importers, DataSyncLog, admin Pull buttons
│       └── sample_data/              # Sample CSVs for PoC demo
└── frontend/
    ├── package.json
    ├── vite.config.js                 # proxies /api → :8000; Vitest config
    ├── eslint.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                    # Router + AuthProvider + ThemeProvider
        ├── index.css                  # Global styles
        ├── theme.js                   # JTI color tokens (used by LoginPage)
        ├── muiTheme.js                # MUI dark theme with JTI tokens
        ├── context/AuthContext.jsx    # JWT auth state, login/logout, authHeaders()
        ├── components/
        │   ├── JtiLogo.jsx            # Official JTI SVG logo
        │   ├── ProtectedRoute.jsx
        │   └── CreateScheduleDialog.jsx  # Stepper dialog — step 1: schedule params
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── HomePage.jsx           # Schedule list + create button
        │   └── ScheduleDetailPage.jsx # AI generation panel + visit table
        └── test/
            ├── setup.js               # jest-dom import
            ├── handlers.js            # MSW request handlers + mock data
            ├── HomePage.test.jsx
            └── ScheduleDetailPage.test.jsx
```

---

## Backend

### Python environment

- Venv: `backend/.venv/` (Python 3.14)
- Dependency manager: **uv** — `backend/.venv/Scripts/uv.exe`
- **Never use `pip` or `requirements.txt`. Always use `uv`.**

```bash
backend/.venv/Scripts/uv.exe add <package>   # install + update pyproject.toml + uv.lock
backend/.venv/Scripts/Activate.ps1           # activate (PowerShell)
```

> **Important:** CI runs `uv sync --frozen`, which installs from `uv.lock` exactly.
> After adding any package with `uv add`, commit both `pyproject.toml` **and** `uv.lock` —
> otherwise CI will fail with `ModuleNotFoundError`.

### Stack

- Django 6.x + Django REST Framework
- `djangorestframework-simplejwt` — JWT authentication
- `django-cors-headers`
- `openpyxl` — Excel reading (fixture/data generation scripts)
- `boto3` — AWS SDK; used to call Bedrock `converse_stream` for AI generation
- `python-dotenv` — loads `backend/.env` at startup

### Environment variables

Loaded from `backend/.env` (gitignored). Copy `backend/.env.example` to get started.

| Variable | Required | Description |
|---|---|---|
| `AWS_REGION` | No | Bedrock region (default: `us-east-1`) |
| `BEDROCK_MODEL` | No | Bedrock model ID (default: `anthropic.claude-3-5-sonnet-20241022-v2:0`) |
| `AWS_ACCESS_KEY_ID` | No* | AWS credentials — not needed when using an IAM role or `~/.aws/credentials` |
| `AWS_SECRET_ACCESS_KEY` | No* | As above |

Extended thinking is always enabled (`budget_tokens=8000`). Newer Claude models require a **cross-region inference profile ID** (prefixed with `us.`) rather than a bare model ID — e.g. `us.anthropic.claude-3-7-sonnet-20250219-v1:0`. The profile must be enabled in the Bedrock console for your account.

### Django apps

| App | Responsibility |
|---|---|
| `api` | Auth endpoints: login, logout, me |
| `scheduling` | Core domain models, REST API, AI schedule generation |
| `metrics` | POSMetrics — time-windowed historical performance per POS |
| `data_integration` | CSV importers + DataSyncLog; admin Pull buttons |

### API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/login/` | POST | Returns access + refresh tokens |
| `/api/auth/logout/` | POST | Blacklists refresh token |
| `/api/auth/me/` | GET | Returns current username |
| `/api/schedules/` | GET | List schedules (filter: `?status=Draft`) |
| `/api/schedules/` | POST | Create schedule draft (sets status + created_by server-side) |
| `/api/schedules/{id}/` | GET | Schedule detail |
| `/api/schedules/{id}/visits/` | GET | All visits for a schedule (nested POS + Promoter) |
| `/api/schedules/{id}/generate/` | POST | AI generation — clears existing visits, calls LLM, saves new visits |
| `/api/pos/` | GET | Active POS list |
| `/api/promoters/` | GET | Active promoters list |

All endpoints require `IsAuthenticated`. Users created via Django Admin only.

### Authentication

JWT via `djangorestframework-simplejwt`:
- Access token: **8 hours**
- Refresh token: **7 days**, rotation + blacklist enabled

### AI schedule generation — `scheduling/ai/`

`POST /api/schedules/{id}/generate/` accepts:
```json
{ "optimization_goal": "sales * 10 + interviews", "user_prompt": "Maria X not available Apr 3-7" }
```

Flow:
1. Aggregates `POSMetrics` into per-POS peak-window summaries (avg sales/interviews by time slot + day-of-week)
2. Builds a structured prompt with schedule period, POS list, promoter list, optimization goal, and user constraints (`scheduling/ai/_prompts.py`)
3. Streams the LLM response via OpenAI-compatible client (`scheduling/ai/_client.py`, `_generate.py`)
4. Yields `thinking` deltas (streamed to frontend via SSE) then a `done` event with parsed visits
5. Saves a `LLMCallLog` record (full prompt + raw response), clears existing `ScheduledVisit` records, saves new ones
6. Returns `{ visits, summary, score, usage, errors }`

`week_label` is computed from the visit date relative to `period_start`. AI reasoning is stored in the `comments` field of each `ScheduledVisit`. Every LLM call (success or error) is logged to `LLMCallLog` and visible in Django Admin only.

### Linting

| Tool | Purpose | Config |
|---|---|---|
| `black` | Formatter | `pyproject.toml` |
| `isort` | Import sorter | `setup.cfg` |
| `flake8` | Style/error checker | `setup.cfg` |

`max-line-length = 88`. `.venv` and `migrations` excluded.

---

## Data Model

### `scheduling` app — `backend/scheduling/models.py`

#### `PointOfSale`
Master POS registry. Unique key: `cdb_code`.

Key fields: `pos_type`, `priority` (Strategic/Prime/BaseLine/Developing), `address/city/county/department/district/territory`, `chain`, `contractor`, `warehouse`, `is_active`.

#### `Promoter`
All promoter types. Unique key: `username`.

Key fields: `code` (nullable for Radical), `programme_type` (Permanent/Exclusive/Radical), `base_city` (nullable for Radical — data quality gap), `team` (SOUTH TEAM / NORTH TEAM, nullable for Radical), `is_active`.

#### `Schedule`
A planning period container. Lifecycle: `Draft → Published → Archived`.

Key fields: `name`, `period_start`, `period_end`, `status`, `created_by`, `included_pos` (M2M), `included_promoters` (M2M).

Constraints:
- `period_end >= period_start`
- **No overlapping schedules** — enforced in `clean()`
- `included_pos` and `included_promoters` define the scope for AI generation

#### `ScheduledVisit`
One promoter visit to one POS within a schedule. Central fact record.

Key fields: `schedule`, `promoter` (nullable for Radical), `pos`, `date`, `start_time`, `end_time`, `programme_type`, `out_of_premises`, `week_label`, `action` (blank = planned), `reason`, `comments` (AI reasoning stored here), `comments_meeting`.

Constraints: `end_time > start_time`, `date` within `schedule` period.

#### `LLMCallLog`
Audit log of every LLM call made during schedule generation. Admin-only (no REST API).

Key fields: `schedule` (FK, cascade), `called_at` (auto), `model_name`, `optimization_goal`, `user_prompt`, `prompt` (JSONField — full messages list), `raw_response` (full accumulated text including `<thinking>` block), `total_tokens`, `status` (success/error), `error_message`.

---

### `metrics` app — `backend/metrics/models.py`

#### `POSMetrics`
Historical performance per POS broken down by **time window**. Used by the AI to detect peak times and prioritise visits.

Fields: `pos`, `reference_type`, `period_start`, `period_end`, `window_date`, `window_start`, `window_end`, `sales`, `interviews`.

Unique constraint: `(pos, reference_type, period_start, period_end, window_date, window_start, window_end)`.

**`reference_type`** — expandable enum:
- `previous_year` — same calendar period from the prior year *(primary for PoC)*
- `previous_month` — the immediately preceding month

---

### `data_integration` app — `backend/data_integration/`

#### `DataSyncLog`
Audit log of every pull operation: `sync_type`, `status` (Success/Failed), `records_created/updated/skipped`, `file_used`, `triggered_by`, `triggered_at`, `notes`.

#### Importers — `data_integration/importers/`

All imports are **idempotent** (upsert). Each returns `{created, updated, skipped, errors}`.

| Module | Match key | Target model |
|---|---|---|
| `promoters.py` | `username` | `scheduling.Promoter` |
| `pos.py` | `cdb_code` | `scheduling.PointOfSale` |
| `metrics.py` | 7-field composite key | `metrics.POSMetrics` |

Metrics importer parses `period_start`, `period_end`, and `reference_type` from the filename:
`period_YYYY-MM-DD_YYYY-MM-DD_(previous_year|previous_month)_metrics.csv`

#### Django Admin Pull buttons

In Django Admin → **Data Sync Logs**:
- **↓ Pull Promoters**
- **↓ Pull Points of Sale**
- **↓ Pull Metrics**

---

## Test Data

### Fixtures — `backend/scheduling/fixtures/initial_data.json`

Load with: `make be-loaddata`

| Entity | Count | Notes |
|---|---|---|
| `auth.User` (admin) | 1 | username: `admin`, password: `admin123!` |
| `Promoter` (Permanent) | 19 | Real — from Excel `Personnel` sheet |
| `Promoter` (Exclusive) | 27 | Real — from Excel `Personnel` sheet |
| `Promoter` (Radical) | 8 | **Fake** — codes prefixed `RAD_`; real data pending |
| `PointOfSale` | 50 | Real — from Excel `CDB List` sheet |

### Sample CSVs — `backend/data_integration/sample_data/`

| File | Rows | Notes |
|---|---|---|
| `sample_promoters.csv` | 54 | Same data as fixtures |
| `sample_pos.csv` | 50 | Same data as fixtures |
| `period_2026-04-01_2026-04-30_previous_year_metrics.csv` | 408 | Fake but plausible time-windowed metrics |

**Metrics time windows:**
- Morning `09:00–11:00` — weekdays, ~60% of dates
- Afternoon `15:00–17:00` or `17:00–19:00` — ~75% of dates
- Night `21:00–23:00` Fri/Sat only — ~20% of POS flagged as high night-traffic venues

---

## Frontend

Framework: React 19 + Vite 6 + **MUI (Material UI) v7**. Dev server at `:5173`, proxies `/api` → `:8000`.

### Auth flow

1. Unauthenticated users redirected to `/login`
2. `LoginPage` POSTs to `/api/auth/login/`
3. Access + refresh tokens stored in `localStorage`
4. `authHeaders()` injects `Authorization: Bearer <token>` on API calls
5. 401 response on any page → `logout()` → redirect to `/login`
6. Logout calls `/api/auth/logout/` and clears storage

### Routing

| Path | Component | Description |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/` | `HomePage` | Schedule list + create draft button |
| `/schedules/:id` | `ScheduleDetailPage` | AI generation panel + visit table |

### Theming

- `src/muiTheme.js` — MUI `createTheme` in dark mode with JTI tokens. All new pages use MUI components styled via this theme.
- `src/theme.js` — raw color tokens, still used by `LoginPage` (inline styles).

### Key components

- `CreateScheduleDialog` — MUI Stepper dialog (step 1 active: name, period, POS checklist, promoters checklist). Computes default period as next calendar month without an existing schedule.
- `ScheduleDetailPage` — two-column layout: sticky AI panel (left) + visit table (right). Hitting Generate/Regenerate replaces the visit list in place.

### Testing

Vitest + React Testing Library + MSW (Mock Service Worker for `fetch` interception).

- `src/test/setup.js` — `@testing-library/jest-dom` matchers
- `src/test/handlers.js` — default MSW handlers + shared mock data constants
- Tests cover: render, 401 redirect, empty state, error state, dialog open, create success, AI generation, back navigation

### Linting

ESLint with `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`. Config: `eslint.config.js`.

---

## Makefile Commands

```bash
make help                # List all commands

# Backend
make be-run              # Django dev server (:8000)
make be-migrate          # Apply migrations
make be-makemigrations   # Create new migrations
make be-install          # Install backend deps via uv
make be-createsuperuser  # Create Django admin superuser
make be-loaddata         # Load fixture data (promoters, POS, test admin)
make be-lint             # Format + lint, auto-fix (black + isort + flake8)
make be-lint-check       # Lint check only, no changes (CI mode)

# Frontend
make fe-run              # Vite dev server (:5173)
make fe-install          # npm install
make fe-build            # Production build
make fe-lint             # ESLint
make fe-test             # Vitest (run once)

# Combined
make install             # Install all deps
make lint                # All linters in CI mode
```

---

## CI — `.github/workflows/ci.yml`

Triggers: push or PR to `main`.

| Job | Steps |
|---|---|
| `backend-lint` | black --check, isort --check, flake8 |
| `backend-test` | uv sync, Django test suite, coverage report |
| `frontend-lint` | npm ci, eslint |
| `frontend-test` | npm ci, vitest run |

---

## Dev Ports

| Service | Port |
|---|---|
| Django API | 8000 |
| Django Admin | 8000/admin |
| React / Vite | 5173 |

---

## Source Excel Reference

File: `SWAP TTL Program Jan '26 Week 3.xlsx` — the manually produced weekly schedule this tool replaces.

### Main schedule sheet: `SWAP TTL Program Jan '26_W3`

Each row = one promoter visit to one POS.

| Column | Description |
|---|---|
| `Week` | Week label e.g. `W1`, `W3` |
| `Base` | Promoter home city. Null for Radical (data quality issue). |
| `Program` | Programme type: `Permanent`, `Exclusive`, `Radical` |
| `Out of Premises` | `Yes` if visit is outside POS premises |
| `Brand Ambassador` | `SPC_<Lastname> <Firstname>`. Null for Radical (data quality issue). |
| `Date` / `Start` / `End` / `Duration` | Visit timing |
| `CDB Code` / `POS Name` | POS identifier and name |
| `Priority` | Strategic / Prime / BaseLine / Developing |
| `Type` | POS category (kiosk, convenience, minimarket, vape store…) |
| `Address` / `City` / `County` / `Department` / `District` / `Territory` | Location hierarchy |
| `Chain` / `W/H` / `Contractor` | Commercial relationships |
| `Action` | Outcome: Executed / Cancelled / Change Visit / Double Visit |
| `Reason` | Reason when not executed |
| `Comments` / `Comments Meeting` | Free-text notes |

### Other sheets

| Sheet | Purpose |
|---|---|
| `Personnel` | Master list of JTI promoters (Permanent + Exclusive, ~46 records) |
| `CDB List` | Master POS registry (~866 records) |
| `Priority` | POS analysis with recommended visit Day/Time slots and volume metrics |
| `schedules` | Output template for downstream system (`promoterCode`, `posCode`, `startAt`, `endAt`) |
| `Strategic PoS_Monthly Plan` | Monthly grid view of strategic POS |
| `Detailed Pan Provences` | Province-level planning breakdown |
| `DropDownLists` | Reference values for Action, Reason, Trade Offer, PoS Gift fields |

---

## Open Questions

| # | Area | Question |
|---|---|---|
| 2 | Programme types | **Exclusive vs Permanent** — is Exclusive a dedicated third-party contractor (not direct payroll) while Permanent is a full-time JTI hire? |
| 3 | Promoter data | **`Base` column for Radical** — null because data isn't tracked, or because Radical promoters are always local to the POS area? |
| 4 | Output | **`schedules` sheet** — confirmed as downstream system output format? What system consumes it? |
| 5 | AI input | **`Priority` sheet Day/Time columns** — are these manually determined optimal slots that the AI should learn to generate? Ground truth for validation? |
| 6 | POS data | **`W/H` column** — does warehouse/distributor affect scheduling (e.g. promoter–distributor ties) or is it logistics-only? |
| 7 | POS data | **`Contractor` column** (`JTI`/`Competition`/`Owner`) — does this affect which POS is scheduled, which programme type is used, or which promoter is assigned? |
