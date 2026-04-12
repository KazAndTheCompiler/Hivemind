#!/usr/bin/env python3
"""
Threat Intelligence Platform - Project 61
STIX/TAXII integration and IOC analysis.

EDUCATIONAL USE ONLY. For security monitoring.
"""

import os
import sys
import json
import requests
from typing import Dict, List, Optional
from datetime import datetime

class ThreatIntelPlatform:
    """Threat intelligence platform framework."""
    
    STIX_PATTERNS = {
        'ipv4': "ipv4-addr:value = '{indicator}'",
        'domain': "domain-name:value = '{indicator}'",
        'url': "url:value = '{indicator}'",
        'hash_md5': "file:hashes.'MD5' = '{indicator}'",
        'hash_sha256': "file:hashes.'SHA-256' = '{indicator}'",
    }
    
    def __init__(self):
        self.iocs = []
        self.threat_actors = []
    
    def check_virustotal(self, indicator: str, api_key: str = "") -> Dict:
        """Check indicator against VirusTotal."""
        if not api_key:
            return {'error': 'No API key provided'}
        
        try:
            headers = {'x-apikey': api_key}
            
            # Determine type
            if len(indicator) == 32:  # MD5
                url = f'https://www.virustotal.com/api/v3/files/{indicator}'
            elif len(indicator) == 64:  # SHA256
                url = f'https://www.virustotal.com/api/v3/files/{indicator}'
            elif '.' in indicator and '/' not in indicator:  # Domain
                url = f'https://www.virustotal.com/api/v3/domains/{indicator}'
            else:  # IP or URL
                url = f'https://www.virustotal.com/api/v3/ip_addresses/{indicator}'
            
            response = requests.get(url, headers=headers, timeout=10)
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            return {'error': str(e)}
    
    def check_alienvault(self, indicator: str) -> Dict:
        """Check against AlienVault OTX."""
        try:
            url = f'https://otx.alienvault.com/api/v1/indicator/generic/{indicator}'
            response = requests.get(url, timeout=10)
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            return {'error': str(e)}
    
    def check_abusech(self, indicator: str) -> Dict:
        """Check against Abuse.ch Malware Bazaar."""
        try:
            url = 'https://mb-api.abuse.ch/api/v1/'
            data = {'query': 'get_info', 'ioc_value': indicator}
            response = requests.post(url, data=data, timeout=10)
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_ioc(self, indicator: str) -> Dict:
        """Full IOC analysis across multiple sources."""
        results = {
            'indicator': indicator,
            'timestamp': datetime.now().isoformat(),
            'sources': {}
        }
        
        # AlienVault OTX
        print(f"[*] Checking AlienVault OTX for: {indicator}")
        results['sources']['alienvault'] = self.check_alienvault(indicator)
        
        # Abuse.ch
        print(f"[*] Checking Abuse.ch for: {indicator}")
        results['sources']['abusech'] = self.check_abusech(indicator)
        
        # Classification
        results['classification'] = self.classify_ioc(results['sources'])
        
        return results
    
    def classify_ioc(self, sources: Dict) -> str:
        """Classify IOC based on sources."""
        for source in sources.values():
            if isinstance(source, dict):
                if source.get('pulse_info', {}).get('count', 0) > 0:
                    return 'MALICIOUS'
                if source.get('data', []):
                    return 'SUSPICIOUS'
        return 'UNKNOWN'
    
    def create_stix_bundle(self, indicators: List[Dict]) -> Dict:
        """Create STIX 2.1 bundle."""
        bundle = {
            'type': 'bundle',
            'id': f'bundle--{datetime.now().strftime(\"%Y%m%d%H%M%S\")}',
            'objects': []
        }
        
        for indicator in indicators:
            stix_obj = {
                'type': 'indicator',
                'spec_version': '2.1',
                'id': f"indicator--{indicator['indicator'].replace('.', '')}",
                'created': datetime.now().isoformat(),
                'modified': datetime.now().isoformat(),
                'pattern': f"file:hashes.'SHA-256' = '{indicator['indicator']}'",
                'pattern_type': 'stix',
                'valid_from': datetime.now().isoformat(),
                'labels': ['malware']
            }
            bundle['objects'].append(stix_obj)
        
        return bundle
    
    def generate_report(self, results: Dict) -> str:
        """Generate threat intelligence report."""
        classification_colors = {
            'MALICIOUS': '🔴',
            'SUSPICIOUS': '🟡',
            'UNKNOWN': '⚪'
        }
        
        emoji = classification_colors.get(results['classification'], '⚪')
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     THREAT INTELLIGENCE REPORT                               ║
╚════════════════════════════════════════════════════════════════╝

Indicator: {results['indicator']}
Classification: {emoji} {results['classification']}
Analyzed: {results['timestamp']}

"""
        
        for source, data in results['sources'].items():
            if isinstance(data, dict) and 'error' not in data:
                report += f"Source: {source.upper()}\n"
                report += f"  Pulses: {data.get('pulse_info', {}).get('count', 0)}\n"
                report += f"  Tags: {data.get('pulse_info', {}).get('tags', [])[:5]}\n"
        
        return report

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Threat Intelligence Platform - Project 61                  ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     For security monitoring and analysis                      ║
╚════════════════════════════════════════════════════════════════╝

THREAT INTELLIGENCE SOURCES:

| Source | Type | Access |
|--------|------|--------|
| VirusTotal | Aggregated | API key |
| AlienVault OTX | Community | Free API |
| Abuse.ch | Malware | Free API |
| MISP | Self-hosted | Install |
| ThreatConnect | Commercial | Enterprise |
| Recorded Future | Commercial | Enterprise |

STIX/TAXII:

STIX (Structured Threat Information Expression):
- Standard language for threat data
- JSON-based format
- Describes indicators, campaigns, actors

TAXII (Trusted Automated Exchange of Intelligence):
- Protocol for sharing threat data
- Supports polling and push models
- Works with STIX formatted data

IOC TYPES:

| Type | Example | Detection |
|------|---------|-----------|
| IP Address | 192.168.1.1 | Firewall block |
| Domain | evil.com | DNS sinkhole |
| URL | http://evil.com/payload | Proxy block |
| MD5 | d41d8cd98f00b204 | EDR hash block |
| SHA256 | ... | EDR hash block |
| CVE | CVE-2021-44228 | Patch management |

INTELLIGENCE FEEDS:

1. OSINT (Open Source)
   - Threat blogs
   - Vendor reports
   - Community sharing

2. Commercial
   - Recorded Future
   - CrowdStrike Intel
   - Mandiant Advantage

3. Government
   - CISA Alerts
   - FBI IC3
   - ISACs (sectors)

USAGE:

# Check a domain
python3 threat_intel.py --domain evil.com

# Check an IP
python3 threat_intel.py --ip 192.168.1.1

# Batch check
python3 threat_intel.py --batch indicators.txt

""")
    
    if len(sys.argv) > 1:
        indicator = sys.argv[1]
        platform = ThreatIntelPlatform()
        results = platform.analyze_ioc(indicator)
        print(platform.generate_report(results))
    else:
        print("[*] Usage: python3 threat_intel.py <indicator>")

if __name__ == "__main__":
    main()