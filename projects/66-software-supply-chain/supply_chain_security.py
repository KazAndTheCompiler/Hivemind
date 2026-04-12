#!/usr/bin/env python3
"""
Software Supply Chain Security Framework
EDUCATIONAL USE ONLY - Authorize before testing
"""

import os
import re
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Set
from dataclasses import dataclass


@dataclass
class Dependency:
    name: str
    version: str
    license: str = "Unknown"
    vulnerabilities: List[str] = None
    risk_level: str = "unknown"

    def __post_init__(self):
        if self.vulnerabilities is None:
            self.vulnerabilities = []


class SupplyChainSecurity:
    """Assesses software supply chain security."""

    def __init__(self):
        self.dependencies = []
        self.vulnerabilities_found = []
        self.licenses_of_concern = [
            "GPL-3.0", "AGPL-3.0", "LGPL-3.0",
            "CC-BY-NC", "CC-BY-SA"
        ]
        self.typosquatting_patterns = [
            "requests", "reqeusts", "requesst",
            "django", "djago", "dijango",
            "numpy", "numby", "numpi"
        ]

    def scan_requirements(self, filepath: str) -> List[Dependency]:
        """Scan requirements.txt or similar files."""
        deps = []
        if not os.path.exists(filepath):
            print(f"[!] File not found: {filepath}")
            return deps

        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                match = re.match(r'([a-zA-Z0-9_-]+)\s*([><=!~]+)?\s*([0-9a-zA-Z._-]+)?', line)
                if match:
                    name, op, version = match.groups()
                    dep = Dependency(name=name, version=version or "any")
                    deps.append(dep)
                    self.dependencies.append(dep)

        print(f"[+] Scanned {len(deps)} dependencies from {filepath}")
        return deps

    def scan_directory(self, directory: str) -> List[str]:
        """Find dependency files in a directory."""
        dep_files = []
        patterns = ["requirements.txt", "package.json", "go.mod", "Cargo.toml",
                   "Pipfile", "setup.py", "pyproject.toml"]

        for root, _, files in os.walk(directory):
            for f in files:
                if any(p in f for p in patterns):
                    dep_files.append(os.path.join(root, f))

        return dep_files

    def check_vulnerabilities(self, dep: Dependency) -> List[str]:
        """Check for known vulnerabilities in a dependency."""
        vulnerabilities = []

        vuln_db = {
            "requests": ["CVE-2023-32681", "CVE-2022-42969"],
            "django": ["CVE-2023-36053", "CVE-2023-30845"],
            "flask": ["CVE-2023-30861"],
            "numpy": ["CVE-2021-28658", "CVE-2022-43682"],
            "pyyaml": ["CVE-2020-14343"],
        }

        if dep.name.lower() in vuln_db:
            vulns = vuln_db[dep.name.lower()]
            for v in vulns:
                vulnerabilities.append(v)
                self.vulnerabilities_found.append({
                    "dependency": dep.name,
                    "version": dep.version,
                    "cve": v
                })

        return vulnerabilities

    def check_license(self, dep: Dependency) -> List[str]:
        """Check for concerning licenses."""
        issues = []
        for license in self.licenses_of_concern:
            if license in dep.license:
                issues.append(f"License concern: {license}")
        return issues

    def check_typosquatting(self, dep: Dependency) -> Optional[str]:
        """Check for typosquatting patterns."""
        dep_name_lower = dep.name.lower()
        for pattern in self.typosquatting_patterns:
            if pattern in dep_name_lower and dep.name != pattern:
                return f"Possible typosquatting: {dep.name} (similar to {pattern})"
        return None

    def generate_sbom(self, format: str = "spdx") -> str:
        """Generate Software Bill of Materials."""
        if format == "spdx":
            sbom = ["SPDXVersion: SPDX-2.3",
                    f"DataLicense: CC政府-1.0",
                    f"SPDXID: SPDXRef-DOCUMENT",
                    f"DocumentName: SecDev Supply Chain Assessment",
                    f"DocumentNamespace: https://secdev.project/supply-chain"]
            
            for i, dep in enumerate(self.dependencies):
                sbom.append(f"PackageName: {dep.name}")
                sbom.append(f"SPDXID: SPDXRef-Package-{i}")
                sbom.append(f"PackageVersion: {dep.version}")
                sbom.append(f"PackageLicenseConcluded: {dep.license}")
                sbom.append("")

            return "\n".join(sbom)
        return ""

    def audit_cicd(self, workflow_dir: str) -> Dict:
        """Audit CI/CD pipeline for security issues."""
        findings = []

        if not os.path.exists(workflow_dir):
            return {"error": "Directory not found"}

        for root, _, files in os.walk(workflow_dir):
            for f in files:
                if f.endswith(('.yml', '.yaml')):
                    path = os.path.join(root, f)
                    with open(path, 'r') as fh:
                        content = fh.read()

                    if "pull_request_target" in content:
                        findings.append({
                            "file": path,
                            "issue": "pull_request_target used - may allow PR author code execution",
                            "severity": "high"
                        })

                    if "checkout" in content and "persist-credentials" not in content:
                        findings.append({
                            "file": path,
                            "issue": "git checkout may persist credentials",
                            "severity": "medium"
                        })

                    if "secrets:" in content and "GITHUB_TOKEN" not in content:
                        findings.append({
                            "file": path,
                            "issue": "Workflow may expose secrets",
                            "severity": "high"
                        })

                    if re.search(r'\$\{\{\s*.*\.\s*github\.\s*event\.\s*head_ref\s*\}\}', content):
                        findings.append({
                            "file": path,
                            "issue": "Head ref from PR used unsafely",
                            "severity": "medium"
                        })

        return {"findings": findings, "files_audited": len(findings)}

    def verify_artifact(self, filepath: str, expected_hash: str = "") -> bool:
        """Verify artifact integrity."""
        if not os.path.exists(filepath):
            print(f"[!] Artifact not found: {filepath}")
            return False

        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)

        actual_hash = sha256_hash.hexdigest()
        print(f"[+] Artifact SHA256: {actual_hash}")

        if expected_hash:
            if actual_hash == expected_hash:
                print("[+] Hash matches - artifact integrity verified")
                return True
            else:
                print("[!] Hash mismatch - artifact may be tampered")
                return False

        return True

    def generate_report(self) -> str:
        """Generate supply chain security report."""
        lines = ["=" * 60]
        lines.append("SOFTWARE SUPPLY CHAIN SECURITY REPORT")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)

        lines.append(f"\nDependencies scanned: {len(self.dependencies)}")

        vulnerable = [d for d in self.dependencies if self.check_vulnerabilities(d)]
        lines.append(f"\nVulnerabilities found: {len(self.vulnerabilities_found)}")

        for vuln in self.vulnerabilities_found[:10]:
            lines.append(f"  [!] {vuln['cve']} in {vuln['dependency']}@{vuln['version']}")

        high_risk = [d for d in self.dependencies if d.risk_level == "high"]
        if high_risk:
            lines.append(f"\nHigh risk dependencies: {len(high_risk)}")
            for dep in high_risk:
                lines.append(f"  - {dep.name}@{dep.version}")

        lines.append("\n## Recommendations")
        lines.append("  1. Implement automated dependency scanning in CI/CD")
        lines.append("  2. Use lock files (package-lock.json, Pipfile.lock)")
        lines.append("  3. Pin dependencies to known-good versions")
        lines.append("  4. Generate and verify SBOM for all releases")
        lines.append("  5. Audit third-party scripts in build pipelines")
        lines.append("  6. Use dependency pinning and verify checksums")

        return "\n".join(lines)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Software Supply Chain Security")
    parser.add_argument("--scan", help="Scan project directory")
    parser.add_argument("--sbom", help="Generate SBOM")
    parser.add_argument("--format", choices=["spdx", "cyclonedx"], default="spdx")
    parser.add_argument("--check-packages", help="Check requirements file")
    parser.add_argument("--audit-cicd", help="Audit CI/CD workflows")
    args = parser.parse_args()

    framework = SupplyChainSecurity()

    if args.check_packages:
        framework.scan_requirements(args.check_packages)
        for dep in framework.dependencies:
            vulns = framework.check_vulnerabilities(dep)
            if vulns:
                print(f"[!] {dep.name}: {', '.join(vulns)}")

    if args.scan:
        dep_files = framework.scan_directory(args.scan)
        for f in dep_files:
            if "requirements" in f:
                framework.scan_requirements(f)

    if args.sbom:
        dep_files = framework.scan_directory(args.sbom)
        for f in dep_files:
            if "requirements" in f:
                framework.scan_requirements(f)
        print(framework.generate_sbom(args.format))

    if args.audit_cicd:
        result = framework.audit_cicd(args.audit_cicd)
        for finding in result.get("findings", []):
            print(f"[!] {finding['file']}: {finding['issue']}")

    if not any([args.scan, args.sbom, args.check_packages, args.audit_cicd]):
        print("Supply Chain Security - Use --scan, --sbom, --check-packages, or --audit-cicd")
