# Project 10: Scan networks for vulnerabilities

## Overview

A comprehensive network vulnerability scanner that identifies open ports, services, and known vulnerabilities across a network range.

## ⚠️ Legal Warning

**Only use this on:**
- Your own networks
- Networks you have explicit written permission to scan
- Bug bounty programs with proper scope

**Never use this on:**
- Networks without permission
- Government systems
- Any network where you don't have explicit authorization

## What It Does

- **Host Discovery** - Finds active hosts on the network
- **Port Scanning** - Identifies open ports and services
- **OS Fingerprinting** - Guesses operating systems via TTL
- **Vulnerability Detection** - Flags known vulnerable services
- **Reporting** - Generates detailed security reports

## Quick Start

```bash
cd 10-network-vuln-scan

# Scan a single host
python3 network_scan.py 192.168.1.1

# Scan a network range
python3 network_scan.py 192.168.1.0/24

# Scan with specific ports
python3 network_scan.py 192.168.1.1 -p 22,80,443,3389,8080
```

## Understanding Risk Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **CRITICAL** | Immediate danger, actively exploitable | Fix NOW |
| **HIGH** | Significant vulnerability | Fix within days |
| **MEDIUM** | Moderate risk | Fix within weeks |
| **LOW** | Minor issue | Fix when convenient |

## Critical Ports to Close

| Port | Service | Why Dangerous |
|------|---------|---------------|
| 21 | FTP | Clear text, anonymous access |
| 23 | Telnet | No encryption, easily intercepted |
| 139, 445 | SMB | EternalBlue, lateral movement |
| 3389 | RDP | BlueKeep, brute force |
| 5900 | VNC | No encryption, weak auth |
| 6379 | Redis | No auth by default |
| 27017 | MongoDB | No auth by default |

## Sample Report

```
================================================================
NETWORK VULNERABILITY SCAN REPORT
================================================================

Target: 192.168.1.0/24
Scan Time: 2026-04-12T10:30:00+00:00

----------------------------------------------------------------
SUMMARY
----------------------------------------------------------------

Hosts Scanned: 5
Critical Issues: 2
High Issues: 3
Medium Issues: 1

----------------------------------------------------------------
HOST DETAILS
----------------------------------------------------------------

192.168.1.1 (router.local)
  OS: Linux/Unix
  Status: up
  Open Ports: 3
    22/ssh
    53/domain
    80/http

192.168.1.50 (server.local)
  OS: Windows
  Status: up
  Open Ports: 8
    22/ssh
    80/http
    443/https
    3306/mysql
    3389/rdp
    8080/http-proxy

VULNERABILITIES FOUND:
  [!] Port 3389 (RDP) - CRITICAL
      - BlueKeep vulnerability
      - Brute force attacks possible
      - Should require VPN or MFA

  [!] Port 3306 (MySQL) - CRITICAL
      - Default root account
      - SQL injection risk
      - Should not be exposed
```

## Home Network Security Scan

```bash
# Find your network range (usually 192.168.x.0/24)
ip route | grep default

# Example:
# default via 192.168.1.1 dev eth0

# Scan your network
python3 network_scan.py 192.168.1.0/24
```

## Mitigation Steps

### Immediate Actions

1. **Disable Telnet** - Use SSH instead
2. **Close RDP** - If not needed, disable completely
3. **Secure Databases** - Bind to localhost, use strong passwords
4. **Update Firmware** - Router and all devices

### Firewall Rules

```bash
# Block all inbound except SSH/HTTPS
sudo ufw default deny incoming
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP  
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Port-Specific Fixes

| Port | Fix |
|------|-----|
| 21 | Disable FTP, use SFTP/SCP |
| 23 | Disable Telnet, use SSH |
| 3389 | Require VPN, enable NLA |
| 445 | Block at firewall unless needed |
| 3306 | Bind to 127.0.0.1, use firewall |
| 5900 | Disable if not used, or use SSH tunnel |

## Tools Used

- **socket** - Python built-in for basic scanning
- **nmap** - Network exploration and security auditing (if installed)
- **ping** - Host discovery via ICMP

## Professional Scanning Tools

- **nmap** - The gold standard for network scanning
- **Nessus** - Professional vulnerability assessment
- **OpenVAS** - Open source vulnerability scanner
- **Nikto** - Web server vulnerability scanner
- **Qualys** - Cloud-based scanning service

## Files

```
10-network-vuln-scan/
├── network_scan.py      # Main scanner
├── README.md           # This file
└── logs/              # Scan results
    └── scan_*.json
```
