#!/usr/bin/env python3
"""
Vulnerability Analysis Framework - Project 38
Systematic vulnerability research and documentation.

EDUCATIONAL USE ONLY. Only analyze vulnerabilities you have permission to study.
"""

import os
import sys
import json
import requests
import time
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class Vulnerability:
    cve_id: str
    title: str
    severity: str
    cvss_score: float
    description: str
    affected_versions: List[str]
    remediation: str
    references: List[str]

class VulnerabilityAnalyzer:
    """Framework for vulnerability analysis."""
    
    NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    
    def __init__(self):
        self.cache = {}
    
    def fetch_cve(self, cve_id: str) -> Optional[Dict]:
        """Fetch CVE details from NVD API."""
        if cve_id in self.cache:
            return self.cache[cve_id]
        
        try:
            params = {'cveId': cve_id}
            response = requests.get(self.NVD_API, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('totalResults', 0) > 0:
                    self.cache[cve_id] = data['vulnerabilities'][0]
                    return self.cache[cve_id]
        except Exception as e:
            print(f"[!] Error fetching {cve_id}: {e}")
        
        return None
    
    def analyze_vulnerability(self, cve_id: str) -> Vulnerability:
        """Analyze and document vulnerability."""
        print(f"[*] Analyzing: {cve_id}")
        
        data = self.fetch_cve(cve_id)
        
        if not data:
            return Vulnerability(
                cve_id=cve_id,
                title="Unknown",
                severity="Unknown",
                cvss_score=0.0,
                description="CVE not found",
                affected_versions=[],
                remediation="Unknown",
                references=[]
            )
        
        cve = data.get('cve', {})
        
        # Extract CVSS score
        cvss_data = cve.get('metrics', {}).get('cvssMetricV31', [])
        if not cvss_data:
            cvss_data = cve.get('metrics', {}).get('cvssMetricV30', [])
        if not cvss_data:
            cvss_data = cve.get('metrics', {}).get('cvssMetricV2', [])
        
        cvss_score = 0.0
        severity = "Unknown"
        
        if cvss_data:
            cvss = cvss_data[0].get('cvssData', {})
            cvss_score = cvss.get('baseScore', 0.0)
            severity = cvss.get('baseSeverity', 'Unknown')
        
        # Extract description
        descriptions = cve.get('description', [])
        description = ""
        for desc in descriptions:
            if desc.get('lang') == 'en':
                description = desc.get('value', '')
                break
        
        # Extract references
        references = [ref.get('url', '') for ref in cve.get('references', [])[:5]]
        
        return Vulnerability(
            cve_id=cve_id,
            title=cve.get('configurations', [{}])[0].get('nodes', [{}])[0].get('cpeMatch', [{}])[0].get('criteria', cve_id),
            severity=severity,
            cvss_score=cvss_score,
            description=description[:200] + "..." if len(description) > 200 else description,
            affected_versions=[],
            remediation=f"Apply patch for {cve_id}",
            references=references
        )
    
    def generate_report(self, vuln: Vulnerability) -> str:
        """Generate vulnerability report."""
        severity_emoji = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢',
            'Unknown': '⚪'
        }
        
        emoji = severity_emoji.get(vuln.severity, '⚪')
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     VULNERABILITY ANALYSIS REPORT                            ║
╚════════════════════════════════════════════════════════════════╝

{emoji} {vuln.cve_id} - {vuln.title[:60]}

────────────────────────────────────────────────────────────────
BASIC INFORMATION
────────────────────────────────────────────────────────────────

CVE ID:      {vuln.cve_id}
Severity:    {vuln.severity}
CVSS Score:  {vuln.cvss_score}

────────────────────────────────────────────────────────────────
DESCRIPTION
────────────────────────────────────────────────────────────────

{vuln.description}

────────────────────────────────────────────────────────────────
CVSS VECTOR
────────────────────────────────────────────────────────────────

Score: {vuln.cvss_score}/10 ({vuln.severity})

────────────────────────────────────────────────────────────────
REMEDIATION
────────────────────────────────────────────────────────────────

{vuln.remediation}

────────────────────────────────────────────────────────────────
REFERENCES
────────────────────────────────────────────────────────────────

"""
        
        for ref in vuln.references:
            report += f"- {ref}\n"
        
        return report

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Vulnerability Analysis Framework - Project 38             ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only analyze vulnerabilities you have permission to study  ║
╚════════════════════════════════════════════════════════════════╝

CVSS SCORE INTERPRETATION:

| Score | Severity | Action |
|-------|----------|--------|
| 0.0 | None | Informational |
| 0.1-3.9 | Low | Monitor |
| 4.0-6.9 | Medium | Prioritize |
| 7.0-8.9 | High | Urgent |
| 9.0-10.0 | Critical | Immediate |

COMMON CVE SOURCES:

- NVD (National Vulnerability Database)
- MITRE CVE
- Exploit-DB
- CVE Details
- Rapid7

ANALYSIS WORKFLOW:

1. IDENTIFY
   - CVE ID research
   - Affected component finding
   
2. ASSESS
   - CVSS scoring
   - Attack complexity
   - Privileges required
   
3. EXPLOIT ANALYSIS
   - Public exploits available?
   - Metasploit modules?
   - Proof of concept?
   
4. REMEDIATION
   - Patch availability
   - Workarounds
   - Compensating controls

DATABASES AND TOOLS:

- NVD API: https://services.nvd.nist.gov/rest/json/cves/2.0
- cve.sh: https://cve.sh/
- Edison: https://www.edn.sh/
- Nist OVAL: https://oval.cisecurity.org/
    """)
    
    analyzer = VulnerabilityAnalyzer()
    
    # Demo with known CVE
    if len(sys.argv) > 1:
        cve_id = sys.argv[1]
        vuln = analyzer.analyze_vulnerability(cve_id)
        print(analyzer.generate_report(vuln))
    else:
        # Demo with example CVE
        print("\n[*] Running demo analysis...\n")
        demo_cves = ['CVE-2021-44228', 'CVE-2021-45046']  # Log4j
        for cve in demo_cves:
            vuln = analyzer.analyze_vulnerability(cve)
            print(f"  {vuln.cve_id}: {vuln.severity} ({vuln.cvss_score})")
            time.sleep(1)

if __name__ == "__main__":
    main()