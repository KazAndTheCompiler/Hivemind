# Secrets and Binds

Status: draft
Date: 2026-04-22

## Current guidance

Use one real `.env` or a secret store for local development, but keep bindings separated by concern.

Recommended split:

- **Model/provider bind**
  - `OPENROUTER`
  - `OPENCODE`
  - `DEEPSEEK`
  - `GOOGLE_API`
  - `NVIDIA`

- **Mega bind**
  - `MEGA_EMAIL`
  - `MEGA_PASSWORD`

- **GitHub bind**
  - `GITHUB_TOKEN`

## Why split binds

Even if a single `.env` exists locally, operational ownership is cleaner when integrations stay grouped by purpose.
That makes rotation, least-privilege, and future vault migration easier.

## House rule

- never print secret values into logs, docs, or handoffs
- use `.env.example` for shape only
- prefer provider-specific keys over one giant mixed blob when wiring production or shared environments

## Next step

If Hivemind gets a real config loader for these integrations, it should:

1. normalize env naming
2. validate required keys at startup
3. report missing keys by name only, never by value
