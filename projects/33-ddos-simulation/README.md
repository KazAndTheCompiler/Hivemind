# Project 33: Simulate a DDoS attack in a safe environment

## Overview

Controlled DDoS simulation for authorized security testing.

## ⚠️ Legal Warning

**Only simulate on systems you own or have written permission to test.**

## Attack Types

| Type | Description | Impact |
|------|-------------|--------|
| HTTP Flood | Request barrage | Server overload |
| TCP SYN | Half-open connections | Connection exhaustion |
| Slowloris | Slow connections | Connection hold |
| UDP Flood | UDP packets | Bandwidth saturation |

## Protection

- Rate limiting
- CDN/WAF (Cloudflare)
- Bot detection
- DDoS mitigation services
