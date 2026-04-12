#!/usr/bin/env python3
"""
Vulnerability Scanner Tool - Project 15
Scan for CVEs based on detected service versions.

EDUCATIONAL USE ONLY. Only scan systems you own or have permission to scan.
"""

import socket
import json
import time
import argparse
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass

# Service to CPE mapping (simplified)
SERVICE_CPE = {
    "ssh": "cpe:/a:openbsd:openssh",
    "http": "cpe:/a:apache:http_server",
    "https": "cpe:/a:apache:http_server",
    "nginx": "cpe:/a:nginx:nginx",
    "mysql": "cpe:/a:mysql:mysql",
    "postgresql": "cpe:/a:postgresql:postgresql",
    "redis": "cpe:/a:redis:redis",
    "mongodb": "cpe:/a:mongodb:mongodb",
    "ftp": "cpe:/a:proftpd:proftpd",
    "smtp": "cpe:/a:postfix:postfix",
    "ssh": "cpe:/a:openbsd:openssh",
}

# Known vulnerable versions (simplified example)
KNOWN_VULNS = {
    "openssh": [
        {"cve": "CVE-2023-48795", "description": "OpenSSH 9.x before 9.6 remote code execution", "severity": "CRITICAL"},
        {"cve": "CVE-2020-15778", "description": "scp allow command injection", "severity": "HIGH"},
    ],
    "apache": [
        {"cve": "CVE-2021-44790", "description": "Apache 2.4.x overflow", "severity": "CRITICAL"},
        {"cve": "CVE-2021-40438", "description": "Apache mod_proxy SSRF", "severity": "HIGH"},
    ],
    "nginx": [
        {"cve": "CVE-2021-23017", "description": "nginx 1.20.0 DNS resolver remote exploit", "severity": "CRITICAL"},
    ],
    "mysql": [
        {"cve": "CVE-2021-2432", "description": "MySQL too many arguments overflow", "severity": "MEDIUM"},
    ],
    "redis": [
        {"cve": "CVE-2021-32761", "description": "Redis heap overflow", "severity": "CRITICAL"},
    ],
}

@dataclass
class Vulnerability:
    cve: str
    description: str
    severity: str
    service: str

class VulnScanner:
    """Vulnerability scanner based on service detection."""
    
    def __init__(self, target: str):
        self.target = target
        self.results = {
            "target": target,
            "scan_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "services": [],
            "vulnerabilities": []
        }
    
    def detect_banner(self, host: str, port: int, timeout: int = 3) -> Optional[str]:
        """Grab service banner."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            sock.connect((host, port))
            
            # Send probe
            if port == 80:
                sock.send(b"HEAD / HTTP/1.0\r\n\r\n")
            elif port == 443:
                pass  # SSL detection would go here
            elif port == 22:
                pass  # SSH banner auto-sends
            
            banner = sock.recv(1024).decode('utf-8', errors='ignore').strip()
            sock.close()
            
            return banner if banner else None
        except:
            return None
    
    def detect_service(self, banner: str) -> str:
        """Identify service from banner."""
        banner_lower = banner.lower()
        
        if 'ssh' in banner_lower:
            return 'ssh'
        elif 'apache' in banner_lower:
            return 'apache'
        elif 'nginx' in banner_lower:
            return 'nginx'
        elif 'mysql' in banner_lower:
            return 'mysql'
        elif 'redis' in banner_lower:
            return 'redis'
        elif 'postgresql' in banner_lower:
            return 'postgresql'
        elif 'mongodb' in banner_lower:
            return 'mongodb'
        elif '220' in banner_lower and 'sftp' in banner_lower:
            return 'sftp'
        elif '220' in banner_lower:
            return 'ftp'
        elif 'smtp' in banner_lower or 'postfix' in banner_lower:
            return 'smtp'
        
        return 'unknown'
    
    def scan_port(self, host: str, port: int) -> Optional[Dict]:
        """Scan a single port."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result != 0:
                return None
            
            banner = self.detect_banner(host, port)
            service = self.detect_service(banner) if banner else socket.getservbyport(port)
            
            return {
                "port": port,
                "state": "open",
                "service": service,
                "banner": banner[:200] if banner else None
            }
        except:
            return None
    
    def check_vulnerabilities(self, service: str) -> List[Vulnerability]:
        """Check for known vulnerabilities."""
        vulns = []
        
        for svc, cve_list in KNOWN_VULNS.items():
            if svc in service.lower():
                for cve in cve_list:
                    vulns.append(Vulnerability(
                        cve=cve["cve"],
                        description=cve["description"],
                        severity=cve["severity"],
                        service=service
                    ))
        
        return vulns
    
    def scan(self, ports: List[int] = None) -> Dict:
        """Full vulnerability scan."""
        if ports is None:
            ports = [21, 22, 23, 25, 80, 110, 143, 443, 445, 3306, 3389, 5432, 6379, 8080]
        
        print(f"[*] Scanning {self.target}...")
        print(f"[*] Checking {len(ports)} ports...")
        
        for port in ports:
            result = self.scan_port(self.target, port)
            
            if result:
                print(f"    Port {port}: {result['service']}")
                
                vulns = self.check_vulnerabilities(result['service'])
                if vulns:
                    for vuln in vulns:
                        print(f"        [!] {vuln.severity}: {vuln.cve}")
                        self.results["vulnerabilities"].append(vuln.__dict__)
                
                self.results["services"].append(result)
        
        return self.results
    
    def generate_report(self) -> str:
        """Generate vulnerability report."""
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     VULNERABILITY SCAN REPORT                                 ║
╚════════════════════════════════════════════════════════════════╝

