#!/usr/bin/env python3
"""
Attack Detection Lab - Project 47
Build a lab environment for detecting attacks.

EDUCATIONAL USE ONLY. Only detect attacks in lab environments you own.
"""

import os
import sys
import json
import time
import random
from typing import List, Dict
from datetime import datetime

class AttackDetectionLab:
    """Simulated attack detection lab."""
    
    ATTACK_SCENARIOS = [
        {
            'name': 'SQL Injection',
            'indicators': [
                "' OR '1'='1",
                "admin'--",
                "UNION SELECT",
                "1; DROP TABLE"
            ],
            'expected_detection': 'WAF/IDS alert, SQL error in logs'
        },
        {
            'name': 'Brute Force SSH',
            'indicators': [
                'Failed password for root',
                'Authentication failure',
                'Connection from new IP'
            ],
            'expected_detection': 'Multiple failed logins, possible block'
        },
        {
            'name': 'XSS Attack',
            'indicators': [
                '<script>',
                'javascript:',
                'onerror='
            ],
            'expected_detection': 'Input validation alert, sanitization'
        },
        {
            'name': 'Port Scanning',
            'indicators': [
                'SYN flood',
                'Sequential port connections',
                'Nmap fingerprint'
            ],
            'expected_detection': 'IDS alert, port scan detected'
        },
        {
            'name': 'Malware Download',
            'indicators': [
                'Suspicious .exe download',
                'PowerShell download cradle',
                'CertUtil download'
            ],
            'expected_detection': 'Endpoint detection, file hash alert'
        }
    ]
    
    def __init__(self):
        self.logs = []
        self.alerts = []
    
    def generate_normal_traffic(self) -> List[Dict]:
        """Generate normal traffic patterns."""
        patterns = [
            {'type': 'http', 'src': '192.168.1.50', 'dst': '10.0.0.5', 'uri': '/api/users', 'method': 'GET'},
            {'type': 'http', 'src': '192.168.1.51', 'dst': '10.0.0.5', 'uri': '/api/products', 'method': 'GET'},
            {'type': 'ssh', 'src': '192.168.1.100', 'dst': '10.0.0.10', 'user': 'admin'},
            {'type': 'dns', 'src': '192.168.1.50', 'query': 'google.com'},
            {'type': 'https', 'src': '192.168.1.51', 'dst': '10.0.0.20', 'uri': '/dashboard'}
        ]
        return [random.choice(patterns) for _ in range(random.randint(50, 100))]
    
    def inject_attack(self, traffic: List[Dict]) -> List[Dict]:
        """Randomly inject an attack into traffic."""
        if not random.random() > 0.5:  # 50% chance of attack
            return traffic
        
        attack = random.choice(self.ATTACK_SCENARIOS)
        
        if attack['name'] == 'SQL Injection':
            traffic.append({
                'type': 'http',
                'src': '192.168.1.200',
                'dst': '10.0.0.5',
                'uri': f'/api/user?id=1 {random.choice(attack[\"indicators\"])}',
                'method': 'GET'
            })
        
        elif attack['name'] == 'Brute Force SSH':
            for _ in range(5):
                traffic.append({
                    'type': 'ssh',
                    'src': '185.220.101.47',  # Fake external IP
                    'dst': '10.0.0.10',
                    'user': 'root',
                    'auth': 'failed'
                })
        
        elif attack['name'] == 'XSS Attack':
            traffic.append({
                'type': 'http',
                'src': '192.168.1.150',
                'dst': '10.0.0.5',
                'uri': '/api/search',
                'method': 'POST',
                'body': f'q=<script>{random.choice([\"alert(1)\", \"fetch(\\\"/evil\\\")\"])}</script>'
            })
        
        elif attack['name'] == 'Port Scanning':
            for port in range(20, 30):
                traffic.append({
                    'type': 'syn',
                    'src': '185.220.101.48',
                    'dst': '10.0.0.5',
                    'port': port,
                    'flags': 'S'
                })
        
        return traffic
    
    def simulate_detection(self, traffic: List[Dict]) -> List[Dict]:
        """Simulate detection of attacks."""
        detections = []
        
        # Simple detection rules
        for log in traffic:
            # SQL injection detection
            if log.get('uri') and any(char in log['uri'] for char in ["'", "UNION", "DROP"]):
                detections.append({
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'high',
                    'alert': 'SQL Injection Attempt Detected',
                    'source_ip': log['src'],
                    'destination': f"{log['dst']}{log.get('uri', '')}",
                    'action': 'Alert, possible block'
                })
            
            # SSH brute force detection
            if log.get('type') == 'ssh' and log.get('auth') == 'failed':
                detections.append({
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'high',
                    'alert': 'SSH Authentication Failure',
                    'source_ip': log['src'],
                    'target': log['dst'],
                    'user': log.get('user'),
                    'action': 'Alert after 3 attempts'
                })
            
            # XSS detection
            if log.get('body') and '<script>' in log.get('body', ''):
                detections.append({
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'medium',
                    'alert': 'XSS Attempt Detected',
                    'source_ip': log['src'],
                    'payload': log['body'][:50],
                    'action': 'Input sanitized, alert generated'
                })
            
            # Port scan detection
            if log.get('type') == 'syn':
                detections.append({
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'medium',
                    'alert': 'Possible Port Scan',
                    'source_ip': log['src'],
                    'target_port': log.get('port'),
                    'action': 'Track, alert if pattern continues'
                })
        
        return detections
    
    def run_lab(self) -> Dict:
        """Run the attack detection lab."""
        print("[*] Generating normal traffic...")
        traffic = self.generate_normal_traffic()
        
        print("[*] Injecting attack scenario...")
        traffic = self.inject_attack(traffic)
        
        print("[*] Running detection algorithms...")
        detections = self.simulate_detection(traffic)
        
        return {
            'total_logs': len(traffic),
            'detections': detections,
            'detection_rate': len(detections) / len(traffic) if traffic else 0
        }

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Attack Detection Lab - Project 47                          ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only use in lab environments you own                       ║
╚════════════════════════════════════════════════════════════════╝

