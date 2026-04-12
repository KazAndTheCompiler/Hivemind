#!/usr/bin/env python3
"""
Network Vulnerability Scanner - Project 10
Scan networks for open ports, services, and known vulnerabilities.

EDUCATIONAL USE ONLY. Only scan networks you own or have permission to scan.
"""

import subprocess
import re
import json
import datetime
import argparse
import socket
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict

# Common vulnerable ports and their services
VULNERABLE_SERVICES = {
    21: {"name": "FTP", "risk": "HIGH", "issues": ["Anonymous access", "Clear text transmission", "FTPFast and others allow bounce attacks"]},
    22: {"name": "SSH", "risk": "MEDIUM", "issues": ["Brute force attacks", "Weak algorithms"]},
    23: {"name": "Telnet", "risk": "CRITICAL", "issues": ["Clear text", "No encryption", "Easily intercepted"]},
    25: {"name": "SMTP", "risk": "MEDIUM", "issues": ["Open relay", "Spam amplification"]},
    53: {"name": "DNS", "risk": "MEDIUM", "issues": ["DNS poisoning", "Amplification attacks"]},
    80: {"name": "HTTP", "risk": "HIGH", "issues": ["Unencrypted", "Web vulnerabilities"]},
    110: {"name": "POP3", "risk": "HIGH", "issues": ["Clear text", "Credentials exposed"]},
    111: {"name": "RPC", "risk": "HIGH", "issues": ["Remote code execution", "NFS exposure"]},
    135: {"name": "MSRPC", "risk": "HIGH", "issues": ["SMB enumeration", "Lateral movement"]},
    137: {"name": "NetBIOS", "risk": "CRITICAL", "issues": ["SMB enumeration", "Samba overflows"]},
    139: {"name": "NetBIOS", "risk": "CRITICAL", "issues": ["SMB over NetBIOS", "Lateral movement"]},
    143: {"name": "IMAP", "risk": "HIGH", "issues": ["Clear text", "Credentials exposed"]},
    161: {"name": "SNMP", "risk": "HIGH", "issues": ["Default community strings", "Information disclosure"]},
    389: {"name": "LDAP", "risk": "MEDIUM", "issues": ["Information disclosure", "Bind enumeration"]},
    443: {"name": "HTTPS", "risk": "MEDIUM", "issues": ["Certificate issues", "Web vulnerabilities"]},
    445: {"name": "SMB", "risk": "CRITICAL", "issues": ["EternalBlue", "SMB exploits", "Lateral movement"]},
    465: {"name": "SMTPS", "risk": "MEDIUM", "issues": ["Certificate issues"]},
    514: {"name": "Syslog", "risk": "HIGH", "issues": ["Clear text", "Log injection"]},
    515: {"name": "LPD", "risk": "MEDIUM", "issues": ["Print spooler exploits"]},
    543: {"name": "PostgreSQL", "risk": "MEDIUM", "issues": ["Default configurations"]},
    548: {"name": "AFP", "risk": "MEDIUM", "issues": ["Information disclosure"]},
    554: {"name": "RTSP", "risk": "HIGH", "issues": ["Camera exploits", "Default credentials"]},
    587: {"name": "SMTP", "risk": "MEDIUM", "issues": ["Submission port", "Certificate issues"]},
    631: {"name": "IPP", "risk": "MEDIUM", "issues": ["Printer exploits", "CUPS vulnerabilities"]},
    636: {"name": "LDAPS", "risk": "MEDIUM", "issues": ["Certificate issues"]},
    873: {"name": "rsync", "risk": "HIGH", "issues": ["Unauthenticated access possible"]},
    993: {"name": "IMAPS", "risk": "LOW", "issues": ["Certificate issues"]},
    995: {"name": "POP3S", "risk": "LOW", "issues": ["Certificate issues"]},
    1080: {"name": "SOCKS", "risk": "HIGH", "issues": ["Proxy abuse", "Anonymization"]},
    1433: {"name": "MSSQL", "risk": "CRITICAL", "issues": ["SQL injection", "Default SA account"]},
    1434: {"name": "MSSQL", "risk": "CRITICAL", "issues": ["SQL injection", "UDP buffer overflow"]},
    1521: {"name": "Oracle", "risk": "CRITICAL", "issues": ["TNS poison", "Default credentials"]},
    1723: {"name": "PPTP", "risk": "CRITICAL", "issues": ["MPPE vulnerabilities", "Sniffable"]},
    1883: {"name": "MQTT", "risk": "HIGH", "issues": ["No authentication default", "IoT exposure"]},
    2049: {"name": "NFS", "risk": "CRITICAL", "issues": ["No authentication", "File access"]},
    2082: {"name": "cPanel", "risk": "MEDIUM", "issues": ["Default credentials"]},
    2083: {"name": "cPanel SSL", "risk": "MEDIUM", "issues": ["Certificate issues"]},
    2181: {"name": "ZooKeeper", "risk": "HIGH", "issues": ["No auth default", "Data exposure"]},
    3000: {"name": "Dev tools", "risk": "HIGH", "issues": ["Debug endpoints", "Internal APIs"]},
    3306: {"name": "MySQL", "risk": "CRITICAL", "issues": ["Default root", "SQL injection"]},
    3389: {"name": "RDP", "risk": "CRITICAL", "issues": ["BlueKeep", "Brute force", "MFA not default"]},
    3690: {"name": "SVN", "risk": "MEDIUM", "issues": ["Source code exposure"]},
    4369: {"name": "EPMD", "risk": "MEDIUM", "issues": ["Port exposure"]},
    5000: {"name": "UPnP", "risk": "CRITICAL", "issues": ["NAT punching", "SSDP reflection"]},
    5060: {"name": "SIP", "risk": "MEDIUM", "issues": ["VoIP eavesdropping", "Call hijacking"]},
    5222: {"name": "XMPP", "risk": "MEDIUM", "issues": ["Plain auth default"]},
    5432: {"name": "PostgreSQL", "risk": "CRITICAL", "issues": ["Default configurations", "Trust auth"]},
    5672: {"name": "RabbitMQ", "risk": "HIGH", "issues": ["Default credentials"]},
    5900: {"name": "VNC", "risk": "CRITICAL", "issues": ["No encryption", "Weak auth", "RealVNC exploits"]},
    5984: {"name": "CouchDB", "risk": "HIGH", "issues": ["No auth default", "Admin party"]},
    6379: {"name": "Redis", "risk": "CRITICAL", "issues": ["No auth default", "Remote execution"]},
    6443: {"name": "Kubernetes", "risk": "CRITICAL", "issues": ["API exposure", "No auth"]},
    8000: {"name": "HTTP Alt", "risk": "HIGH", "issues": ["Debug interfaces", "Dev tools"]},
    8080: {"name": "HTTP Proxy", "risk": "HIGH", "issues": ["Open proxy", "Web vulnerabilities"]},
    8443: {"name": "HTTPS Alt", "risk": "MEDIUM", "issues": ["Certificate issues"]},
    8888: {"name": "HTTP Alt", "risk": "HIGH", "issues": ["Jupyter notebooks", "Debug tools"]},
    9000: {"name": "PHP-FPM", "risk": "MEDIUM", "issues": ["Status page exposure"]},
    9042: {"name": "Cassandra", "risk": "MEDIUM", "issues": ["Default credentials"]},
    9090: {"name": "Prometheus", "risk": "HIGH", "issues": ["No auth default", "Metrics exposure"]},
    9200: {"name": "Elasticsearch", "risk": "CRITICAL", "issues": ["No auth default", "Data exposure"]},
    9300: {"name": "Elasticsearch", "risk": "CRITICAL", "issues": ["Remote execution", "Transport API"]},
    27017: {"name": "MongoDB", "risk": "CRITICAL", "issues": ["No auth default", "Data exposure"]},
    27018: {"name": "MongoDB", "risk": "CRITICAL", "issues": ["No auth default"]},
}

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

