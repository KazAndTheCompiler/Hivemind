#!/usr/bin/env python3
"""
Basic SSH Honeypot - Project 1
A low-interaction honeypot that logs connection attempts.
Run on port 2222 to avoid conflicting with real SSH on port 22.

Usage:
    sudo python3 honeypot.py
"""

import socket
import threading
import datetime
import json
import os
import sys
import hashlib
from pathlib import Path

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
ACCESS_LOG = LOG_DIR / "access.log"
CREDS_LOG = LOG_DIR / "credentials.log"
IP_LOG = LOG_DIR / "ip_summary.json"

# Common credentials to log
COMMON_PASSWORDS = [
    "123456", "password", "admin", "root", "ubuntu", "debian",
    "centos", "fedora", "raspberry", "qwerty", "abc123", "111111"
]

def log_event(event_type: str, data: dict):
    """Log event to both file and stdout."""
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    event = {"timestamp": timestamp, "type": event_type, **data}
    
    print(f"[{timestamp}] {event_type}: {json.dumps(data)}")
    
    with open(ACCESS_LOG, "a") as f:
        f.write(json.dumps(event) + "\n")

def load_ip_summary() -> dict:
    """Load existing IP summary or create new."""
    if IP_LOG.exists():
        try:
            with open(IP_LOG) as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_ip_summary(data: dict):
    with open(IP_LOG, "w") as f:
        json.dump(data, f, indent=2)

def update_ip_tracking(ip: str, username: str, password: str):
    """Track unique IPs and their attempts."""
    summary = load_ip_summary()
    
    if ip not in summary:
        summary[ip] = {"count": 0, "usernames": set(), "passwords": set(), "first_seen": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    
    summary[ip]["count"] += 1
    summary[ip]["usernames"].add(username)
    summary[ip]["passwords"].add(password)
    summary[ip]["last_seen"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    save_ip_summary(summary)

def handle_client(client_socket, client_address):
    """Handle a single client connection."""
    ip = client_address[0]
    port = client_address[1]
    
    log_event("connection", {"ip": ip, "port": port, "status": "accepted"})
    
    try:
        # Send SSH version banner
        client_socket.send(b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n")
        client_socket.settimeout(30)
        
        # Read client version
        client_version = client_socket.recv(1024)
        if client_version:
            log_event("client_version", {"ip": ip, "version": client_version.decode().strip()})
        
        # Read authentication attempts (SSH Userauth request)
        auth_attempts = 0
        while auth_attempts < 5:
            try:
                data = client_socket.recv(4096)
                if not data:
                    break
                
                # Parse SSH message
                decoded = data.decode('utf-8', errors='ignore')
                
                # Look for username in SSH auth
                if b"ssh-connection" in data.lower() or b"ssh-userauth" in data.lower():
                    # Try to extract credentials from the packet
                    # This is a simplified parsing - real SSH honeypots use full SSH protocol
                    log_event("auth_attempt", {"ip": ip, "raw_data": data.hex()[:200]})
                    
                    # Simulate password request and log common credentials
                    client_socket.send(b"\x02\x00\x00\x00\x0ePermission denied\r\n")
                    auth_attempts += 1
                    
                    # Try to extract username from the packet
                    username = extract_username(data) or "unknown"
                    password = extract_password(data) or "unknown"
                    
                    log_event("credentials", {"ip": ip, "username": username, "password": password})
                    update_ip_tracking(ip, username, password)
                    
                    # Log to separate credentials file
                    with open(CREDS_LOG, "a") as f:
                        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
                        f.write(f'{ts},{ip},{username},{password}\n')
                
                # Check for disconnect
                if b"disconnect" in data.lower() or len(data) == 0:
                    break
                    
            except socket.timeout:
                break
            except Exception as e:
                log_event("error", {"ip": ip, "error": str(e)})
                break
        
        log_event("disconnect", {"ip": ip, "auth_attempts": auth_attempts})
        
    except Exception as e:
        log_event("error", {"ip": ip, "error": str(e)})
    finally:
        client_socket.close()

def extract_username(data: bytes) -> str:
    """Attempt to extract username from SSH auth packet."""
    try:
        decoded = data.decode('latin-1')
        # Look for patterns common in SSH auth
        if 'user' in decoded.lower():
            # Try to find it near common SSH patterns
            for line in decoded.split('\r\n'):
                if 'user' in line.lower():
                    parts = line.split('user')
                    if len(parts) > 1:
                        return parts[1].split()[0].strip('"\': ')
        return ""
    except:
        return ""

def extract_password(data: bytes) -> str:
    """Attempt to extract password from SSH auth packet."""
    try:
        decoded = data.decode('latin-1')
        if 'password' in decoded.lower():
            parts = decoded.split('password')
            if len(parts) > 1:
                return parts[1].split()[0].strip('"\': ')
        return ""
    except:
        return ""

def print_banner():
    print("""
    ╔═══════════════════════════════════════════════╗
    ║     BASIC SSH HONEYPOT - Project 1            ║
    ║     Logs connection attempts and credentials  ║
    ╚═══════════════════════════════════════════════╝
    """)

def main():
    print_banner()
    
    HOST = "0.0.0.0"  # Listen on all interfaces
    PORT = 2222       # Run on non-standard port
    
    print(f"[+] Starting honeypot on {HOST}:{PORT}")
    print(f"[+] Logs saved to: {LOG_DIR}")
    print(f"[+] Press Ctrl+C to stop\n")
    
    # Check if running as root (needed for port < 1024, but we use 2222)
    if os.geteuid() == 0:
        print("[!] Warning: Running as root. Not recommended for production.")
    
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind((HOST, PORT))
        server.listen(5)
        print(f"[+] Honeypot listening on port {PORT}")
        print(f"[+] Waiting for connections...\n")
        
        while True:
            client_socket, client_address = server.accept()
            print(f"[+] Connection from {client_address[0]}:{client_address[1]}")
            
            # Handle each connection in a separate thread
            client_thread = threading.Thread(target=handle_client, args=(client_socket, client_address))
            client_thread.daemon = True
            client_thread.start()
            
    except KeyboardInterrupt:
        print("\n[!] Shutting down honeypot...")
        server.close()
        sys.exit(0)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"[!] Port {PORT} is already in use. Try a different port or stop the existing service.")
        else:
            print(f"[!] Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