ATTACK SCENARIOS FOR DETECTION:

1. SQL INJECTION
   - Indicators: ', UNION, DROP, --
   - Detection: WAF, input validation, error analysis

2. BRUTE FORCE SSH
   - Indicators: Multiple failed logins, same user
   - Detection: Log analysis, fail2ban, account lockout

3. XSS ATTACKS
   - Indicators: <script>, javascript:, onerror=
   - Detection: Input sanitization, CSP alerts

4. PORT SCANNING
   - Indicators: Sequential ports, SYN flood
   - Detection: IDS/IPS, connection tracking

5. MALWARE DOWNLOAD
   - Indicators: Suspicious extensions, PowerShell
   - Detection: EDR, file reputation, sandboxing

DETECTION TOOLS:

| Tool | Purpose |
|------|---------|
| Zeek | Network analysis |
| Suricata | IDS/IPS |
| Wireshark | Packet analysis |
| SIEM | Log aggregation |
| EDR | Endpoint detection |

ALERT CORRELATION:

Instead of individual alerts, correlate:
1. Multiple SSH failures from same IP
2. Followed by successful login
3. Followed by unusual commands
4. = Compromised account

LOG ANALYSIS WORKFLOW:

1. COLLECT - Centralize logs (SIEM)
2. NORMALIZE - Parse into common format
3. CORRELATE - Link related events
4. ANALYZE - Investigate anomalies
5. RESPOND - Take action
6. DOCUMENT - Record findings

""")
    
    lab = AttackDetectionLab()
    
    print("\n[*] Running detection lab simulation...\n")
    results = lab.run_lab()
    
    print(f"Total Logs: {results['total_logs']}")
    print(f"Detections: {len(results['detections'])}")
    print(f"Detection Rate: {results['detection_rate']:.1%}")
    
    if results['detections']:
        print("\n[!] TOP ALERTS:")
        seen = set()
        for d in results['detections']:
            if d['alert'] not in seen:
                print(f"  - {d['alert']} ({d['severity'].upper()})")
                seen.add(d['alert'])

if __name__ == "__main__":
    main()