#!/usr/bin/env python3
"""
Web Security Header Analyzer - Project 40
Analyze and improve security headers on web applications.

EDUCATIONAL USE ONLY. For testing your own applications.
"""

import sys
import requests
from typing import Dict, List

class SecurityHeaderAnalyzer:
    """Analyze security headers on web applications."""
    
    REQUIRED_HEADERS = {
        'Strict-Transport-Security': {
            'description': 'Enforces HTTPS connections',
            'recommendation': 'max-age=31536000; includeSubDomains'
        },
        'Content-Security-Policy': {
            'description': 'Prevents XSS and injection attacks',
            'recommendation': "default-src 'self'; script-src 'self'"
        },
        'X-Content-Type-Options': {
            'description': 'Prevents MIME type sniffing',
            'recommendation': 'nosniff'
        },
        'X-Frame-Options': {
            'description': 'Prevents clickjacking attacks',
            'recommendation': 'DENY or SAMEORIGIN'
        },
        'X-XSS-Protection': {
            'description': 'Legacy XSS filter (deprecated but still useful)',
            'recommendation': '1; mode=block'
        },
        'Referrer-Policy': {
            'description': 'Controls referrer information',
            'recommendation': 'strict-origin-when-cross-origin'
        },
        'Permissions-Policy': {
            'description': 'Controls browser features',
            'recommendation': 'geolocation=(), camera=(), microphone=()'
        }
    }
    
    def __init__(self, url: str):
        self.url = url if url.startswith('http') else f'https://{url}'
        self.headers: Dict[str, str] = {}
        self.missing: List[str] = []
        self.present: List[str] = []
    
    def fetch_headers(self) -> bool:
        """Fetch headers from target URL."""
        try:
            response = requests.get(self.url, timeout=10, verify=True)
            self.headers = dict(response.headers)
            return True
        except requests.exceptions.SSLError:
            # Try without verification for testing
            try:
                response = requests.get(self.url, timeout=10, verify=False)
                self.headers = dict(response.headers)
                return True
            except Exception as e:
                print(f"[!] Error fetching {self.url}: {e}")
                return False
        except Exception as e:
            print(f"[!] Error fetching {self.url}: {e}")
            return False
    
    def analyze_headers(self) -> Dict:
        """Analyze security headers."""
        results = {
            'url': self.url,
            'missing': [],
            'present': [],
            'warnings': [],
            'score': 0
        }
        
        max_score = len(self.REQUIRED_HEADERS)
        
        for header, info in self.REQUIRED_HEADERS.items():
            if header in self.headers:
                self.present.append(header)
                results['present'].append({
                    'header': header,
                    'value': self.headers[header],
                    'description': info['description']
                })
                results['score'] += 1
            else:
                self.missing.append(header)
                results['missing'].append({
                    'header': header,
                    'description': info['description'],
                    'recommendation': info['recommendation']
                })
        
        if results['score'] < max_score:
            results['warnings'].append(f"Missing {max_score - results['score']} security headers")
        
        return results
    
    def generate_report(self, results: Dict) -> str:
        """Generate security header report."""
        score = results['score']
        max_score = len(self.REQUIRED_HEADERS)
        percentage = int((score / max_score) * 100) if max_score > 0 else 0
        
        grade = 'A' if percentage >= 90 else 'B' if percentage >= 70 else 'C' if percentage >= 50 else 'F'
        
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     WEB SECURITY HEADER ANALYSIS                             ║
╚════════════════════════════════════════════════════════════════╝

URL: {results['url']}
Score: {score}/{max_score} ({percentage}%)
Grade: {grade}

"""
        
        if results['present']:
            report += """
────────────────────────────────────────────────────────────────
✓ PRESENT HEADERS
────────────────────────────────────────────────────────────────
"""
            for header in results['present']:
                report += f"\n{header['header']}\n"
                report += f"  Value: {header['value']}\n"
                report += f"  Purpose: {header['description']}\n"
        
        if results['missing']:
            report += """
────────────────────────────────────────────────────────────────
✗ MISSING HEADERS
────────────────────────────────────────────────────────────────
"""
            for header in results['missing']:
                report += f"\n{header['header']}\n"
                report += f"  Purpose: {header['description']}\n"
                report += f"  Recommendation: {header['recommendation']}\n"
        
        report += """
────────────────────────────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────────────────────────────

To add missing headers in Nginx:

server {
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

For Apache (.htaccess):

Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set Content-Security-Policy "default-src 'self'"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"

"""
        
        return report

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Web Security Header Analyzer - Project 40                 ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Analyze headers on your own applications                  ║
╚════════════════════════════════════════════════════════════════╝

SECURITY HEADERS CHECKED:

| Header | Purpose | Importance |
|--------|---------|-------------|
| HSTS | Force HTTPS | Critical |
| CSP | Prevent XSS | Critical |
| X-Content-Type | MIME sniffing | High |
| X-Frame-Options | Clickjacking | High |
| Referrer-Policy | Referrer leak | Medium |
| Permissions-Policy | Feature control | Medium |

SECURITY GRADE:

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90-100% | Excellent |
| B | 70-89% | Good |
| C | 50-69% | Needs improvement |
| D | 30-49% | Poor |
| F | 0-29% | Critical issues |

""")
    
    if len(sys.argv) > 1:
        url = sys.argv[1]
        analyzer = SecurityHeaderAnalyzer(url)
        
        print(f"[*] Analyzing: {url}\n")
        
        if analyzer.fetch_headers():
            results = analyzer.analyze_headers()
            print(analyzer.generate_report(results))
        else:
            print("[!] Failed to fetch headers")
    else:
        print("[*] Usage: python3 header_analyzer.py https://example.com")
        print("\n[*] Running demo...\n")
        
        # Demo with example
        analyzer = SecurityHeaderAnalyzer("https://example.com")
        if analyzer.fetch_headers():
            results = analyzer.analyze_headers()
            print(analyzer.generate_report(results))

if __name__ == "__main__":
    main()