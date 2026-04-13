#!/bin/bash
# Firewall Setup Script - Project 11
# Configure iptables/nftables for VPS security

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║     VPS Firewall Setup - Project 11                          ║
╚════════════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[!] Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}[*] Starting firewall configuration...${NC}"

# Install ufw if not present
if ! command -v ufw &> /dev/null; then
    echo "[*] Installing UFW..."
    apt-get update -qq
    apt-get install -y ufw
fi

# Default policies
echo "[*] Setting default policies..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (change port if not 22)
echo "[*] Allowing SSH on port 22..."
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS for web servers
echo "[*] Allowing HTTP/HTTPS..."
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow OpenSSH on custom port if specified
CUSTOM_SSH=2222
if [ -n "$1" ]; then
    CUSTOM_SSH=$1
fi

if [ "$CUSTOM_SSH" != "22" ]; then
    echo "[*] Also allowing SSH on custom port $CUSTOM_SSH..."
    ufw allow $CUSTOM_SSH/tcp comment "Custom SSH"
    echo "[*] Remember to: sed -i 's/Port 22/Port $CUSTOM_SSH/' /etc/ssh/sshd_config"
    echo "[*] Then restart: systemctl restart sshd"
fi

# Rate limiting for SSH
echo "[*] Enabling rate limiting on SSH..."
ufw limit 22/tcp

# Enable UFW
echo "[*] Enabling UFW..."
echo "y" | ufw enable

# Show status
echo ""
echo "============================================================"
ufw status verbose
echo "============================================================"

# Save rules
echo "[*] Saving rules..."
ufw status > /etc/ufw/ufw.conf

# Show commands to check
echo ""
echo -e "${GREEN}[+] Firewall configured successfully!${NC}"
echo ""
echo "Useful commands:"
echo "  ufw status          - Check firewall status"
echo "  ufw allow PORT      - Open a port"
echo "  ufw deny PORT       - Block a port"
echo "  ufw delete RULE     - Remove a rule"
echo "  ufw disable         - Turn off firewall"
echo "  tail -f /var/log/ufw.log - Watch firewall logs"
