# Project 23: Set up a honeypot to gather threat data

## Overview

Advanced honeypot setup using Cowrie for SSH/Telnet honeypot functionality.

## Features

- Fake SSH/Telnet with full shell simulation
- Downloads attacker tools for analysis
- Records all commands executed
- IP geolocation tracking
- JSON logging for analysis

## Setup

```bash
cd 23-honeypot-advanced
chmod +x cowrie_setup.sh
sudo ./cowrie_setup.sh install
```

## Usage

```bash
sudo ./cowrie_setup.sh start   # Start honeypot
sudo ./cowrie_setup.sh logs    # View logs
sudo ./cowrie_setup.sh status  # Check status
```

## Log Location

- `/opt/cowrie/var/log/cowrie/` - Log files
- `/opt/cowrie/var/lib/cowrie/downloads/` - Downloaded malware

## Production Honeypots

| Tool | Protocol | Complexity |
|------|----------|-------------|
| Cowrie | SSH/Telnet | Low |
| Dionaea | Multiple | Medium |
| T-Pot | Many | High |
| HoneyTrap | Multiple | Medium |
