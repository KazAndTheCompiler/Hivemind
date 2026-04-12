# Project 14: Set up and use Snort for intrusion detection

## Overview

Setup script for Snort IDS (Intrusion Detection System) on Linux.

## What is Snort?

Snort is an open-source network intrusion detection system (NIDS) that:
- Monitors network traffic
- Analyzes packets for malicious activity
- Generates alerts for suspicious traffic
- Can operate in three modes: Sniffer, Packet Logger, and NIDS

## Quick Start

```bash
cd 14-snort-ids

# Run setup (installs Snort)
chmod +x snort_setup.sh
sudo ./snort_setup.sh

# Test configuration
sudo snort -T -c /etc/snort/snort.conf -i eth0

# Run IDS
sudo snort -A console -c /etc/snort/snort.conf -i eth0
```

## Common Rules

```
# Detect SSH connection attempts
alert tcp any any -> $HOME_NET 22 (msg:"SSH connection"; sid:1000001;)

# Detect ping sweep
alert icmp any any -> $HOME_NET any (msg:"ICMP Ping"; sid:1000002;)

# Detect port scan
alert tcp any any -> $HOME_NET any (flags:S; msg:"Port Scan"; sid:1000003;)
```

## Rule Locations

- `/etc/snort/rules/` - Local rules
- `/etc/snort/rules/local.rules` - Your custom rules

## Snort Modes

| Mode | Purpose |
|------|---------|
| Sniffer | Display packet headers |
| Packet Logger | Save packets to disk |
| NIDS | Alert on suspicious traffic |

## Resources

- snort.org - Official site
- snort.org/documents - Documentation
- Emerging Threats - Free rule sets
