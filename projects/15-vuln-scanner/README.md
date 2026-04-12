# Project 15: Use tools to find system vulnerabilities

## Overview

Service detection and CVE vulnerability scanner.

## ⚠️ Legal Warning

**Only scan systems you own or have permission to scan.**

## Quick Start

```bash
cd 15-vuln-scanner

# Scan target
python3 nvd_scan.py 192.168.1.1

# Scan specific ports
python3 nvd_scan.py 192.168.1.1 -p 22,80,443,3306
```

## What It Does

1. **Port Scanning** - Checks common vulnerable ports
2. **Banner Grabbing** - Identifies service versions
3. **CVE Matching** - Checks against known vulnerabilities
4. **Report Generation** - Prioritized remediation guidance

## CVEs Checked

| Service | CVE Examples |
|---------|-------------|
| OpenSSH | CVE-2023-48795, CVE-2020-15778 |
| Apache | CVE-2021-44790, CVE-2021-40438 |
| nginx | CVE-2021-23017 |
| MySQL | CVE-2021-2432 |
| Redis | CVE-2021-32761 |

## Severity Levels

| Level | Action |
|-------|--------|
| CRITICAL | Fix within 24 hours |
| HIGH | Fix within a week |
| MEDIUM | Fix within a month |

## Professional Tools

- **Nmap** - Network discovery and port scanning
- **Nikto** - Web server vulnerability scanner
- **OpenVAS** - Full vulnerability scanner
- **Nessus** - Professional vulnerability assessment
- **Qualys** - Cloud-based scanning
- **nexpose** - Rapid7 vulnerability scanner
