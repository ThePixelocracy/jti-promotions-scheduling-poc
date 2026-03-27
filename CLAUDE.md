# JTI Promotion Scheduling POC

## Instructions for Claude

- After **any backend change**, run: `cd backend && ../.venv/Scripts/python.exe -m black . && ../.venv/Scripts/python.exe -m isort . && ../.venv/Scripts/python.exe -m flake8 .`
  - Or via Makefile: `make be-lint`
- After **any frontend change**, run: `cd frontend && npm run lint`
  - Or via Makefile: `make fe-lint`
- Fix all lint errors before considering a task complete.

## Source Excel Schedule — Structure & Attributes

The file `SWAP TTL Program Jan '26 Week 3.xlsx` is the manually produced weekly promoter visit schedule. It is the primary reference for what the tool must automate. It contains 10 sheets:

---

### Main Schedule Sheet: `SWAP TTL Program Jan '26_W3`

~428 rows of planned visit activities. Each row = one promoter visit to one POS.

| Column | Type | Description |
|---|---|---|
| `Week` | string | Week identifier (e.g. `W1`, `W3`) |
| `Base` | string | Promoter's home city (Athens, Thessaloniki, Patra, Irakleio, Kozani, Volos, Alexandroupoli, Kavala). Null for `Radical` rows. |
| `Program` | enum | Type of promoter assignment — see Programme Types below |
| `Out of Premises` | flag | `Yes` if visit occurs outside the POS premises; null otherwise |
| `Brand Ambassador` | string | Promoter identifier in format `SPC_<Lastname> <Firstname>`. Populated only for `Permanent` and `Exclusive` programme types. Null for `Radical`. |
| `Date` | date | Visit date |
| `Start` | time | Visit start time |
| `End` | time | Visit end time |
| `Duration` | time | Duration of visit (End − Start) |
| `CDB Code` | string | Unique POS identifier (e.g. `60-072345`) |
| `POS Name` | string | Name of the Point of Sale |
| `Priority` | enum | POS tier: `Strategic`, `Prime`, `BaseLine` / `Baseline`, `Developing` |
| `Type` | string | POS category (e.g. `ΠΕΡΙΠΤΕΡΟ` = kiosk, `CONVENIENCE`, `ΨΙΛΙΚΟ` = minimarket, `VAPE STORE`) |
| `Address` | string | Street address |
| `City` | string | City |
| `County` | string | Prefecture/county |
| `Department` | string | Geographic department |
| `Chain` | string | Retail chain name if applicable |
| `District` | string | Sales district (e.g. `CENTRAL (DKR)`, `EAST (NF)`, `WEST (MA)`) |
| `Territory` | string | Sales territory (e.g. `C_03. ΜΠΑΛΑΜΑΤΣΗ`) |
| `W/H` | string | Warehouse/distributor company name |
| `Telephone` | number | POS landline |
| `Mobile` | number | POS mobile |
| `Contractor` | string | Contract company supplying the POS (e.g. `JTI`, `Competition`, `Owner`) |
| `PoS Gift` | string | Gift/offer status (`Yes`, `Only Offer`) |
| `Contact Details` | string | Contact notes (e.g. "Don't call Key Account") |
| `Action` | enum | Visit outcome: `Executed`, `Cancelled`, `Change Visit`, `Double Visit` |
| `Reason` | enum | Reason for action (Cancelled/Change): e.g. `No Device`, `PoS Rejection`, `Closed PoS`, `Weather Conditions`, etc. |
| `Comments` | string | Free-text notes |
| `Ploom Smoker` | string | Ploom product smoker-related field (unclear — needs clarification) |
| `Comments Meeting` | string | Notes from the visit meeting |

#### Programme Types (`Program` column)

| Value | Count | Description |
|---|---|---|
| `Permanent` | 228 | JTI direct employee on a permanent contract. Name populated in `Brand Ambassador`. |
| `Radical` | 161 | External collaborator (third-party). No `Brand Ambassador` name. No `Base` city. |
| `Exclusive` | 39 | JTI employee on an exclusive contract. Name populated in `Brand Ambassador`. |

---

### Sheet: `Personnel`

Master list of all JTI promoters (Permanent + Exclusive). ~46 records.

