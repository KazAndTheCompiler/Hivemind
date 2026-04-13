# Project 1: Set up a basic honeypot to catch attackers

## Overview

A **honeypot** is a security mechanism that creates a decoy system to detect, deflect, and study attacker behavior. This project implements a low-interaction SSH honeypot that logs connection attempts and credentials tried by attackers.

## What it does

- Listens on port 2222 (non-standard SSH port)
- Accepts SSH connections and logs all attempts
- Records source IP, username, and password for each auth attempt
- Tracks attacker IPs over time (unique visits, attempt counts)
- Generates summary statistics of attacking sources

## Files

```
01-honeypot-basic/
├── honeypot.py          # Main honeypot script
├── setup.sh             # Installation script
├── logs/
│   ├── access.log       # All connection events (JSON)
│   ├── credentials.log  # Credential attempts (CSV)
│   └── ip_summary.json  # Aggregated IP statistics
└── README.md
```

## Quick Start

```bash
# Run the honeypot
cd 01-honeypot-basic
sudo python3 honeypot.py

# In another terminal, test with SSH
ssh -p 2222 testuser@your-server-ip
# Try password: testpassword
```

## Setup Script

The `setup.sh` script:
1. Checks for Python 3.8+
2. Installs dependencies (none required - uses stdlib only)
3. Creates a systemd service for auto-start
4. Configures firewall rules (optional)
5. Starts the honeypot

```bash
chmod +x setup.sh
sudo ./setup.sh
```

## Log Output

### access.log (JSON)
```json
{"timestamp": "2026-04-12T10:30:00+00:00", "type": "connection", "ip": "192.168.1.100", "port": 54321, "status": "accepted"}
{"timestamp": "2026-04-12T10:30:05+00:00", "type": "credentials", "ip": "192.168.1.100", "username": "root", "password": "123456"}
```

### credentials.log (CSV)
```
2026-04-12T10:30:05+00:00,192.168.1.100,root,123456
2026-04-12T10:30:07+00:00,192.168.1.100,admin,password
```

### ip_summary.json
```json
{
  "192.168.1.100": {
    "count": 15,
    "usernames": ["root", "admin", "ubuntu"],
    "passwords": ["123456", "password", "qwerty"],
    "first_seen": "2026-04-12T10:00:00+00:00",
    "last_seen": "2026-04-12T11:30:00+00:00"
  }
}
```

## Honeypot vs Production SSH

| honeypot (this) | Real SSH |
|----------------|----------|
| Logs everything | Actual access |
| No real shell | Real shell |
| Port 2222 | Port 22 |
| Decoy only | Production |

## Security Notes

1. **Never run as root in production** - Use a dedicated user with limited permissions
2. **Network segmentation** - Place honeypot in DMZ or isolated network
3. **Don't expose on port 22** - Keep real SSH on 22, honeypot on different port
4. **Monitor disk space** - Logs can grow rapidly under attack
5. **Legal considerations** - Document that this is a honeypot in your jurisdiction

## Real Honeypots (Production)

For real deployments, consider:
- **Cowrie** - Full SSH/Telnet honeypot with filesystem simulation
- **Dionaea** - Malware honeypot (grabs malware samples)
- **T-Pot** - Full honeypot distro with multiple honeypots
- **HoneyTrap** - Low-interaction honeypot for protocols

## Enhancement Ideas

- [ ] Add regex patterns to detect scanning tools
- [ ] Add geo-IP tracking to map attacker locations
- [ ] Add alerting (email/webhook on new IP)
- [ ] Add connection graphs/statistics visualization
- [ ] Implement fake FTP/HTTP services
- [ ] Add integration with AbuseIPDB for reporting
