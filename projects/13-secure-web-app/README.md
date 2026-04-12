# Project 13: Build a secure web application

## Overview

Secure Flask web application demonstrating security best practices.

## Features

- **Rate Limiting** - Prevents brute force and DoS
- **CSP Headers** - Content Security Policy
- **Secure Cookies** - HttpOnly, Secure, SameSite
- **Input Validation** - Email format, password strength
- **Password Hashing** - PBKDF2 with SHA256
- **Security Headers** - X-Frame-Options, HSTS, etc.

## Setup

```bash
cd 13-secure-web-app
pip install flask flask-limiter flask-csp

# Run
python3 secure_app.py
```

## Security Checklist

- [x] Rate limiting
- [x] Input validation
- [x] Password hashing (PBKDF2)
- [x] Secure session cookies
- [x] CSP headers
- [x] Security headers

## Production Additions Needed

- HTTPS (use TLS)
- Database with parameterized queries
- CSRF protection
-CAPTCHA for registration
- Account lockout policies
- Logging and monitoring
- Security audit
