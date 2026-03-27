# JTI Promotion Scheduling POC

## Instructions for Claude

- After **any backend change**, run: `cd backend && ../.venv/Scripts/python.exe -m black . && ../.venv/Scripts/python.exe -m isort . && ../.venv/Scripts/python.exe -m flake8 .`
  - Or via Makefile: `make be-lint`
- After **any frontend change**, run: `cd frontend && npm run lint`
  - Or via Makefile: `make fe-lint`
- Fix all lint errors before considering a task complete.

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
