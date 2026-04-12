#!/bin/bash
# Advanced Honeypot Setup - Project 23
# Install and configure Cowrie SSH honeypot

set -e

echo "
╔════════════════════════════════════════════════════════════════╗
║     Advanced Honeypot Setup - Project 23                      ║
║     Cowrie SSH/Telnet Honeypot                              ║
╚════════════════════════════════════════════════════════════════╝
"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo '[!] Please run as root'
    exit 1
fi

install_cowrie() {
    echo '[*] Installing Cowrie honeypot...'
    
    # Install dependencies
    apt-get update
    apt-get install -y python3 python3-venv git
    
    # Create cowrie user
    useradd -r -s /bin/false cowrie || true
    
    # Clone Cowrie
    cd /opt
    git clone https://github.com/cowrie/cowrie.git
    cd cowrie
    
    # Setup virtual environment
    python3 -m venv cowrie-env
    source cowrie-env/bin/activate
    
    # Install dependencies
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Configure
    cp etc/cowrie.cfg.dist etc/cowrie.cfg
    
    # Set hostname to something tempting
    sed -i 's/hostname =.*/hostname = srv01/' etc/cowrie.cfg
    
    # Set SSH port to 2222 (non-standard)
    sed -i 's/ssh_port = .*/ssh_port = 2222/' etc/cowrie.cfg
    
    # Create log directory
    mkdir -p var/log/cowrie
    mkdir -p var/lib/cowrie/downloads
    chown -R cowrie:cowrie /opt/cowrie
    
    echo '[+] Cowrie installed!'
    echo ''
    echo 'To start Cowrie:'
    echo '  cd /opt/cowrie'
    echo '  source cowrie-env/bin/activate'
    echo '  python3 bin/cowrie start'
    echo ''
    echo 'Logs:'
    echo '  var/log/cowrie/' 
    echo '  - cowrie.log (full log)'
    echo '  - cowrie.json (JSON format)'
    echo ''
    echo 'Downloaded files:'
    echo '  var/lib/cowrie/downloads/'
}

show_usage() {
    echo "
Usage:
  $0 install    Install Cowrie honeypot
  $0 status     Check if running
  $0 logs       View recent logs
  $0 start      Start Cowrie
  $0 stop       Stop Cowrie
    "
}

case "${1:-install}" in
    install)
        install_cowrie
        ;;
    status)
        if pgrep -f cowrie > /dev/null; then
            echo '[+] Cowrie is running'
        else
            echo '[-] Cowrie is not running'
        fi
        ;;
    logs)
        tail -50 /opt/cowrie/var/log/cowrie/cowrie.log 2>/dev/null || echo 'Log file not found'
        ;;
    start)
        cd /opt/cowrie
        source cowrie-env/bin/activate
        python3 bin/cowrie start
        ;;
    stop)
        cd /opt/cowrie
        source cowrie-env/bin/activate
        python3 bin/cowrie stop
        ;;
    *)
        show_usage
        ;;
esac
