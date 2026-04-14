# DopaFlow Authentication Analysis

## Key Auth Files Identified

| File | Purpose |
|------|---------|
| `backend/app/middleware/auth.py` | Core AuthMiddleware — API key + local trust |
| `backend/app/middleware/security.py` | SecurityHeadersMiddleware — CSP, HSTS, X-Frame-Options |
| `backend/app/middleware/__init__.py` | Middleware package marker |
| `backend/app/core/config.py` | Settings: `dev_auth`, `enforce_auth`, `api_key` |
| `backend/app/main.py` | App entry, middleware stack ordering |
| `backend/tests/test_middleware.py` | Middleware tests |

## Execution Flow

### AuthMiddleware (`auth.py`)
1. `/health` path → skip auth entirely
2. `dev_auth=True` → skip auth entirely (dev bypass)
3. Loopback hosts (`127.0.0.1`, `localhost`, `::1`) + `TRUST_LOCAL_CLIENTS=1` → skip auth
4. `enforce_auth=True` → require `X-Api-Key` header, compare with `settings.api_key` via `secrets.compare_digest` (timing-safe)
5. Otherwise → pass through

### Middleware Stack (in order)
```
SecurityHeadersMiddleware → CORSMiddleware → RateLimitMiddleware → AuthMiddleware → RequestLogMiddleware
```

### Settings (`config.py`)
- `dev_auth: bool = False` — bypass all auth (dev only)
- `enforce_auth: bool = False` — globally enforce API key
- `api_key: str | None = None` — expected API key value
- `auth_token_secret: str | None = None` — JWT/Google OAuth secret (exists but not used in auth.py)
- `TRUST_LOCAL_CLIENTS` env var (also `ZOESTM_TRUST_LOCAL_CLIENTS` legacy prefix)
- `TRUSTED_HOSTS = {"127.0.0.1", "localhost", "::1"}`

## Potential Issues

1. **`enforce_auth` defaults to False** — API is open by default unless explicitly enabled
2. **Legacy env prefix** — `ZOESTM_TRUST_LOCAL_CLIENTS` supported alongside `DOPAFLOW_TRUST_LOCAL_CLIENTS`, but only for the flag itself; other settings use only `DOPAFLOW_` prefix
3. **`auth_token_secret` defined but unused** — Settings include `auth_token_secret` and `auth_token_issuer` but auth.py doesn't perform JWT/session validation
4. **No rate-limit exemption for local clients** — Even trusted hosts are rate-limited (120 req/min)
5. **No per-route auth configuration** — Single global `enforce_auth` blanket; no fine-grained route permissions
6. **API key stored in env/env file** — No secret management; plaintext in environment

## Recommendations

1. **Default `enforce_auth=True`** or require explicit env var to avoid accidental exposure
2. **Audit `auth_token_secret` usage** — If JWT/OAuth is planned, wire it into AuthMiddleware; if not, remove dead config
3. **Add local-client rate-limit exemption** — Trusted hosts should not be throttled
4. **Use a secrets vault** — Move API key to VaultBridge or proper secret store instead of env plaintext
5. **Add middleware test coverage** — `test_middleware.py` exists but doesn't cover auth bypass scenarios