| Column | Description |
|---|---|
| `Username` | System username in format `SPC_<Lastname> <Firstname>` |
| `Promoter Code` | Unique code e.g. `GR_000072` |
| `First Name` / `Last Name` | Name |
| `Type` | `Permanent` or `Exclusive` |
| `City` | Home base city |
| `Area` | Team: `SOUTH TEAM` (Athens-based) or `NORTH TEAM` (Thessaloniki-based) |

---

### Sheet: `CDB List`

Master POS registry. ~866 records.

| Column | Description |
|---|---|
| `CDB Code` | Unique POS identifier |
| `POS Name` | Name |
| `Pos Classification` | `Strategic`, `BaseLine` |
| `Type` | POS category |
| `Address`, `City`, `County` | Location |
| `Geography - geo_Department`, `District`, `Territory` | Sales geography hierarchy |
| `W/H` | Warehouse/distributor |
| `Chain` | Retail chain |
| `Contractor` | Contract owner (`JTI`, `Competition`, `Owner`) |
| `Contact Details` | Contact notes |
| `PoS Gift` | Gift eligibility |
| `Action`, `Reason`, `Comments` | Current status flags |
| `Telephone`, `Mobile` | Contact numbers |
| `Trade Offer`, `EVO_RetentionOffer` | Offer flags |

---

### Sheet: `Priority`

POS-level analysis with recommended visit windows. Used to inform scheduling decisions.

Key columns beyond standard POS fields:

| Column | Description |
|---|---|
| `pos_VolumeClass` | Volume class of POS (A, B, Γ) |
| `# of Programs LTD` | Total visits to date |
| `# of Sold Devices LTD` | Total devices sold to date |
| `Av. Sold Device LTD` | Average devices sold per visit |
| `Suitable for SWAP` | Whether POS is suitable for SWAP programme |
| `Priority` | Recommended priority tier |
| `In Program` | Whether POS is currently in active programme |
| `Day 1/2/3` | Recommended visit days |
| `Time 1/2/3` | Recommended visit times |
| `W44–W48` | Weekly visit tracking columns |

---

### Sheet: `schedules`

**Output template** — the structured format the tool should produce to feed downstream systems.

| Column | Description |
|---|---|
| `scheduleCode` | Sequential schedule ID |
| `tenantCode` | Country tenant (`gr` for Greece) |
| `promoterCode` | Promoter code (e.g. `GR_000069`) |
| `agencyCode` | Agency (`SPC`) |
| `posCode` | POS code in format `GR_<7-digit>` |
| `startAt` | ISO datetime string (e.g. `2025-09-29T09:00`) |
| `endAt` | ISO datetime string |

---

### Sheet: `Strategic PoS_Montly Plan`

Monthly planning view of strategic POS — higher-level schedule grid (not per-activity row).

### Sheet: `Detailed Pan Provences`

Detailed province-level planning breakdown.

### Sheet: `DropDownLists`

Reference values for dropdown fields used in the schedule:

- **Action**: `Change Visit`, `Cancelled`, `Double Visit`, `Executed`
- **Reason**: `No Device`, `Brand Ambassador`, `New PoS`, `PoS Rejection`, `Competitors Activities`, `No Reason`, `Deny Promotion Activities`, `No Device & Sticks`, `No Sticks`, `Closed PoS`, `Closed PoS / Temporary`, `JTI`, `Tactical Routing`, `OOS (during activity)`, `Communication`, `Cover change`, `Weather Conditions`, `Offers problem`, `Filters`, `Radical`, `Other`
- **Trade Offer**: `Dev+3packs: 29€`, `Device+3packs: 29€`
- **PoS Gift**: `Yes`, `No`

---

## Open Questions & Clarifications Needed

This is an early-stage PoC. The following questions are unresolved and should be clarified with stakeholders before building the scheduling logic. More may emerge as development progresses.

### Promoter / Programme types

1. **`Radical` programme roster** — Radical promoters (external collaborators) do not appear in the `Personnel` sheet. How are they identified and assigned? Do they come from a specific agency with their own codes, or are they treated as an interchangeable pool? Is there a separate roster for them?

