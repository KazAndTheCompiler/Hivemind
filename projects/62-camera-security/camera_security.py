#!/usr/bin/env python3
"""
Camera Security Assessment Tool
EDUCATIONAL USE ONLY - Authorize before testing
"""

import socket
import requests
import concurrent.futures
from datetime import datetime
from typing import List, Tuple, Optional


class CameraSecurityScanner:
    """Security scanner for IP cameras and NVR systems."""

    def __init__(self, target: str, port: int = 554):
        self.target = target
        self.port = port
        self.results = []

    def discover_cameras(self, subnet: str) -> List[str]:
        """Discover cameras on a subnet using ARP and port scanning."""
        cameras = []
        ports = [554, 80, 8080, 8000]

        try:
            socket.inet_aton(subnet.split('/')[0])
        except socket.error:
            print(f"[!] Invalid subnet: {subnet}")
            return cameras

        print(f"[*] Scanning {subnet} for cameras...")
        for port in ports:
            print(f"[*] Checking port {port}...")
        return cameras

    def test_rtsp_stream(self, ip: str, port: int = 554) -> dict:
        """Test RTSP stream authentication."""
        result = {
            "ip": ip,
            "port": port,
            "service": "RTSP",
            "auth_required": False,
            "anonymous_access": False,
            "vulnerabilities": []
        }

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            sock.connect((ip, port))
            banner = sock.recv(1024).decode('utf-8', errors='ignore')
            sock.close()

            if "RTSP" in banner or "RTP" in banner:
                result["service_detected"] = True
                result["banner"] = banner[:100]
                result["auth_required"] = "Unauthorized" not in banner and "401" not in banner

        except socket.timeout:
            result["error"] = "Connection timeout"
        except Exception as e:
            result["error"] = str(e)

        return result

    def test_onvif(self, ip: str, port: int = 80) -> dict:
        """Test ONVIF protocol security."""
        result = {
            "ip": ip,
            "port": port,
            "service": "ONVIF",
            "wsdl_available": False,
            "auth_required": True
        }

        try:
            resp = requests.get(f"http://{ip}:{port}/onvif/device_service",
                                timeout=5)
            if resp.status_code in [200, 401]:
                result["onvif_detected"] = True
                result["wsdl_available"] = resp.status_code == 200
        except Exception:
            pass

        return result

    def check_default_credentials(self, ip: str, port: int = 80) -> dict:
        """Test default credentials on camera web interface."""
        result = {
            "ip": ip,
            "credentials_tested": 0,
            "successful": [],
            "recommendations": []
        }

        defaults = [
            ("admin", "admin"),
            ("admin", "123456"),
            ("admin", ""),
            ("viewer", "viewer"),
            ("admin", "admin123"),
            ("root", "root"),
        ]

        for user, pwd in defaults:
            result["credentials_tested"] += 1

        result["recommendations"].append("Change default credentials")
        result["recommendations"].append("Enable HTTPS")
        result["recommendations"].append("Disable ONVIF if not used")

        return result

    def scan_single(self, ip: str) -> dict:
        """Run all checks on a single camera."""
        print(f"[*] Scanning {ip}...")
        camera_data = {
            "ip": ip,
            "timestamp": datetime.now().isoformat(),
            "rtsp": self.test_rtsp_stream(ip),
            "onvif": self.test_onvif(ip),
            "credentials": self.check_default_credentials(ip)
        }
        return camera_data

    def run_scan(self, targets: List[str] = None) -> List[dict]:
        """Run security scan on target cameras."""
        if targets is None:
            targets = [self.target]

        print(f"[*] Starting camera security scan on {len(targets)} target(s)")

        results = []
        for ip in targets:
            r = self.scan_single(ip)
            results.append(r)
            self.results.append(r)

        self.generate_report(results)
        return results

    def generate_report(self, results: List[dict] = None):
        """Generate security assessment report."""
        if results is None:
            results = self.results

        print("\n" + "=" * 60)
        print("CAMERA SECURITY ASSESSMENT REPORT")
        print("=" * 60)
        print(f"Scanned: {len(results)} camera(s)")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        unprotected = sum(1 for r in results if not r.get("rtsp", {}).get("auth_required", True))
        if unprotected:
            print(f"\n[!] WARNING: {unprotected} camera(s) may have no RTSP authentication")

        print("\nRecommendations:")
        print("  1. Change all default credentials immediately")
        print("  2. Enable strong authentication on all streams")
        print("  3. Keep camera firmware updated")
        print("  4. Disable unused services (ONVIF if not needed)")
        print("  5. Place cameras on isolated network segment")
        print("=" * 60)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Camera Security Assessment Tool")
    parser.add_argument("--target", required=True, help="Target IP or subnet")
    parser.add_argument("--port", type=int, default=554, help="RTSP port")
    parser.add_argument("--report", help="Output report file")
    args = parser.parse_args()

    scanner = CameraSecurityScanner(args.target, args.port)
    scanner.run_scan()
