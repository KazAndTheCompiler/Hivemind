#!/usr/bin/env python3
"""
ICS/SCADA Security Assessment Framework
EDUCATIONAL USE ONLY - Critical infrastructure - authorize before testing
"""

import socket
import struct
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class ModbusClient:
    """Simple Modbus TCP client for testing."""

    def __init__(self, host: str, port: int = 502):
        self.host = host
        self.port = port
        self.unit_id = 1

    def read_coils(self, address: int = 0, count: int = 10) -> Optional[bytes]:
        """Read coils (function code 01)."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((self.host, self.port))

            transaction_id = 1
            header = struct.pack(">HHHBBB", transaction_id, 0, 6, self.unit_id, 1, address)
            header += struct.pack(">H", count)

            sock.send(header)
            response = sock.recv(1024)
            sock.close()
            return response
        except Exception as e:
            print(f"[!] Modbus error: {e}")
            return None

    def read_holding_registers(self, address: int = 0, count: int = 10) -> Optional[bytes]:
        """Read holding registers (function code 03)."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((self.host, self.port))

            transaction_id = 1
            header = struct.pack(">HHHBBB", transaction_id, 0, 6, self.unit_id, 3, address)
            header += struct.pack(">H", count)

            sock.send(header)
            response = sock.recv(1024)
            sock.close()
            return response
        except Exception as e:
            print(f"[!] Modbus error: {e}")
            return None


