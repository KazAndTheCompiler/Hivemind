#!/usr/bin/env python3
"""
Dark Web Research Scraper - Project 32
Ethical dark web research for security professionals.

⚠️ CRITICAL LEGAL WARNING ⚠️
Only use on .onion sites you have explicit permission to access.
Unauthorized access is illegal in most jurisdictions.

This is for:
- Security researchers studying threat landscape
- Journalists researching illegal marketplaces
- Law enforcement investigations
"""

import socket
import socks
import requests
import stem
import time
import json
from pathlib import Path
from typing import List, Dict, Optional

class DarkWebResearcher:
    """Ethical dark web research framework."""
    
    def __init__(self, tor_proxy: str = "127.0.0.1:9050"):
        self.tor_proxy = tor_proxy
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create requests session with Tor proxy."""
        session = requests.Session()
        session.proxies = {
            'http': f'socks5h://{self.tor_proxy}',
            'https': f'socks5h://{self.tor_proxy}'
        }
        session.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0'
        return session
    
    def check_tor_connection(self) -> bool:
        """Verify Tor connection is working."""
        try:
            response = self.session.get('https://check.torproject.org/api/ip', timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"[+] Tor connected. IP: {data.get('IP', 'unknown')}")
                return True
        except Exception as e:
            print(f"[!] Tor connection failed: {e}")
        return False
    
    def fetch_onion_site(self, url: str, timeout: int = 30) -> Optional[Dict]:
        """Fetch content from .onion site."""
        if not url.endswith('.onion'):
            print("[!] Not a .onion URL")
            return None
        
        try:
            response = self.session.get(url, timeout=timeout)
            return {
                'url': url,
                'status_code': response.status_code,
                'content_length': len(response.content),
                'headers': dict(response.headers),
                'content_preview': response.text[:500]
            }
        except Exception as e:
            return {'url': url, 'error': str(e)}
    
    def research_keywords(self, sites: List[str], keywords: List[str]) -> Dict:
        """Search for keywords across multiple sites."""
        results = {}
        
        for site in sites:
            print(f"[*] Researching: {site}")
            content = self.fetch_onion_site(site)
            
            if content and 'content_preview' in content:
                for keyword in keywords:
                    if keyword.lower() in content['content_preview'].lower():
                        results[site] = results.get(site, [])
                        results[site].append(keyword)
            
            time.sleep(2)  # Rate limiting
        
        return results

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Dark Web Research Framework - Project 32                  ║
║                                                                ║
║     ⚠️ CRITICAL LEGAL WARNING ⚠️                                ║
║                                                                ║
║     Only access .onion sites you have explicit permission     ║
║     to access. Unauthorized access is illegal.                ║
║                                                                ║
║     This is for security researchers and journalists only.      ║
╚════════════════════════════════════════════════════════════════╝

PREREQUISITES:

1. Tor installed: sudo apt install tor
2. Tor service running: sudo systemctl start tor
3. Verify connection: curl --socks5h 127.0.0.1:9050 https://check.torproject.org/api/ip

LEGITIMATE USES:

- Security research on threat actors
- Tracking illegal marketplace trends
- Monitoring brand impersonation
- Researching stolen data exposure
- Journalistic investigations

NEVER DO:

- Purchase illegal items
- Access without authorization
- Download illegal content
- Share illegal materials
- Exploit vulnerabilities

RESEARCH TOPICS:

| Topic | Purpose |
|-------|---------|
| Threat Intel | Monitor actor discussions |
| Brand Protection | Find impersonation |
| Stolen Data | Track exposure |
| CVE Research | Dark web CVE discussions |

USAGE:

# Start Tor first
sudo systemctl start tor

# Then run research
python3 scraper.py

# Check Tor connection
python3 scraper.py check

""")
    
    researcher = DarkWebResearcher()
    
    # Check connection
    researcher.check_tor_connection()

if __name__ == "__main__":
    main()