2. **`Exclusive` vs `Permanent`** — Both appear in `Personnel` as JTI employees. What is the practical distinction? Is `Exclusive` a third-party contractor exclusively dedicated to JTI (not on direct payroll), while `Permanent` is a full-time direct hire?

3. **`Base` column** — Appears to be the promoter's home city; always null for `Radical` rows. Is that because Radical promoters are local to the POS area and don't have a tracked base, or simply that the data isn't captured?

### Scheduling logic & output

4. **`schedules` sheet as output target** — This sheet looks like a structured output template (`promoterCode`, `posCode`, `startAt`, `endAt`) meant to feed a downstream system. Is the primary deliverable of this tool rows in this format, and what system consumes it?

5. **`Priority` sheet: `Day 1/2/3` + `Time 1/2/3`** — Are these the manually determined optimal visit slots per POS that the AI tool should learn to generate automatically? If so, are they the ground truth for model training/validation?

### POS & territory data

6. **`W/H` column** — Is the warehouse/distributor relevant to scheduling? E.g. are certain promoters tied to specific distributors, or does it only affect logistics?

7. **`Contractor` column** (`JTI`, `Competition`, `Owner`) — Does the contractor type affect which POS gets scheduled, which programme type is used, or which promoter is assigned?

---

## Business Context

### What this tool is

An AI-powered **promoter scheduling application** being piloted in **JTI Greece**. It automates the planning of promoter/informer visits to Points of Sale (POS — retail kiosks) to maximise sales impact.

### The problem being solved

Currently, the scheduling process is entirely manual:

- **Manual planning**: Field teams check each POS individually in BI tools to identify the best visit times — slow and error-prone.
- **Complex resource allocation**: Deciding visit frequency per kiosk based on day/time, assigned promoter, and customer traffic requires human judgement and is hard to optimise at scale.
- **Suboptimal timing**: Visits often happen during low-traffic periods, reducing sales opportunities and wasting promoter time.

### Available input data

Historical activity data with the following fields:

| Field | Description |
|---|---|
| Activity start & end date/time | When the visit occurred |
| POS code & location | Which kiosk was visited |
| Devices sold per activity | Sales outcome of each visit |
| Interviews conducted | Engagement metric per visit |
| Assigned informer/promoter | Which promoter ran the activity |
| Day/time execution patterns | Recurring scheduling patterns |

### Expected outputs from the tool

1. **Complete visit plan per POS** — automated recommendations for day, time, visit frequency, and promoter assignment.
2. **Peak time detection** — identifies high-traffic, high-sales time windows per POS from historical data.
3. **Optimised visit frequency** — suggests how often each POS should be visited to maximise sales impact.
4. **Promoter–POS matching** — matches the most effective promoter/informer to each POS and time slot based on past performance.
5. **Exportable output** — full visit plan exportable as Excel, CSV, or PDF for field execution.

### Scope

This repository is a **pilot POC for Greece**. The goal is to validate the technical approach and business value before broader rollout.

---

## Project Structure

```
jti-promotion-scheduling-poc/
├── CLAUDE.md
├── Makefile
├── .github/
│   └── workflows/
│       └── ci.yml              # Lint checks on push/PR to main
├── backend/                    # Django + DRF API
│   ├── .venv/                  # Python 3.14 venv (managed by uv)
│   ├── manage.py
│   ├── setup.cfg               # flake8 + isort config
│   ├── pyproject.toml          # black config
│   ├── config/                 # Django project (settings, urls, wsgi, asgi)
│   └── api/                    # All /api/* endpoints
└── frontend/                   # React 19 + Vite 6
    ├── package.json
    ├── vite.config.js           # proxies /api → :8000
    ├── eslint.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              # Router + AuthProvider
        ├── index.css            # Global styles (Inter font, dark bg)
        ├── theme.js             # JTI color tokens
        ├── context/
        │   └── AuthContext.jsx  # JWT auth state, login/logout helpers
        ├── components/
        │   ├── JtiLogo.jsx      # SVG JTI logo
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── LoginPage.jsx
            └── HomePage.jsx
```

---

## Backend

### Python Environment

- Virtual environment: `backend/.venv/` (Python 3.14)
- Dependency manager: **uv** (installed inside the venv)
- uv binary: `backend/.venv/Scripts/uv.exe`

