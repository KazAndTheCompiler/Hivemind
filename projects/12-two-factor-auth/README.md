# Project 12: Create a two-factor authentication system

## Overview

TOTP (Time-based One-Time Password) implementation using pyotp.

## Setup

```bash
cd 12-two-factor-auth
pip install pyotp qrcode

# Setup user
python3 twofa.py setup myuser

# Verify token
python3 twofa.py verify myuser 123456
```

## TOTP How It Works

1. Server and phone share a secret key
2. Both generate same code using current time
3. Code changes every 30 seconds
4. Even if attacker sees code, it's useless after 30s

## Production Implementation

Use established libraries:
- **pyotp** - Python TOTP library
- **speakeasy** - Multiple OTP schemes
- **Google Authenticator** - Mobile app
- **Authy** - Multi-device support
