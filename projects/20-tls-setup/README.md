# Project 20: Set up TLS for secure communication

## Overview

TLS/SSL setup guide for securing web services.

## Setup

```bash
cd 20-tls-setup

# Generate self-signed certificate
chmod +x tls_setup.sh
./tls_setup.sh selfsigned localhost

# Generate Let's Encrypt certificate
./tls_setup.sh letsencrypt yourdomain.com

# Check certificate
./tls_setup.sh check server.crt

# Test TLS
./tls_setup.sh test localhost 443

# Show nginx config
./tls_setup.sh nginx
```

## TLS Best Practices

1. **Use TLS 1.2 or 1.3 only** - Disable older versions
2. **Strong ciphers** - ECDHE with AES-128/256
3. **HSTS** - Force HTTPS
4. **OCSP Stapling** - Faster validation
5. **Let's Encrypt** - Free certificates

## Certificate Types

| Type | Use Case |
|------|----------|
| Self-signed | Development only |
| Let's Encrypt | Production (free) |
| Commercial CA | Enterprise trust |

## Key Commands

```bash
# Check certificate
openssl x509 -in cert.crt -noout -dates

# Test TLS connection
openssl s_client -connect host:443

# Convert PEM to PKCS12
openssl pkcs12 -export -in cert.pem -inkey key.pem -out cert.p12
```
