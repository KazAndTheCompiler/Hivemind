# Project 16: Practice detecting DNS spoofing attacks

## Overview

Tools to detect DNS cache poisoning and spoofing attacks.

## What It Detects

1. **Transaction ID anomalies** - Suspiciously low/sequential IDs
2. **Response timing** - Too-fast responses indicate pre-generated packets
3. **Source verification** - Unexpected DNS server responses
4. **Cache timing analysis** - Cache poisoning detection

## Usage

```bash
cd 16-dns-spoofing-detection
python3 dns_security.py
```

## Detection Methods

| Method | What It Catches |
|--------|-----------------|
| Timing Analysis | Responses < 5ms are suspicious |
| Transaction ID | Low/sequential IDs |
| Source Verification | Wrong DNS server |
| DNSSEC | Invalid signatures |

## Protection

- Use DNSSEC
- Use DNS-over-HTTPS (DoH)
- Use trusted DNS (8.8.8.8, 1.1.1.1)
- Monitor DNS logs