**Never use `pip` directly or `requirements.txt`. Always use `uv`.**

```bash
# Install a package
backend/.venv/Scripts/uv.exe pip install <package>

# Activate venv (PowerShell)
backend/.venv/Scripts/Activate.ps1
```

### Stack

- Django 6.x
- Django REST Framework
- djangorestframework-simplejwt — JWT auth
- django-cors-headers

### Authentication

- JWT via `djangorestframework-simplejwt`
- Access token lifetime: **8 hours**
- Refresh token lifetime: **7 days**, rotation enabled
- Token blacklist enabled (logout invalidates refresh token)

| Endpoint            | Method | Auth required | Description             |
|---------------------|--------|---------------|-------------------------|
| `/api/auth/login/`  | POST   | No            | Returns access + refresh tokens |
| `/api/auth/logout/` | POST   | Yes           | Blacklists refresh token |
| `/api/auth/me/`     | GET    | Yes           | Returns current username |
| `/api/hello/`       | GET    | Yes           | Hello world             |

All endpoints require authentication by default (`IsAuthenticated` as DRF default).

### User Management

No registration from frontend — users are created via **Django Admin** at `/admin/`.

```bash
make be-createsuperuser   # create first admin user
```

### Linting (Python)

| Tool   | Purpose             | Config           |
|--------|---------------------|------------------|
| black  | Code formatter      | `pyproject.toml` |
| isort  | Import sorter       | `setup.cfg`      |
| flake8 | Style/error checker | `setup.cfg`      |

- `max-line-length = 88` (matches black)
- `.venv` and `migrations` excluded from all tools

---

## Frontend

- Framework: React 19 + Vite 6
- Directory: `frontend/`
- Dev server proxies `/api` → `http://localhost:8000`

### Auth Flow

1. Unauthenticated users are redirected to `/login`
2. Login page posts credentials to `/api/auth/login/`
3. Access + refresh tokens stored in `localStorage`
4. `authHeaders()` helper injects `Authorization: Bearer <token>` on API calls
5. Logout calls `/api/auth/logout/` (blacklists refresh token) and clears storage

### Theming

JTI brand colors defined in `src/theme.js`:

| Token        | Value     | Usage                     |
|--------------|-----------|---------------------------|
| `bgPage`     | `#141414` | Page background           |
| `bgCard`     | `#1e1e1e` | Cards, forms              |
| `bgNavbar`   | `#0f0f0f` | Navbar                    |
| `bgInput`    | `#2a2a2a` | Input fields              |
| `text`       | `#ffffff` | Primary text              |
| `textMuted`  | `#aaaaaa` | Secondary text            |
| `border`     | `#2e2e2e` | Borders                   |
| `buttonBg`   | `#ffffff` | Primary button background |
| `buttonText` | `#141414` | Primary button text       |

Font: **Inter** (Google Fonts)

### Linting (JS)

| Tool   | Purpose | Config             |
|--------|---------|--------------------|
| ESLint | Linter  | `eslint.config.js` |

Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

---

## Makefile Commands

```bash
make help                # List all commands

# Backend
make be-run              # Django dev server (:8000)
make be-migrate          # Apply migrations
make be-makemigrations   # Create migrations
make be-install          # Install backend deps via uv
make be-createsuperuser  # Create Django admin superuser
make be-lint             # Format + lint (auto-fix)
make be-lint-check       # Format + lint (CI mode, no changes)

# Frontend
make fe-run              # Vite dev server (:5173)
make fe-install          # npm install
make fe-build            # Production build
make fe-lint             # ESLint

# Combined
make install             # Install all deps
make lint                # Run all linters in CI mode
```

---

## CI (GitHub Actions)

File: `.github/workflows/ci.yml`

Triggers: push to `main`, PRs targeting `main`

| Job            | Steps                                |
|----------------|--------------------------------------|
| backend-lint   | black --check, isort --check, flake8 |
| frontend-lint  | npm ci, eslint                       |

---

## Dev Ports

| Service      | Port |
|--------------|------|
| Django API   | 8000 |
| React / Vite | 5173 |
| Django Admin | 8000/admin |
