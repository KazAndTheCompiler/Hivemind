#!/bin/bash
# Snort IDS Setup - Project 14
# Install and configure Snort intrusion detection system

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║     Snort IDS Setup - Project 14                              ║
╚════════════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[!] Please run as root${NC}"
    exit 1
fi

echo -e "${GREEN}[*] Installing Snort...${NC}"

# Detect OS
if [ -f /etc/debian_version ]; then
    apt-get update
    apt-get install -y snort
    
elif [ -f /etc/redhat-release ]; then
    yum install -y snort
    
else
    echo "[!] Unsupported OS"
    exit 1
fi

echo -e "${GREEN}[+] Snort installed${NC}"

# Configure Snort
SNORT_CONF="/etc/snort/snort.conf"

if [ -f "$SNORT_CONF" ]; then
    echo "[*] Configuring Snort..."
    
    # Set HOME_NET (adjust for your network)
    read -p "Enter your network range [192.168.1.0/24]: " HOME_NET
    HOME_NET=${HOME_NET:-192.168.1.0/24}
    
    sed -i "s/ipvar HOME_NET any/ipvar HOME_NET $HOME_NET/" "$SNORT_CONF"
    
    # Enable alerts
    sed -i 's/output alert_unified2.*/output alert_unified2: filename snort.alert, limit 128/' "$SNORT_CONF"
    
    echo -e "${GREEN}[+] Snort configured${NC}"
    echo "[*] HOME_NET set to: $HOME_NET"
else
    echo "[!] Snort config not found at $SNORT_CONF"
fi

echo ""
echo "============================================================"
echo "SNORT BASIC USAGE"
echo "============================================================"
echo ""
echo "Test mode (dry run):"
echo "  sudo snort -T -c /etc/snort/snort.conf -i <interface>"
echo ""
echo "Start IDS (promiscuous mode):"
echo "  sudo snort -A console -c /etc/snort/snort.conf -i <interface>"
echo ""
echo "Example:"
echo "  sudo snort -A console -c /etc/snort/snort.conf -i eth0"
echo ""
echo "View alerts:"
echo "  tail -f /var/log/snort/alert"
echo ""
echo "============================================================"
echo -e "${GREEN}[+] Snort setup complete${NC}"
