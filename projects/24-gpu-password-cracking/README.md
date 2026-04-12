# Project 24: Practice cracking passwords with GPUs

## Overview

Guide to GPU-accelerated password cracking with hashcat.

## ⚠️ Legal Warning

**Only crack passwords you own or have explicit permission to test.**

## Setup

```bash
cd 24-gpu-password-cracking
./hashcat_guide.sh
```

## Speed Comparison

| Method | Speed |
|--------|-------|
| CPU | ~100 million/sec |
| GPU (RTX 3090) | ~50 billion/sec |
| Cluster | Trillions/sec |

## Protection

To resist GPU cracking:
- 12+ character passwords
- Mix of character types
- Unique per service
- MFA whenever possible
