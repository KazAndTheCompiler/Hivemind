#!/usr/bin/env python3
"""
Email Security Assessment Tool
EDUCATIONAL USE ONLY - Authorize before testing
"""

import re
import dns.resolver
import socket
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class EmailSecurityAnalyzer:
    """Analyzes email infrastructure security configuration."""

    def __init__(self, domain: str = ""):
        self.domain = domain
        self.findings = []

    def check_spf(self, domain: str = "") -> Dict:
        """Check SPF record configuration."""
        if not domain:
            domain = self.domain

        result = {
            "domain": domain,
            "record": "",
            "valid": False,
            "issues": []
        }

        try:
            answers = dns.resolver.resolve(domain, 'TXT')
            for rdata in answers:
                txt = rdata.to_text()
                if "v=spf1" in txt.lower():
                    result["record"] = txt
                    result["valid"] = True

                    if "include:" in txt:
                        result["issues"].append("Uses include mechanism (verify included domains)")
                    if "-all" not in txt and "~all" not in txt:
                        result["issues"].append("No strict ALL rule (-all or ~all)")
                    if "+all" in txt:
                        result["issues"].append("CRITICAL: +all allows any server")
                    break

            if not result["record"]:
                result["issues"].append("No SPF record found")

        except dns.resolver.NXDOMAIN:
            result["issues"].append("Domain does not exist")
        except dns.resolver.NoAnswer:
            result["issues"].append("No SPF record found")
        except Exception as e:
            result["issues"].append(f"DNS error: {e}")

        return result

    def check_dkim(self, domain: str = "", selector: str = "default") -> Dict:
        """Check DKIM record configuration."""
        if not domain:
            domain = self.domain

        result = {
            "domain": domain,
            "selector": selector,
            "record": "",
            "valid": False,
            "issues": []
        }

        dkim_domain = f"{selector}._domainkey.{domain}"

        try:
            answers = dns.resolver.resolve(dkim_domain, 'TXT')
            for rdata in answers:
                txt = rdata.to_text()
                if "v=DKIM1" in txt:
                    result["record"] = txt
                    result["valid"] = True

                    if "k=rsa" in txt:
                        result["algorithm"] = "RSA"
                    break

            if not result["record"]:
                result["issues"].append(f"No DKIM record for selector '{selector}'")

        except dns.resolver.NXDOMAIN:
            result["issues"].append(f"DKIM selector '{selector}' not found")
        except Exception as e:
            result["issues"].append(f"DNS error: {e}")

        return result

    def check_dmarc(self, domain: str = "") -> Dict:
        """Check DMARC record configuration."""
        if not domain:
            domain = self.domain

        result = {
            "domain": domain,
            "record": "",
            "valid": False,
            "policy": "none",
            "issues": []
        }

        dmarc_domain = f"_dmarc.{domain}"

        try:
            answers = dns.resolver.resolve(dmarc_domain, 'TXT')
            for rdata in answers:
                txt = rdata.to_text()
                if "v=DMARC1" in txt:
                    result["record"] = txt
                    result["valid"] = True

                    if "p=reject" in txt:
                        result["policy"] = "reject"
                    elif "p=quarantine" in txt:
                        result["policy"] = "quarantine"
                    elif "p=none" in txt:
                        result["policy"] = "none"

                    if result["policy"] == "none":
                        result["issues"].append("DMARC policy is 'none' (monitoring only)")
                    break

            if not result["record"]:
                result["issues"].append("No DMARC record found")

        except dns.resolver.NXDOMAIN:
            result["issues"].append("No DMARC record found")
        except Exception as e:
            result["issues"].append(f"DNS error: {e}")

        return result

    def analyze_headers(self, headers: str) -> Dict:
        """Analyze email headers for security issues."""
        result = {
            "from": "",
            "reply_to": "",
            "received_spf": "",
            "auth_results": [],
            "issues": []
        }

        from_match = re.search(r'From:\s*(.+?)(?:\n|$)', headers, re.IGNORECASE)
        if from_match:
            result["from"] = from_match.group(1).strip()

        reply_match = re.search(r'Reply-To:\s*(.+?)(?:\n|$)', headers, re.IGNORECASE)
        if reply_match:
            result["reply_to"] = reply_match.group(1).strip()

        if result["from"] and result["reply_to"] and result["from"] != result["reply_to"]:
            result["issues"].append("From and Reply-To domains differ")

        auth_results = re.findall(r'Authentication-Results:.*?(?:\n\s+.*)*', headers, re.IGNORECASE)
        result["auth_results"] = auth_results

        for ar in auth_results:
            if "fail" in ar.lower():
                result["issues"].append(f"Authentication failed: {ar[:100]}")
            if "spf=fail" in ar.lower():
                result["issues"].append("SPF check failed")
            if "dkim=fail" in ar.lower():
                result["issues"].append("DKIM check failed")
            if "dmarc=fail" in ar.lower():
                result["issues"].append("DMARC check failed")

        received_lines = re.findall(r'Received:\s*from\s+(.+?)(?:\n|$)', headers, re.IGNORECASE)
        if len(received_lines) > 5:
            result["issues"].append(f"Excessive routing hops ({len(received_lines)})")

        return result

    def check_mx_records(self, domain: str = "") -> Dict:
        """Check MX record configuration."""
        if not domain:
            domain = self.domain

        result = {
            "domain": domain,
            "mx_records": [],
            "issues": []
        }

        try:
            answers = dns.resolver.resolve(domain, 'MX')
            for rdata in answers:
                result["mx_records"].append({
                    "host": rdata.exchange.to_text().rstrip('.'),
                    "priority": rdata.preference
                })

            if len(result["mx_records"]) < 2:
                result["issues"].append("Less than 2 MX records (no redundancy)")

        except dns.resolver.NoAnswer:
            result["issues"].append("No MX records found")
        except Exception as e:
            result["issues"].append(f"DNS error: {e}")

        return result

    def run_full_analysis(self, domain: str = "") -> Dict:
        """Run complete email security analysis."""
        if not domain:
            domain = self.domain

        print(f"[*] Analyzing email security for {domain}...")

        analysis = {
            "domain": domain,
            "timestamp": datetime.now().isoformat(),
            "spf": self.check_spf(domain),
            "dkim": self.check_dkim(domain),
            "dmarc": self.check_dmarc(domain),
            "mx": self.check_mx_records(domain)
        }

        return analysis

    def generate_report(self, analysis: Dict = None) -> str:
        """Generate email security assessment report."""
        if not analysis:
            analysis = self.run_full_analysis()

        lines = ["=" * 60]
        lines.append("EMAIL SECURITY ASSESSMENT REPORT")
        lines.append(f"Domain: {analysis['domain']}")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)

        spf = analysis.get("spf", {})
        lines.append("\n## SPF Configuration")
        lines.append(f"Valid: {'YES' if spf.get('valid') else 'NO'}")
        if spf.get("record"):
            lines.append(f"Record: {spf['record'][:80]}...")
        for issue in spf.get("issues", []):
            lines.append(f"  [!] {issue}")

        dkim = analysis.get("dkim", {})
        lines.append("\n## DKIM Configuration")
        lines.append(f"Valid: {'YES' if dkim.get('valid') else 'NO'}")
        if dkim.get("record"):
            lines.append(f"Record: {dkim['record'][:80]}...")
        for issue in dkim.get("issues", []):
            lines.append(f"  [!] {issue}")

        dmarc = analysis.get("dmarc", {})
        lines.append("\n## DMARC Configuration")
        lines.append(f"Valid: {'YES' if dmarc.get('valid') else 'NO'}")
        lines.append(f"Policy: {dmarc.get('policy', 'unknown').upper()}")
        if dmarc.get("record"):
            lines.append(f"Record: {dmarc['record'][:80]}...")
        for issue in dmarc.get("issues", []):
            lines.append(f"  [!] {issue}")

        mx = analysis.get("mx", {})
        lines.append("\n## MX Configuration")
        lines.append(f"MX Records: {len(mx.get('mx_records', []))}")
        for record in mx.get("mx_records", []):
            lines.append(f"  - {record['host']} (priority: {record['priority']})")
        for issue in mx.get("issues", []):
            lines.append(f"  [!] {issue}")

        lines.append("\n## Summary")
        total_issues = (len(spf.get("issues", [])) + len(dkim.get("issues", [])) +
                        len(dmarc.get("issues", [])) + len(mx.get("issues", [])))
        lines.append(f"Total issues: {total_issues}")

        if total_issues == 0:
            lines.append("Status: GOOD - All email security controls properly configured")
        else:
            lines.append("Status: NEEDS ATTENTION - Review issues above")

        lines.append("\n## Recommendations")
        if not spf.get("valid"):
            lines.append("  - Add SPF record with include mechanism for your email provider")
        if not dkim.get("valid"):
            lines.append("  - Enable DKIM signing on your email server")
        if dmarc.get("policy") == "none":
            lines.append("  - Consider p=quarantine or p=reject for DMARC policy")
        if len(mx.get("mx_records", [])) < 2:
            lines.append("  - Add secondary MX server for redundancy")

        return "\n".join(lines)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Email Security Assessment Tool")
    parser.add_argument("--domain", help="Domain to analyze")
    parser.add_argument("--analyze", action="store_true", help="Run full analysis")
    parser.add_argument("--headers", help="Analyze email headers")
    parser.add_argument("--check-auth", help="Check authentication records")
    args = parser.parse_args()

    analyzer = EmailSecurityAnalyzer(args.domain or "example.com")

    if args.analyze:
        analysis = analyzer.run_full_analysis()
        print(analyzer.generate_report(analysis))
    elif args.headers:
        result = analyzer.analyze_headers(args.headers)
        print(f"[+] From: {result['from']}")
        print(f"[+] Reply-To: {result['reply_to']}")
        if result["issues"]:
            print("\n[!] Issues found:")
            for issue in result["issues"]:
                print(f"    {issue}")
    elif args.check_auth:
        analysis = analyzer.run_full_analysis(args.check_auth)
        print(analyzer.generate_report(analysis))
    else:
        print("Email Security Assessment Tool")
        print("Usage: email_security.py --domain example.com --analyze")
