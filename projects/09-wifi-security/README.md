# Project 9: Test Wi-Fi security at home

## Overview

A Wi-Fi security auditing toolkit for testing your home network security. Identifies weak encryption, default configurations, and captures handshakes for authorized password auditing.

## ⚠️ Legal Warning

**Only use this on:**
- Your own home network
- Networks you have explicit written permission to test
- Networks you own and control

**Never use this for:**
- Connecting to neighbors' networks
- Testing networks without authorization
- Any unauthorized network access

## What It Does

- **Network Discovery** - Finds all Wi-Fi networks in range
- **Security Analysis** - Grades each network's encryption
- **Handshake Capture** - Captures WPA handshakes for password auditing
- **Reporting** - Generates comprehensive security reports

## Requirements

### Hardware
- Wireless card supporting **monitor mode** (not all cards support this)
- USB wireless adapters with Atheros, Ralink, or Realtek chipsets work well

### Software
```bash
sudo apt install aircrack-ng
```

### Common Compatible Adapters
- Alfa AWUS036NHA (Atheros)
- Alfa AWUS036ACH (Realtek)
- TP-Link TL-WN722N (Atheros - v1 only)

## Quick Start

```bash
cd 09-wifi-security

# Full audit with monitor mode
sudo python3 wifi_audit.py -i wlan0 -d 60

# Scan only (monitor mode already enabled)
sudo python3 wifi_audit.py -i wlan0mon --skip-monitor

# Longer scan for handshake capture
sudo python3 wifi_audit.py -i wlan0 -d 120
```

## Understanding the Grades

| Grade | Encryption | Assessment |
|-------|-----------|------------|
| **A** | WPA3 | Excellent - current best practice |
| **B** | WPA2-AES | Good - standard secure encryption |
| **C** | WPA (TKIP) | Fair - outdated but not immediately cracked |
| **F** | WEP | Fail - cracked in minutes |
| **F** | Open | Fail - no encryption |

## Security Checklist

### Your Router Should Have:

- [ ] **WPA3 or WPA2-AES** encryption (NOT WPA TKIP or WEP)
- [ ] **Unique SSID** (not default "linksys", "NETGEAR", etc.)
- [ ] **Strong password** (12+ chars, mixed case, numbers, symbols)
- [ ] **WPS disabled** (easily cracked)
- [ ] **Firmware updated** (check for security updates)
- [ ] **Router admin password changed** (not "admin/admin")
- [ ] **Firewall enabled** (if available)

## Handshake Capture Explained

1. **What is a handshake?** - The data exchanged when a device connects to Wi-Fi
2. **Why capture it?** - Contains encrypted password hash that can be cracked offline
3. **How to prevent it?** - Use WPA3 (not yet crackable), long complex passwords

### Cracking a Captured Handshake

```bash
# Convert pcap to hashcat format
python3 ~/hashcat-utils/src/cap2hashcat.py handshake.pcap > handshake.hc22000

# Crack with wordlist
hashcat -m 22000 handshake.hc22000 wordlist.txt

# Or with rules
hashcat -m 22000 handshake.hc22000 wordlist.txt -r rules/best64.rule
```

## Home Network Security Guide

### Step 1: Access Your Router
```bash
# Find router IP
ip route | grep default
# Usually 192.168.1.1 or 192.168.0.1

# Access via browser
# Default credentials often printed on router bottom
```

### Step 2: Change Default Settings
1. **SSID** - Something unique (not your name or address)
2. **Admin password** - Different from Wi-Fi password
3. **Wi-Fi password** - 12+ random characters

### Step 3: Enable Security
- WPA2/WPA3 with AES encryption
- Disable WPS (Wi-Fi Protected Setup)
- Enable router firewall
- Disable remote management from internet

### Step 4: Update Firmware
Check router manufacturer's website for updates.

## Files

```
09-wifi-security/
├── wifi_audit.py       # Main auditing script
├── README.md          # This file
└── logs/             # Scan results and handshakes
    ├── wifi_audit_*.json
    ├── handshake_*.pcap
    └── scan_*.csv
```

## Professional Tools

- **Wireshark** - Packet analysis
- **Kismet** - Wireless detector and IDS
- **Fern WiFi Cracker** - GUI wireless auditing
- **Fluxion** - WPA handshake attacks (educational only)
- **Hashcat** - GPU password cracking

## Warning Signs Your Network May Be Compromised

- Unknown devices connected to your network
- Internet slowdown without explanation
- Router settings changed without your knowledge
- Unexplained data usage spikes
