# Project 2: Create a simple password cracker

## Overview

A demonstration password cracker showing common attack techniques. This is **strictly for educational purposes** - understanding how weak passwords are cracked is essential for building better defenses.

## ⚠️ Legal Warning

**Only use this on:**
- Passwords you own
- Systems you have explicit written permission to test
- Educational/demo environments

**Never use this for:**
- Unauthorized access to systems
- Cracking other people's passwords without consent
- Any illegal activity

## Attack Methods Implemented

### 1. Dictionary Attack
Tries every word in a wordlist against the hash.
- Fast (millions of guesses per second)
- Catches predictable passwords ("password123", "letmein!")

### 2. Brute Force Attack
Tries ALL possible character combinations.
- Guaranteed to find the password (if short enough)
- Computationally expensive - grows exponentially
- Only practical for passwords ≤ 6 characters with this implementation

### 3. Hybrid Attack
Combines dictionary + systematic variations.
- Appends numbers ("password1", "password2024")
- Appends symbols ("password!", "password!!")
- Catches people who think "password1" is secure

### 4. Quick Lookup
Precomputed hashes of the most common passwords.
- Instant result for trivially weak passwords
- Demonstrates why "123456" and "password" are never acceptable

## Quick Start

```bash
cd 02-password-cracker

# Run demo mode
python3 password_cracker.py --demo

# Crack a known MD5 hash
python3 password_cracker.py 5f4dcc3b5aa765d61d8327deb882cf99

# Use SHA1
python3 password_cracker.py 5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8 sha1
```

## Why This Matters (For Defense)

Understanding these attacks helps you:

1. **Know what attackers try first** - Dictionary attacks with rockyou.txt catch 30%+ of passwords
2. **Set minimum password requirements** - 8+ chars, mixed case, numbers, symbols
3. **Implement rate limiting** - Slow down brute force attempts
4. **Use password managers** - Unique random passwords per service
5. **Enable MFA** - Even cracked passwords can't help attackers with MFA

## Real Cracking Tools (For Learning)

- **Hashcat** - GPU-accelerated, millions of hashes/second
- **John the Ripper** - Comprehensive, many hash types
- **Hydra** - Online password attacks (SSH, HTTP, etc.)
- **CeWL** - Generate custom wordlists from websites

## Files

```
02-password-cracker/
├── password_cracker.py    # Main cracker
├── README.md             # This file
└── logs/
    └── cracked.json      # Results of cracking sessions
```

## Performance Notes

| Password Length | Charset | Combinations | Time (10M/sec) |
|----------------|---------|--------------|----------------|
| 4 | lowercase | 457,000 | 0.05 sec |
| 5 | lowercase | 11.8M | 1.2 sec |
| 6 | lowercase | 308M | 31 sec |
| 7 | lowercase | 8B | 13 min |
| 8 | mixed case+nums | 218T | 6.9 years |

This is why **length beats complexity** for password security.
