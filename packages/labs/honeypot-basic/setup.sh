#!/bin/bash
# honeypot-setup.sh — Install and configure the SSH honeypot

set -e

HONEYPOT_DIR="$(cd "$(dirname "$0")" && pwd)"
HONEYPOT_USER="honeypot"
HONEYPOT_PORT=2222
LOG_DIR="$HONEYPOT_DIR/logs"

echo "╔═══════════════════════════════════════════════╗"
echo "║     Basic SSH Honeypot - Setup                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Check Python version
echo "[*] Checking Python version..."
python3 --version || { echo "[!] Python 3 required"; exit 1; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "[!] Warning: It's recommended to run as non-root user"
    echo "[*] Creating dedicated user..."
    if ! id "$HONEYPOT_USER" &>/dev/null; then
        useradd -r -s /usr/sbin/nologin "$HONEYPOT_USER"
    fi
    chown -R "$HONEYPOT_USER:$HONEYPOT_USER" "$HONEYPOT_DIR"
fi

# Create logs directory
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Create systemd service
SERVICE_FILE="/etc/systemd/system/ssh-honeypot.service"
echo "[*] Creating systemd service..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=SSH Honeypot - Basic
After=network.target

[Service]
Type=simple
User=$HONEYPOT_USER
WorkingDirectory=$HONEYPOT_DIR
ExecStart=/usr/bin/python3 $HONEYPOT_DIR/honeypot.py
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/
WritablePaths=$LOG_DIR

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
echo "[*] Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable ssh-honeypot.service

# Optional: Add firewall rule
echo ""
echo "[*] Firewall setup (optional):"
echo "    To allow honeypot port $HONEYPOT_PORT, run:"
echo "    sudo ufw allow $HONEYPOT_PORT/tcp"
echo ""
echo "    To redirect port 22 to honeypot (ADVANCED):"
echo "    sudo iptables -t nat -A PREROUTING -p tcp --dport 22 -j REDIRECT --to-port $HONEYPOT_PORT"
echo ""

# Start the honeypot
echo "[*] Starting honeypot..."
sudo systemctl start ssh-honeypot.service

# Check status
if sudo systemctl is-active --quiet ssh-honeypot.service; then
    echo ""
    echo "[+] Honeypot is running!"
    echo "    Port: $HONEYPOT_PORT"
    echo "    Logs: $LOG_DIR"
    echo "    Status: sudo systemctl status ssh-honeypot"
else
    echo "[!] Failed to start. Check logs: journalctl -u ssh-honeypot -n 50"
fi
