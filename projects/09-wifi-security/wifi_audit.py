#!/usr/bin/env python3
"""
Wi-Fi Security Auditor - Project 9
Wireless network security testing toolkit.

EDUCATIONAL USE ONLY. Only test networks you own or have permission to audit.
Requires aircrack-ng suite and wireless card supporting monitor mode.
"""

import subprocess
import re
import time
import json
import datetime
import argparse
from pathlib import Path
from typing import Optional, List, Dict

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Common router default credentials
DEFAULT_CREDS = {
    "admin:admin": ["Many default routers"],
    "admin:password": ["Netgear", "TP-Link"],
    "admin:1234": ["Some ISP routers"],
    "admin:123456": ["Huawei"],
    "user:user": ["D-Link"],
    "root:root": ["Many Linux-based routers"],
}

class WiFiAuditor:
    """Wi-Fi network security auditor."""
    
    def __init__(self, interface: str = "wlan0"):
        self.interface = interface
        self.interface_mon = f"{interface}mon"
        self.results = {
            "interface": interface,
            "scan_time": None,
            "networks": [],
            "handshakes": [],
            "weak_networks": []
        }
    
    def run_cmd(self, cmd: List[str], timeout: int = 30) -> tuple:
        """Run a command and return output."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return result.stdout, result.stderr, result.returncode
        except subprocess.TimeoutExpired:
            return "", "Command timed out", 1
        except FileNotFoundError:
            return "", f"Command not found: {cmd[0]}", 1
    
    def check_requirements(self) -> Dict:
        """Check if required tools are available."""
        tools = ["iwconfig", "airodump-ng", "aircrack-ng", "hashcat"]
        results = {}
        
        for tool in tools:
            _, _, code = self.run_cmd(["which", tool])
            results[tool] = code == 0
        
        return results
    
    def get_interface_mode(self) -> str:
        """Check current interface mode."""
        stdout, _, _ = self.run_cmd(["iwconfig", self.interface])
        
        if "Mode:Master" in stdout or "Mode:Managed" in stdout:
            match = re.search(r'Mode:(\w+)', stdout)
            return match.group(1) if match else "Unknown"
        return "Not wireless"
    
    def enable_monitor_mode(self) -> bool:
        """Enable monitor mode on interface."""
        print(f"[*] Enabling monitor mode on {self.interface}...")
        
        # Kill conflicting processes
        self.run_cmd(["sudo", "airmon-ng", "check", "kill"])
        
        # Start monitor mode
        stdout, _, code = self.run_cmd(["sudo", "airmon-ng", "start", self.interface])
        
        if code == 0:
            print(f"[+] Monitor mode enabled: {self.interface_mon}")
            return True
        return False
    
    def disable_monitor_mode(self):
        """Disable monitor mode."""
        print(f"[*] Disabling monitor mode...")
        self.run_cmd(["sudo", "airmon-ng", "stop", self.interface_mon])
    
    def scan_networks(self, duration: int = 30) -> List[Dict]:
        """Scan for Wi-Fi networks."""
        print(f"[*] Scanning for networks ({duration}s)...")
        
        # Start airodump-ng
        output_file = LOG_DIR / f"scan_{int(time.time())}"
        proc = subprocess.Popen([
            "sudo", "airodump-ng", self.interface_mon,
            "-w", str(output_file),
            "--output-format", "csv,json",
            "--write-interval", "1"
        ])
        
        time.sleep(duration)
        proc.terminate()
        proc.wait()
        
        # Parse results
        networks = []
        csv_file = Path(f"{output_file}-01.csv")
        json_file = Path(f"{output_file}-01.json")
        
        if json_file.exists():
            with open(json_file) as f:
                data = json.load(f)
                networks = data.get("WiFiNetworks", [])
        elif csv_file.exists():
            networks = self._parse_csv(csv_file)
        
        self.results["scan_time"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.results["networks"] = networks
        
        print(f"[+] Found {len(networks)} networks")
        
        for net in networks[:5]:
            print(f"    {net.get('BSSID', '?')} | {net.get('ESSID', 'Hidden'):20} | {net.get('channel', '?')} | {net.get('encryption', '?')}")
        
        return networks
    
    def _parse_csv(self, csv_file: Path) -> List[Dict]:
        """Parse airodump CSV output."""
        networks = []
        try:
            with open(csv_file) as f:
                for line in f:
                    if line.startswith("BSSID"):
                        continue  # Header
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) > 4:
                        networks.append({
                            "BSSID": parts[0],
                            "ESSID": parts[13] if len(parts) > 13 else "",
                            "channel": parts[3],
                            "encryption": parts[5] if len(parts) > 5 else "",
                            "power": parts[6] if len(parts) > 6 else ""
                        })
        except Exception as e:
            print(f"[!] CSV parse error: {e}")
        return networks
    
    def analyze_security(self, networks: List[Dict]) -> List[Dict]:
        """Analyze network security."""
        print("\n[*] Analyzing network security...")
        
        weak = []
        
        for net in networks:
            security = {
                "BSSID": net.get("BSSID", ""),
                "ESSID": net.get("ESSID", "Hidden"),
                "channel": net.get("channel", ""),
                "issues": []
            }
            
            enc = net.get("encryption", "").upper()
            
            # Check encryption type
            if "WPA3" in enc:
                security["grade"] = "A"
                security["encryption"] = "WPA3"
            elif "WPA2" in enc:
                security["grade"] = "B"
                security["encryption"] = "WPA2"
            elif "WPA" in enc:
                security["grade"] = "C"
                security["encryption"] = "WPA"
                security["issues"].append("WPA is outdated, upgrade to WPA2/WPA3")
            elif "WEP" in enc:
                security["grade"] = "F"
                security["encryption"] = "WEP"
                security["issues"].append("WEP is cracked in minutes")
            elif "OPEN" in enc:
                security["grade"] = "F"
                security["encryption"] = "None"
                security["issues"].append("No encryption - all traffic visible")
            else:
                security["grade"] = "?"
                security["encryption"] = enc
            
            # Check for default SSIDs
            common_ssids = ["linksys", "netgear", "default", "wireless", "dlink"]
            ssid_lower = security["ESSID"].lower()
            if any(s in ssid_lower for s in common_ssids):
                security["issues"].append("Default SSID - may have default credentials")
            
            # Check for weak channels
            try:
                ch = int(net.get("channel", 0))
                if ch in [12, 13, 14]:
                    security["issues"].append("Non-standard channel may cause issues")
            except:
                pass
            
            weak.append(security)
            
            if security["grade"] in ["F", "C"]:
                self.results["weak_networks"].append(security)
        
        return weak
    
    def capture_handshake(self, bssid: str, channel: int, essid: str, duration: int = 60) -> Optional[Path]:
        """Capture WPA handshake."""
        print(f"\n[*] Attempting to capture handshake for {essid} ({bssid})")
        print(f"[*] Channel: {channel}, Duration: {duration}s")
        print(f"[*] Waiting for client device to connect...")
        
        output_file = LOG_DIR / f"handshake_{bssid.replace(':', '')}_{int(time.time())}"
        
        # Set channel
        self.run_cmd(["sudo", "iwconfig", self.interface_mon, "channel", str(channel)])
        
        # Start capture
        proc = subprocess.Popen([
            "sudo", "airodump-ng", self.interface_mon,
            "-c", str(channel),
            "--bssid", bssid,
            "-w", str(output_file),
            "--output-format", "pcap"
        ])
        
        # Wait for handshake
        time.sleep(duration)
        proc.terminate()
        proc.wait()
        
        pcap_file = Path(f"{output_file}-01.pcap")
        
        if pcap_file.exists():
            # Verify handshake
            _, _, code = self.run_cmd(["sudo", "aircrack-ng", "-a", "1", "-b", bssid, str(pcap_file)])
            
            if code == 0:
                print(f"[+] Possible handshake captured!")
                self.results["handshakes"].append({
                    "bssid": bssid,
                    "essid": essid,
                    "file": str(pcap_file),
                    "time": datetime.datetime.now(datetime.timezone.utc).isoformat()
                })
                return pcap_file
        
        print("[*] No handshake captured (no client connected during capture)")
        return None
    
    def generate_report(self) -> str:
        """Generate security audit report."""
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     WI-FI SECURITY AUDIT REPORT                               ║
╚════════════════════════════════════════════════════════════════╝

Scan Time: {self.results.get('scan_time', 'N/A')}
Interface: {self.results.get('interface', 'N/A')}

────────────────────────────────────────────────────────────────
NETWORK SUMMARY
────────────────────────────────────────────────────────────────

Total Networks Found: {len(self.results.get('networks', []))}
Weak/Suspect Networks: {len(self.results.get('weak_networks', []))}
Handshakes Captured: {len(self.results.get('handshakes', []))}

────────────────────────────────────────────────────────────────
SECURITY GRADE DISTRIBUTION
────────────────────────────────────────────────────────────────
"""
        
        grades = {"A": 0, "B": 0, "C": 0, "F": 0, "?": 0}
        for net in self.results.get("weak_networks", []):
            grades[net.get("grade", "?")] = grades.get(net.get("grade", "?"), 0) + 1
        
        for grade, count in sorted(grades.items()):
            bar = "█" * count
            report += f"  {grade}: {bar} ({count})\n"
        
        if self.results.get("weak_networks"):
            report += """
────────────────────────────────────────────────────────────────
WEAK NETWORKS DETAIL
────────────────────────────────────────────────────────────────
"""
            for net in self.results.get("weak_networks", []):
                report += f"""
Network: {net.get('ESSID', 'Hidden')}
BSSID: {net.get('BSSID', '?')}
Channel: {net.get('channel', '?')}
Encryption: {net.get('encryption', 'Unknown')}
Grade: {net.get('grade', '?')}
"""
                if net.get("issues"):
                    report += "Issues:\n"
                    for issue in net["issues"]:
                        report += f"  [!] {issue}\n"
        
        report += """
────────────────────────────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────────────────────────────

1. ENCRYPTION
   - Use WPA3 if available
   - Minimum WPA2-AES
   - Never use WEP or open networks

2. PASSWORD POLICY
   - Minimum 12 characters
   - Mix of character types
   - Change default router passwords

3. NETWORK CONFIGURATION
   - Change default SSID
   - Disable WPS
   - Enable router firewall
   - Keep firmware updated

4. MONITORING
   - Regular security audits
   - Monitor for unauthorized devices
   - Enable logging

────────────────────────────────────────────────────────────────
TOOLS USED
────────────────────────────────────────────────────────────────

- airmon-ng: Monitor mode management
- airodump-ng: Network discovery
- aircrack-ng: Handshake verification
- hashcat: Password cracking (if authorized)

────────────────────────────────────────────────────────────────
"""
        
        return report
    
    def save_results(self):
        """Save results to JSON."""
        output_file = LOG_DIR / f"wifi_audit_{int(time.time())}.json"
        with open(output_file, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\n[+] Results saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Wi-Fi Security Auditor")
    parser.add_argument("-i", "--interface", default="wlan0", help="Wireless interface")
    parser.add_argument("-d", "--duration", type=int, default=30, help="Scan duration (seconds)")
    parser.add_argument("--skip-monitor", action="store_true", help="Skip monitor mode setup")
    parser.add_argument("--report-only", help="Generate report from previous scan")
    args = parser.parse_args()
    
    print(f"""
╔════════════════════════════════════════════════════════════════╗
║     Wi-Fi Security Auditor - Project 9                        ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only test networks you own or have permission to audit    ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # Check requirements
    auditor = WiFiAuditor(args.interface)
    tools = auditor.check_requirements()
    
    print("[*] Checking requirements...")
    missing = [t for t, found in tools.items() if not found]
    if missing:
        print(f"[!] Missing tools: {', '.join(missing)}")
        print(f"    Install with: sudo apt install aircrack-ng")
        print(f"    WARNING: Script cannot run without these tools")
        return 1
    
    print(f"[+] All required tools available")
    
    try:
        # Enable monitor mode
        if not args.skip_monitor:
            if not auditor.enable_monitor_mode():
                print("[!] Failed to enable monitor mode")
                return 1
        
        # Scan networks
        networks = auditor.scan_networks(args.duration)
        
        # Analyze security
        auditor.analyze_security(networks)
        
        # Save results
        auditor.save_results()
        
        # Print report
        print(auditor.generate_report())
        
    finally:
        if not args.skip_monitor:
            auditor.disable_monitor_mode()
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main() or 0)