Target: {self.target}
Scan Time: {self.results['scan_time']}

────────────────────────────────────────────────────────────────
SERVICES DETECTED: {len(self.results['services'])}
VULNERABILITIES FOUND: {len(self.results['vulnerabilities'])}
────────────────────────────────────────────────────────────────
"""
        
        critical = [v for v in self.results["vulnerabilities"] if v["severity"] == "CRITICAL"]
        high = [v for v in self.results["vulnerabilities"] if v["severity"] == "HIGH"]
        medium = [v for v in self.results["vulnerabilities"] if v["severity"] == "MEDIUM"]
        
        if critical:
            report += "\nCRITICAL:\n"
            for v in critical:
                report += f"  {v['cve']} - {v['service']}\n    {v['description']}\n"
        
        if high:
            report += "\nHIGH:\n"
            for v in high:
                report += f"  {v['cve']} - {v['service']}\n    {v['description']}\n"
        
        if medium:
            report += "\nMEDIUM:\n"
            for v in medium:
                report += f"  {v['cve']} - {v['service']}\n    {v['description']}\n"
        
        if not self.results["vulnerabilities"]:
            report += "\n[+] No known vulnerabilities detected.\n"
        
        report += """
────────────────────────────────────────────────────────────────
REMEDIATION STEPS
────────────────────────────────────────────────────────────────

1. Update all services to latest versions
2. Disable unused services
3. Implement firewall rules
4. Enable security monitoring
5. Review CVE details for each vulnerability
"""
        
        return report

def main():
    parser = argparse.ArgumentParser(description="Vulnerability Scanner")
    parser.add_argument("target", help="Target IP address")
    parser.add_argument("-p", "--ports", help="Comma-separated port list")
    args = parser.parse_args()
    
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║     Vulnerability Scanner - Project 15                         ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only scan systems you own or have permission to scan    ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    ports = None
    if args.ports:
        ports = [int(p.strip()) for p in args.ports.split(",")]
    
    scanner = VulnScanner(args.target)
    scanner.scan(ports)
    
    print(scanner.generate_report())
    
    # Save JSON
    output = Path(f"vuln_scan_{args.target.replace('.', '_')}.json")
    with open(output, "w") as f:
        json.dump(scanner.results, f, indent=2)
    print(f"\n[+] Results saved to: {output}")

if __name__ == "__main__":
    main()
