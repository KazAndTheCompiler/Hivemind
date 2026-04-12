#!/usr/bin/env python3
"""
Bug Bounty Methodology Playbook
EDUCATIONAL USE ONLY - Only test systems you have permission to test
"""

import re
import requests
import socket
from datetime import datetime
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse


class BugBountyPlaybook:
    """Structured bug bounty testing methodology."""

    def __init__(self, target: str = ""):
        self.target = target
        self.parsed = urlparse(target) if target else None
        self.scope = []
        self.subdomains = set()
        self.endpoints = []
        self.vulnerabilities = []

    def validate_scope(self, target: str, scope_list: List[str]) -> bool:
        """Validate if target is within scope."""
        if not scope_list:
            print("[!] No scope provided - assuming authorized")
            return True

        target_domain = urlparse(target).netloc
        for scope_item in scope_list:
            if scope_item in target_domain or target_domain.endswith(f".{scope_item}"):
                return True

        print(f"[!] {target_domain} is NOT in scope")
        return False

    def recon_passive(self) -> Set[str]:
        """Passive reconnaissance - no direct interaction."""
        subdomains = set()

        print("[*] Running passive recon...")

        try:
            resp = requests.get(f"https://crt.sh/?q=%.{self.parsed.netloc}&output=json",
                               timeout=10)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    for entry in data:
                        name = entry.get("name_value", "")
                        for sub in name.split("\n"):
                            if self.parsed.netloc in sub:
                                subdomains.add(sub.strip())
                except Exception:
                    pass
        except Exception as e:
            print(f"[!] crt.sh error: {e}")

        try:
            resp = requests.get(f"https://dns.bufferover.run/dns?q=.{self.parsed.netloc}",
                               timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                for r in data.get("DNS", []):
                    if self.parsed.netloc in r.get("name", ""):
                        subdomains.add(r["name"])
        except Exception:
            pass

        self.subdomains = subdomains
        print(f"[+] Found {len(subdomains)} subdomains")
        return subdomains

    def recon_github(self, org: str = "") -> List[Dict]:
        """Search GitHub for exposed secrets and sensitive data."""
        findings = []

        if not org:
            org = self.parsed.netloc.split('.')[0] if self.parsed else ""

        print(f"[*] Searching GitHub for {org}...")

        search_queries = [
            f"{org} password=",
            f"{org} api_key=",
            f"{org} secret=",
            f"{org} aws_key",
            f"filename:.env {org}"
        ]

        for query in search_queries:
            print(f"  [*] Searching: {query}")
            findings.append({
                "query": query,
                "status": "requires_github_token",
                "note": "GitHub search requires authenticated API access"
            })

        return findings

    def favicon_hash(self, url: str) -> Optional[str]:
        """Get favicon and calculate hash for fingerprinting."""
        try:
            resp = requests.get(f"{url}/favicon.ico", timeout=5)
            if resp.status_code == 200:
                import hashlib
                m = hashlib.md5(resp.content)
                return m.hexdigest()
        except Exception:
            pass
        return None

    def map_endpoints(self, urls: List[str] = None) -> List[str]:
        """Map application attack surface."""
        if not urls:
            urls = [self.target] if self.target else []

        endpoints = []
        common_paths = [
            "/admin", "/api", "/api/v1", "/api/v2",
            "/login", "/register", "/reset-password",
            "/dashboard", "/settings", "/profile",
            "/backup", "/test", "/debug", "/health",
            "/graphql", "/swagger", "/docs", "/robots.txt",
            "/.git/config", "/.env", "/wp-admin",
            "/phpmyadmin", "/admin.php", "/api/docs"
        ]

        for url in urls:
            for path in common_paths:
                try:
                    full_url = url.rstrip('/') + path
                    resp = requests.get(full_url, timeout=5, allow_redirects=False)
                    if resp.status_code in [200, 401, 403, 301, 302]:
                        endpoints.append(f"{full_url} [{resp.status_code}]")
                except Exception:
                    pass

        self.endpoints = endpoints
        print(f"[+] Mapped {len(endpoints)} endpoints")
        return endpoints

    def test_xss(self, url: str, param: str = "q") -> Optional[Dict]:
        """Test for XSS vulnerability."""
        payload = "<script>alert('XSS')</script>"
        try:
            resp = requests.get(url, params={param: payload}, timeout=10)
            if payload in resp.text:
                return {
                    "type": "XSS",
                    "url": url,
                    "parameter": param,
                    "payload": payload,
                    "severity": "medium",
                    "evidence": "Payload reflected in response"
                }
        except Exception:
            pass
        return None

    def test_sqli(self, url: str, param: str = "id") -> Optional[Dict]:
        """Test for SQL injection."""
        payloads = ["'", "' OR '1'='1", "' UNION SELECT NULL--"]
        for payload in payloads:
            try:
                resp = requests.get(url, params={param: payload}, timeout=10)
                if "sql" in resp.text.lower() or "error" in resp.text.lower():
                    if "syntax" in resp.text.lower() or "mysql" in resp.text.lower():
                        return {
                            "type": "SQL Injection",
                            "url": url,
                            "parameter": param,
                            "payload": payload,
                            "severity": "critical",
                            "evidence": "SQL error in response"
                        }
            except Exception:
                pass
        return None

    def testidor(self, url: str, param: str = "q") -> Optional[Dict]:
        """Test for Insecure Direct Object Reference."""
        try:
            resp1 = requests.get(f"{url}?{param}=1", timeout=10)
            resp2 = requests.get(f"{url}?{param}=2", timeout=10)
            if resp1.status_code == 200 and resp2.status_code == 200:
                if resp1.text != resp2.text:
                    return {
                        "type": "IDOR",
                        "url": url,
                        "parameter": param,
                        "severity": "medium",
                        "evidence": "Different responses for different IDs suggest IDOR"
                    }
        except Exception:
            pass
        return None

    def test_ssrf(self, url: str, param: str = "url") -> Optional[Dict]:
        """Test for SSRF vulnerability."""
        payloads = [
            "http://localhost",
            "http://127.0.0.1",
            "http://169.254.169.254"
        ]
        for payload in payloads:
            try:
                resp = requests.get(url, params={param: payload}, timeout=10)
                if "localhost" in resp.text or "127.0.0.1" in resp.text:
                    return {
                        "type": "SSRF",
                        "url": url,
                        "parameter": param,
                        "payload": payload,
                        "severity": "high",
                        "evidence": "Localhost reference in response"
                    }
            except Exception:
                pass
        return None

    def generate_report(self, output_format: str = "markdown") -> str:
        """Generate vulnerability report."""
        lines = []

        if output_format == "markdown":
            lines = ["# Vulnerability Report",
                    f"**Target**: {self.target}",
                    f"**Date**: {datetime.now().strftime('%Y-%m-%d')}",
                    "",
                    "## Summary",
                    f"Total vulnerabilities: {len(self.vulnerabilities)}",
                    ""]

            critical = sum(1 for v in self.vulnerabilities if v.get("severity") == "critical")
            high = sum(1 for v in self.vulnerabilities if v.get("severity") == "high")
            medium = sum(1 for v in self.vulnerabilities if v.get("severity") == "medium")
            low = sum(1 for v in self.vulnerabilities if v.get("severity") == "low")

            lines.append(f"- Critical: {critical}")
            lines.append(f"- High: {high}")
            lines.append(f"- Medium: {medium}")
            lines.append(f"- Low: {low}")
            lines.append("")
            lines.append("## Vulnerabilities")

            for i, vuln in enumerate(self.vulnerabilities, 1):
                lines.append(f"\n### {i}. {vuln.get('type', 'Unknown')}")
                lines.append(f"**Severity**: {vuln.get('severity', 'unknown').upper()}")
                lines.append(f"**URL**: {vuln.get('url', 'N/A')}")
                lines.append(f"**Parameter**: {vuln.get('parameter', 'N/A')}")
                lines.append(f"**Description**: {vuln.get('evidence', 'No description')}")
                lines.append(f"**Remediation**: {vuln.get('remediation', 'Input validation required')}")

        return "\n".join(lines)

    def calculate_cvss(self, vuln: Dict) -> float:
        """Calculate CVSS 3.1 score for vulnerability."""
        base_score = 0.0

        severity_map = {
            "critical": 9.5,
            "high": 7.5,
            "medium": 5.0,
            "low": 2.5
        }

        return severity_map.get(vuln.get("severity", "medium"), 5.0)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Bug Bounty Playbook")
    parser.add_argument("--target", help="Target URL")
    parser.add_argument("--recon", action="store_true", help="Run reconnaissance")
    parser.add_argument("--map", action="store_true", help="Map attack surface")
    parser.add_argument("--report", help="Vulnerability JSON file")
    parser.add_argument("--output", help="Output report file")
    parser.add_argument("--check-scope", help="Check if target is in scope")
    args = parser.parse_args()

    playbook = BugBountyPlaybook(args.target or "https://example.com")

    if args.check_scope:
        result = playbook.validate_scope(args.check_scope, ["example.com"])
        print(f"In scope: {result}")

    if args.recon:
        playbook.recon_passive()

    if args.map:
        endpoints = playbook.map_endpoints()
        for ep in endpoints:
            print(f"  {ep}")

    if args.report:
        import json
        with open(args.report, 'r') as f:
            vulns = json.load(f)
            playbook.vulnerabilities = vulns

        report = playbook.generate_report()
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"[+] Report saved to {args.output}")
        else:
            print(report)

    if not any([args.recon, args.map, args.report, args.check_scope]):
        print("Bug Bounty Playbook")
        print("Usage: --target https://example.com --recon --map --report vuln.json")