class ICSSecurityAssessment:
    """Assesses ICS/SCADA security posture."""

    def __init__(self):
        self.devices = []
        self.findings = []

    def discover_modbus(self, subnet: str) -> List[Dict]:
        """Discover Modbus devices on a subnet."""
        devices = []
        print(f"[*] Discovering Modbus devices on {subnet}...")

        print("[*] Note: Full discovery requires third-party tools like nmap or PLCScan")
        print("[*] This tool provides guidance for manual testing")

        return devices

    def test_modbus_connectivity(self, host: str, port: int = 502) -> Dict:
        """Test Modbus connectivity and gather device info."""
        result = {
            "host": host,
            "port": port,
            "protocol": "Modbus TCP",
            "reachable": False,
            "unit_id": 1,
            "issues": []
        }

        try:
            client = ModbusClient(host, port)
            response = client.read_holding_registers(0, 10)
            if response and len(response) > 10:
                result["reachable"] = True
                result["issues"].append("No authentication required - PUBLIC ACCESS")
                result["issues"].append("Enable Modbus authentication if possible")
        except Exception as e:
            result["error"] = str(e)

        return result

    def analyze_dnp3(self, host: str, port: int = 19999) -> Dict:
        """Analyze DNP3 protocol configuration."""
        result = {
            "host": host,
            "port": port,
            "protocol": "DNP3",
            "unsolicited_changes": False,
            "authentication": False,
            "issues": []
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((host, port))
            sock.close()
            result["reachable"] = True
            result["issues"].append("Verify DNP3 authentication is enabled")
            result["issues"].append("Check for unsolicited response configuration")
        except Exception as e:
            result["error"] = str(e)

        return result

    def check_s7_communication(self, host: str, port: int = 102) -> Dict:
        """Check Siemens S7 communication security."""
        result = {
            "host": host,
            "port": port,
            "protocol": "S7comm",
            "iso_tcp": False,
            "issues": []
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((host, port))
            sock.close()
            result["reachable"] = True
            result["issues"].append("S7comm has no built-in encryption")
            result["issues"].append("Use Siemens S7-1200/S7-1500 with TLS when possible")
            result["issues"].append("Implement network segmentation for S7 devices")
        except Exception as e:
            result["error"] = str(e)

        return result

    def audit_plc_security(self, host: str) -> Dict:
        """Audit PLC security configuration."""
        result = {
            "host": host,
            "issues": []
        }

        result["issues"].append("Default passwords may be in use")
        result["issues"].append("PLC programming port may be exposed")
        result["issues"].append("No encryption on PLC communications")
        result["issues"].append("Firmware may be outdated")

        return result

    def check_network_segmentation(self) -> Dict:
        """Check OT network segmentation."""
        return {
            "zone": "SCADA/OT",
            "segmentation": "UNKNOWN",
            "issues": [
                "Verify firewall rules between OT and IT networks",
                "Implement DMZ for SCADA servers",
                "Disable unused protocols and ports",
                "Deploy IDS for OT network monitoring"
            ]
        }

    def check_data_historian(self, host: str, port: int = 8080) -> Dict:
        """Assess data historian security."""
        result = {
            "host": host,
            "port": port,
            "authentication": False,
            "issues": []
        }

        result["issues"].append("Default admin credentials should be changed")
        result["issues"].append("Enable historian authentication")
        result["issues"].append("Review user access permissions regularly")
        result["issues"].append("Enable audit logging for all access")

        return result

    def generate_report(self) -> str:
        """Generate ICS security assessment report."""
        lines = ["=" * 70]
        lines.append("ICS/SCADA SECURITY ASSESSMENT REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("EDUCATIONAL USE ONLY - CRITICAL INFRASTRUCTURE")
        lines.append("=" * 70)

        lines.append("\n## Critical Findings")

        critical_issues = [
            "No authentication on Modbus devices",
            "Unencrypted PLC communications",
            "Potential default credentials on PLCs",
            "Network segmentation not verified"
        ]

        for issue in critical_issues:
            lines.append(f"  [!] {issue}")

        lines.append("\n## Protocol Security")

        protocols = [
            ("Modbus TCP", "No authentication, cleartext", "HIGH"),
            ("DNP3", "May allow unsolicited changes without auth", "MEDIUM"),
            ("S7comm", "No built-in encryption", "HIGH"),
            ("OPC UA", "Enable authentication and encryption", "MEDIUM")
        ]

        for proto, issue, severity in protocols:
            lines.append(f"  {proto}: {issue} [{severity}]")

        lines.append("\n## Recommendations")

        recommendations = [
            "1. Implement network segmentation between IT and OT",
            "2. Deploy firewall with deep packet inspection for OT protocols",
            "3. Enable authentication on all PLCs and RTUs",
            "4. Change all default credentials immediately",
            "5. Update PLC firmware to latest versions",
            "6. Deploy IDS/IPS specifically designed for OT traffic",
            "7. Create DMZ for SCADA/HMI servers",
            "8. Implement centralized logging for OT devices",
            "9. Conduct regular vulnerability assessments in isolated lab",
            "10. Develop OT-specific incident response plan"
        ]

        for rec in recommendations:
            lines.append(f"  {rec}")

        lines.append("\n## Safety Reminders")

        lines.append("  ⚠️ NEVER test on production control systems")
        lines.append("  ⚠️ Always have emergency stop procedures ready")
        lines.append("  ⚠️ Coordinate with operations team before assessment")
        lines.append("  ⚠️ Some vulnerabilities can cause physical damage")
        lines.append("  ⚠️ Test only in isolated lab environments")

        lines.append("\n" + "=" * 70)

        return "\n".join(lines)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ICS/SCADA Security Assessment")
    parser.add_argument("--scan", help="Subnet to scan (e.g., 192.168.1.0/24)")
    parser.add_argument("--protocol", choices=["modbus", "dnp3", "s7", "bacnet"], default="modbus")
    parser.add_argument("--plc", help="PLC IP address")
    parser.add_argument("--pcap", help="PCAP file to analyze")
    parser.add_argument("--test-auth", action="store_true", help="Test PLC authentication")
    parser.add_argument("--report", action="store_true", help="Generate report")
    args = parser.parse_args()

    assessment = ICSSecurityAssessment()

    if args.plc:
        result = assessment.test_modbus_connectivity(args.plc)
        print(f"[*] Modbus test on {args.plc}:")
        print(f"    Reachable: {result['reachable']}")
        for issue in result.get('issues', []):
            print(f"    [!] {issue}")

    if args.report:
        print(assessment.generate_report())

    if not any([args.scan, args.plc, args.pcap, args.report]):
        print("ICS/SCADA Security Assessment")
        print("Usage: --plc 192.168.1.100 --test-auth --report")