@dataclass
class HostResult:
    ip: str
    hostname: str
    status: str
    ports: List[Dict]
    os_guess: str
    vulns: List[Dict]
    
    def to_dict(self):
        return asdict(self)

class NetworkScanner:
    """Network vulnerability scanner."""
    
    def __init__(self, target: str):
        self.target = target
        self.results = {
            "target": target,
            "scan_time": None,
            "hosts": []
        }
    
    def run_cmd(self, cmd: List[str], timeout: int = 60) -> tuple:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return result.stdout, result.stderr, result.returncode
        except subprocess.TimeoutExpired:
            return "", "Timeout", 1
        except FileNotFoundError:
            return "", f"{cmd[0]} not found", 1
    
    def resolve_hostname(self, ip: str) -> str:
        try:
            hostname = socket.gethostbyaddr(ip)
            return hostname[0]
        except:
            return ""
    
    def quick_scan(self, host: str, ports: str = "21,22,23,25,80,110,135,139,143,443,445,993,995,3306,3389,8080,8443") -> List[Dict]:
        """Quick port scan using netcat or nmap."""
        print(f"    Scanning {host}...")
        
        open_ports = []
        
        # Try using nmap if available
        stdout, _, code = self.run_cmd(["which", "nmap"])
        if code == 0:
            stdout, _, _ = self.run_cmd(["nmap", "-Pn", "-T4", "-p", ports, host, "--open", "-oG", "-"], timeout=120)
            
            for line in stdout.split("\n"):
                if "Ports:" in line:
                    port_matches = re.findall(r'(\d+)\/open\/(\w+)', line)
                    for port, state in port_matches:
                        if state == "open":
                            open_ports.append({
                                "port": int(port),
                                "state": "open",
                                "service": self.guess_service(int(port)),
                                "version": ""
                            })
        else:
            # Fallback to simple socket scan
            for port_str in ports.split(","):
                try:
                    port = int(port_str.strip())
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(1)
                    result = sock.connect_ex((host, port))
                    sock.close()
                    
                    if result == 0:
                        open_ports.append({
                            "port": port,
                            "state": "open",
                            "service": self.guess_service(port),
                            "version": ""
                        })
                except:
                    pass
        
        return open_ports
    
    def guess_service(self, port: int) -> str:
        try:
            return socket.getservbyport(port)
        except:
            return "unknown"
    
    def analyze_vulnerabilities(self, ports: List[Dict]) -> List[Dict]:
        """Analyze open ports for known vulnerabilities."""
        vulns = []
        
        for p in ports:
            port = p["port"]
            if port in VULNERABLE_SERVICES:
                vuln_info = VULNERABLE_SERVICES[port]
                vulns.append({
                    "port": port,
                    "service": vuln_info["name"],
                    "risk": vuln_info["risk"],
                    "issues": vuln_info["issues"]
                })
        
        return vulns
    
    def os_detection(self, host: str) -> str:
        """Try to detect operating system via TTL and TCP fingerprinting."""
        # Simple TTL check
        stdout, _, code = self.run_cmd(["ping", "-c", "1", "-W", "1", host])
        
        ttl_match = re.search(r'ttl=(\d+)', stdout.lower())
        if ttl_match:
            ttl = int(ttl_match.group(1))
            if ttl <= 64:
                return "Linux/Unix"
            elif ttl <= 128:
                return "Windows"
            elif ttl <= 255:
                return "Network Device/Cisco"
        
        return "Unknown"
    
    def scan_host(self, host: str) -> HostResult:
        """Scan a single host."""
        print(f"\n[*] Scanning {host}...")
        
        hostname = self.resolve_hostname(host)
        os_guess = self.os_detection(host)
        
        print(f"    Hostname: {hostname or 'Unknown'}")
        print(f"    OS Guess: {os_guess}")
        
        ports = self.quick_scan(host)
        print(f"    Found {len(ports)} open ports")
        
        vulns = self.analyze_vulnerabilities(ports)
        if vulns:
            print(f"    [!] {len(vulns)} potential vulnerabilities")
        
        return HostResult(
            ip=host,
            hostname=hostname,
            status="up",
            ports=ports,
            os_guess=os_guess,
            vulns=vulns
        )
    
    def scan_network(self, network: str, ports: str = None) -> List[HostResult]:
        """Scan entire network range."""
        print(f"[*] Scanning network: {network}")
        
        # Check if nmap is available for network discovery
        stdout, _, code = self.run_cmd(["which", "nmap"])
        
        if code == 0:
            print("[*] Using nmap for network discovery...")
            stdout, _, _ = self.run_cmd(["nmap", "-sn", network, "-oG", "-"], timeout=120)
            
            hosts = []
            for line in stdout.split("\n"):
                if "Up)" in line:
                    ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', line)
                    if ip_match:
                        ip = ip_match.group(1)
                        host_result = self.scan_host(ip)
                        hosts.append(host_result)
        else:
            # Simple ping sweep
            print("[*] Using ping sweep (nmap not available)...")
            base_ip = ".".join(network.split(".")[:3])
            
            hosts = []
            for i in range(1, 255):
                ip = f"{base_ip}.{i}"
                stdout, _, code = self.run_cmd(["ping", "-c", "1", "-W", "1", ip])
                
                if code == 0:
                    host_result = self.scan_host(ip)
                    hosts.append(host_result)
        
        return hosts
    
    def generate_report(self) -> str:
        """Generate scan report."""
        self.results["scan_time"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        critical_count = sum(1 for h in self.results["hosts"] for v in h["vulns"] if v["risk"] == "CRITICAL")
        high_count = sum(1 for h in self.results["hosts"] for v in h["vulns"] if v["risk"] == "HIGH")
        medium_count = sum(1 for h in self.results["hosts"] for v in h["vulns"] if v["risk"] == "MEDIUM")
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     NETWORK VULNERABILITY SCAN REPORT                         ║
╚════════════════════════════════════════════════════════════════╝

Target: {self.target}
Scan Time: {self.results['scan_time']}

────────────────────────────────────────────────────────────────
SUMMARY
────────────────────────────────────────────────────────────────

Hosts Scanned: {len(self.results['hosts'])}
Critical Issues: {critical_count}
High Issues: {high_count}
Medium Issues: {medium_count}

────────────────────────────────────────────────────────────────
VULNERABILITY BREAKDOWN
────────────────────────────────────────────────────────────────

CRITICAL ({critical_count}):{chr(10)}"""
        
        for host in self.results["hosts"]:
            for vuln in host["vulns"]:
                if vuln["risk"] == "CRITICAL":
                    report += f"""
  {host['ip']} ({host['hostname'] or 'Unknown'})
    Port {vuln['port']} ({vuln['service']})
"""
        
        report += f"""
HIGH ({high_count}):{chr(10)}"""
        
        for host in self.results["hosts"]:
            for vuln in host["vulns"]:
                if vuln["risk"] == "HIGH":
                    report += f"""
  {host['ip']} ({host['hostname'] or 'Unknown'})
    Port {vuln['port']} ({vuln['service']})
"""
        
        report += """
────────────────────────────────────────────────────────────────
HOST DETAILS
────────────────────────────────────────────────────────────────
"""
        
        for host in self.results["hosts"]:
            report += f"\n{host['ip']} ({host['hostname'] or 'Unknown'})\n"
            report += f"  OS: {host['os_guess']}\n"
            report += f"  Status: {host['status']}\n"
            report += f"  Open Ports: {len(host['ports'])}\n"
            
            for p in host["ports"]:
                report += f"    {p['port']}/{p['service']}\n"
        
        report += """
────────────────────────────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────────────────────────────

1. CRITICAL PRIORITY
   - Disable Telnet (port 23)
   - Secure SMB (ports 139, 445)
   - Secure RDP (port 3389)
   - Disable unused database ports
   - Enable firewall on all hosts

2. HIGH PRIORITY
   - Close unused ports
   - Update vulnerable services
   - Implement encryption (SSH, not Telnet)
   - Change default credentials
   - Enable authentication on Redis, MongoDB, etc.

3. GENERAL HARDENING
   - Keep systems updated
   - Use network segmentation
   - Implement monitoring/logging
   - Regular security audits

────────────────────────────────────────────────────────────────
"""
        
        return report
    
    def save_json(self) -> Path:
        output = LOG_DIR / f"scan_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output, "w") as f:
            json.dump(self.results, f, indent=2)
        return output

def main():
    parser = argparse.ArgumentParser(description="Network Vulnerability Scanner")
    parser.add_argument("target", help="Target IP or network (e.g., 192.168.1.0/24 or 192.168.1.1)")
    parser.add_argument("-p", "--ports", help="Ports to scan (default: common vulnerable)")
    parser.add_argument("-o", "--output", help="Output JSON file")
    parser.add_argument("--report-only", action="store_true", help="Show report only, no scan")
    args = parser.parse_args()
    
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║     Network Vulnerability Scanner - Project 10                ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only scan networks you own or have permission to scan    ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    scanner = NetworkScanner(args.target)
    
    # Determine if target is network or host
    if "/" in args.target:
        hosts = scanner.scan_network(args.target, args.ports)
    else:
        host_result = scanner.scan_host(args.target)
        hosts = [host_result]
    
    scanner.results["hosts"] = [h.to_dict() if isinstance(h, HostResult) else h for h in hosts]
    
    # Save results
    json_file = scanner.save_json()
    print(f"\n[+] Results saved to: {json_file}")
    
    # Print report
    print(scanner.generate_report())
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main() or 0)
