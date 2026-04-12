#!/usr/bin/env python3
"""
API Security Testing - Project 45
OWASP API Security Top 10 and testing methodology.

EDUCATIONAL USE ONLY. Only test APIs you own or have permission to test.
"""

import os
import sys
import json
import requests
from typing import Dict, List, Optional

class APISecurityTester:
    """API security testing framework."""
    
    OWASP_API_TOP10 = {
        'API1': 'Broken Object Level Authorization',
        'API2': 'Broken Authentication',
        'API3': 'Broken Object Property Level Authorization',
        'API4': 'Unrestricted Resource Consumption',
        'API5': 'Broken Function Level Authorization',
        'API6': 'Mass Assignment',
        'API7': 'Server Side Request Forgery',
        'API8': 'Security Misconfiguration',
        'API9': 'Improper Inventory Management',
        'API10': 'Insufficient Logging & Monitoring'
    }
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.auth_token = None
    
    def set_auth(self, token: str):
        self.auth_token = token
        self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def test_object_level_authorization(self) -> List[Dict]:
        """Test for Broken Object Level Authorization (API1)."""
        print("[*] Testing Object Level Authorization...")
        
        findings = []
        
        # Test IDOR on user resources
        test_endpoints = [
            '/api/users/1/profile',
            '/api/orders/1234',
            '/api/documents/secret.pdf'
        ]
        
        for endpoint in test_endpoints:
            try:
                response = self.session.get(self.base_url + endpoint)
                
                # Check if we can access other users' resources
                if response.status_code == 200:
                    # In production, would check if this is unauthorized access
                    findings.append({
                        'api': 'API1',
                        'endpoint': endpoint,
                        'method': 'GET',
                        'status': response.status_code,
                        'risk': 'medium'
                    })
            except Exception as e:
                pass
        
        return findings
    
    def test_authentication(self) -> List[Dict]:
        """Test for Broken Authentication (API2)."""
        print("[*] Testing Authentication...")
        
        findings = []
        
        # Test weak credentials
        test_cases = [
            {'username': 'admin', 'password': 'admin'},
            {'username': 'admin', 'password': '123456'},
            {'email': 'admin@example.com', 'password': 'password'}
        ]
        
        for creds in test_cases:
            try:
                response = self.session.post(
                    self.base_url + '/api/auth/login',
                    json=creds
                )
                
                if response.status_code == 200:
                    findings.append({
                        'api': 'API2',
                        'issue': 'Weak credentials accepted',
                        'example': creds,
                        'risk': 'high'
                    })
            except:
                pass
        
        # Test missing rate limiting on login
        for _ in range(10):
            try:
                response = self.session.post(
                    self.base_url + '/api/auth/login',
                    json={'username': 'test', 'password': 'wrong'}
                )
            except:
                break
        
        return findings
    
    def test_mass_assignment(self) -> List[Dict]:
        """Test for Mass Assignment (API6)."""
        print("[*] Testing Mass Assignment...")
        
        findings = []
        
        # Try to modify protected fields
        protected_fields = ['is_admin', 'role', 'user_id', 'credit_limit']
        
        payload = {'name': 'Test User', 'email': 'test@example.com'}
        for field in protected_fields:
            payload[field] = 'admin'
        
        try:
            response = self.session.post(
                self.base_url + '/api/users',
                json=payload
            )
            
            # Check if field was set despite not being in schema
            if response.status_code in [200, 201]:
                resp_data = response.json()
                for field in protected_fields:
                    if field in resp_data:
                        findings.append({
                            'api': 'API6',
                            'issue': f'Mass assignment: {field}',
                            'risk': 'medium'
                        })
        except:
            pass
        
        return findings
    
    def test_ssprf(self) -> List[Dict]:
        """Test for Server-Side Request Forgery (API7)."""
        print("[*] Testing SSRF...")
        
        findings = []
        
        ssrf_targets = [
            'http://localhost/admin',
            'http://169.254.169.254/latest/meta-data/',
            'http://internal-server/local'
        ]
        
        # Test in URL parameters
        for target in ssrf_targets:
            try:
                response = self.session.get(
                    self.base_url + f'/api/fetch?url={target}'
                )
                
                # Check if server fetched the URL
                if response.status_code != 400:
                    findings.append({
                        'api': 'API7',
                        'issue': 'Possible SSRF',
                        'target': target,
                        'risk': 'high'
                    })
            except:
                pass
        
        return findings
    
    def run_all_tests(self) -> Dict:
        """Run all API security tests."""
        print(f"[*] Testing API: {self.base_url}\n")
        
        results = {
            'api1_authorization': self.test_object_level_authorization(),
            'api2_authentication': self.test_authentication(),
            'api6_mass_assignment': self.test_mass_assignment(),
            'api7_ssrf': self.test_ssprf()
        }
        
        return results

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     API Security Testing - Project 45                          ║
║                                                                ║
║     EDUCATIONAL USE ONLY                                       ║
║     Only test APIs you own or have permission to test         ║
╚════════════════════════════════════════════════════════════════╝

OWASP API SECURITY TOP 10 (2023):

API1 | Broken Object Level Authorization
     | Accessing other users' resources (IDOR)

API2 | Broken Authentication
     | Weak auth, no rate limiting, token leakage

API3 | Broken Object Property Level Authorization
     | Excessive data exposure, mass assignment

API4 | Unrestricted Resource Consumption
     | No rate limiting, resource exhaustion

API5 | Broken Function Level Authorization
     | Access to admin endpoints without auth

API6 | Mass Assignment
     | Binding client data to server models

API7 | Server-Side Request Forgery (SSRF)
     | Fetching internal resources via user input

API8 | Security Misconfiguration
     | Unnecessary features, verbose errors

API9 | Improper Inventory Management
     | Old API versions, exposed endpoints

API10| Insufficient Logging & Monitoring
     | No alerts, missing forensic evidence

TESTING TOOLS:

| Tool | Purpose |
|------|---------|
| Burp Suite | Web/API proxy |
| Postman | API testing |
| OWASP ZAP | Automated scanner |
| SoapUI | SOAP/REST testing |
| kubectl | Kubernetes API testing |

COMMON VULNERABILITIES:

1. IDOR (Insecure Direct Object Reference)
   - Change IDs to access other users' data
   - Fix: Implement authorization checks

2. BOLA (Broken Object Level Authorization)
   - APIs don't verify resource ownership
   - Fix: User ownership validation

3. Mass Assignment
   - Client sends more fields than expected
   - Fix: Explicit field allow listing

4. Missing Rate Limiting
   - No protection against brute force
   - Fix: Implement rate limits

5. SSRF
   - User input used in URL fetches
   - Fix: Validate URLs, use safelist

AUTHENTICATION TESTING:

1. Try common credentials
2. Test token generation weaknesses
3. Check for account lockout
4. Verify token expiration
5. Test session fixation

""")
    
    if len(sys.argv) > 1:
        api_url = sys.argv[1]
        tester = APISecurityTester(api_url)
        results = tester.run_all_tests()
        
        print("\n[*] Test Results:")
        for test, findings in results.items():
            print(f"  {test}: {len(findings)} findings")
    else:
        print("[*] Usage: python3 api_tester.py https://api.example.com")

if __name__ == "__main__":
    main()