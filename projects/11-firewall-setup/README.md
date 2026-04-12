# Project 11: Configure firewall rules to block threats

## Overview

Firewall setup script for securing VPS servers using UFW (Uncomplicated Firewall).

## Quick Start

```bash
cd 11-firewall-setup

# Run firewall setup
chmod +x firewall_setup.sh
sudo ./firewall_setup.sh

# With custom SSH port
sudo ./firewall_setup.sh 2222
```

## What's Configured

### Default Policies
- **Incoming**: DENY (default block)
- **Outgoing**: ALLOW (default allow)

### Allowed Ports
| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | Remote access |
| 80 | HTTP | Web traffic |
| 443 | HTTPS | Secure web |
| 2222 | SSH (optional) | Custom SSH |

### Security Features
- Rate limiting on SSH (prevents brute force)
- Default deny incoming
- IPv6 enabled

## UFW Commands

```bash
# Check status
sudo ufw status verbose

# Allow a port
sudo ufw allow 8080/tcp

# Deny a port
sudo ufw deny 3306/tcp

# Delete a rule
sudo ufw delete allow 8080/tcp

# Reset to defaults
sudo ufw --force reset

# Disable firewall
sudo ufw disable

# View numbered rules
sudo ufw status numbered
```

## Firewall Best Practices

1. **Always allow SSH before enabling**
2. **Use non-standard SSH port** (but don't rely on it alone)
3. **Enable rate limiting** on SSH
4. **Block unused ports**
5. **Log dropped packets** for analysis
6. **Regular review** of rules
