#!/usr/bin/env python3
"""
DNS Spoofing Detection - Project 16
Detect DNS cache poisoning and spoofing attacks.

EDUCATIONAL USE ONLY. Only use on networks you own or have permission to monitor.
"""

import socket
import struct
import random
import time
import json
from datetime import datetime
from typing import Dict, List, Optional

LOG_FILE = "dns_spoofing_log.json"

class DNSSpoofingDetector:
    """Detect DNS spoofing attacks."""
    
    def __init__(self):
        self.queries = {}
        self.spoofing_attempts = []
        self.dns_cache = {}
    
    def generate_query_id(self) -> int:
        """Generate random DNS query ID."""
        return random.randint(0, 65535)
    
    def parse_dns_response(self, data: bytes) -> Optional[Dict]:
        """Parse DNS response packet."""
        try:
            if len(data) < 12:
                return None
            
            # DNS header
            query_id = struct.unpack("!H", data[0:2])[0]
            flags = struct.unpack("!H", data[2:4])[0]
            questions = struct.unpack("!H", data[4:6])[0]
            answers = struct.unpack("!H", data[6:8])[0]
            
            # Is this a response?
            is_response = bool(flags & 0x8000)
            
            # Check if authoritative
            is_authoritative = bool(flags & 0x0400)
            
            # Parse question section
            qname_offset = 12
            qname = ""
            while qname_offset < len(data):
                length = data[qname_offset]
                if length == 0:
                    break
                qname += data[qname_offset+1:qname_offset+length+1].decode('ascii', errors='ignore') + "."
                qname_offset += length + 1
            
            return {
                "query_id": query_id,
                "is_response": is_response,
                "answers": answers,
                "is_authoritative": is_authoritative,
                "timestamp": datetime.now().isoformat()
            }
        except:
            return None
    
    def check_spoofing_indicators(self, response_data: bytes, expected_ip: str = None) -> List[str]:
        """Check for DNS spoofing indicators."""
        indicators = []
        
        # Check for short transaction IDs
        parsed = self.parse_dns_response(response_data)
        if parsed:
            # Transaction ID predictability check
            if parsed["query_id"] < 1000:
                indicators.append("Suspiciously low DNS transaction ID")
            
            # Non-authoritative response for critical domains
            if not parsed["is_authoritative"]:
                indicators.append("Non-authoritative DNS response")
        
        # Check for mismatched source IP (if we control DNS server)
        # This would require packet capture to implement fully
        
        return indicators
    
    def query_dns(self, hostname: str, dns_server: str = "8.8.8.8") -> Optional[str]:
        """Query DNS for a hostname."""
        try:
            # Create DNS query
            query_id = self.generate_query_id()
            
            # Build DNS query packet
            query = struct.pack("!H", query_id)  # Transaction ID
            query += struct.pack("!H", 0x0100)   # Flags: standard query
            query += struct.pack("!H", 1)         # Questions: 1
            query += struct.pack("!H", 0)         # Answer RRs: 0
            query += struct.pack("!H", 0)         # Authority RRs: 0
            query += struct.pack("!H", 0)         # Additional RRs: 0
            
            # Add question
            for part in hostname.split('.'):
                query += struct.pack("B", len(part)) + part.encode('ascii')
            query += b'\x00'  # End of hostname
            query += struct.pack("!H", 1)         # Type: A record
            query += struct.pack("!H", 1)         # Class: IN
            
            # Send query
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(5)
            sock.sendto(query, (dns_server, 53))
            
            # Receive response
            response, addr = sock.recvfrom(4096)
            sock.close()
            
            # Parse response
            parsed = self.parse_dns_response(response)
            
            if parsed and parsed["is_response"]:
                self.queries[query_id] = {
                    "hostname": hostname,
                    "timestamp": parsed["timestamp"],
                    "response_from": addr[0]
                }
                
                # Extract IP from response (simplified)
                if len(response) > 12:
                    # Skip to answer section
                    return f"Response from {addr[0]} (ID: {query_id})"
            
            return None
            
        except Exception as e:
            return None
    
    def detect_cache_timing_anomaly(self, hostname: str, dns_server: str = "8.8.8.8") -> bool:
        """Check if DNS response time is suspiciously fast."""
        start = time.time()
        result = self.query_dns(hostname, dns_server)
        elapsed = time.time() - start
        
        # Normal DNS lookup: 10-100ms
        # Suspicious: < 5ms (possibly spoofed response)
        if elapsed < 0.005 and result:
            self.spoofing_attempts.append({
                "hostname": hostname,
                "response_time": elapsed,
                "reason": "Suspiciously fast DNS response",
                "timestamp": datetime.now().isoformat()
            })
            return True
        
        return False
    
    def generate_report(self) -> str:
        """Generate detection report."""
        report = f"""
╔════════════════════════════════════════════════════════════════╗
║     DNS SPOOFING DETECTION REPORT                             ║
╚════════════════════════════════════════════════════════════════╝

Total DNS Queries: {len(self.queries)}
Spoofing Attempts Detected: {len(self.spoofing_attempts)}

"""
        
        if self.spoofing_attempts:
            report += "DETECTED ANOMALIES:\n\n"
            for attempt in self.spoofing_attempts:
                report += f"  Hostname: {attempt['hostname']}\n"
                report += f"  Response Time: {attempt['response_time']*1000:.2f}ms\n"
                report += f"  Reason: {attempt['reason']}\n"
                report += f"  Time: {attempt['timestamp']}\n\n"
        else:
            report += "[+] No spoofing detected.\n"
        
        report += """
────────────────────────────────────────────────────────────────
DETECTION METHODS
────────────────────────────────────────────────────────────────

1. Transaction ID Validation
   - DNS responses should match query IDs
   - Low/sequential IDs are suspicious

2. Response Timing Analysis
   - Normal DNS: 10-100ms
   - Spoofed: < 5ms (pre-generated)

3. Source IP Verification
   - Responses should come from legitimate DNS servers
   - Unexpected sources are suspicious

4. DNSSEC Validation (if available)
   - Validates cryptographic signatures

────────────────────────────────────────────────────────────────
RECOMMENDATIONS
────────────────────────────────────────────────────────────────

1. Enable DNSSEC on your domains
2. Use trusted DNS servers (8.8.8.8, 1.1.1.1)
3. Monitor DNS for unusual patterns
4. Implement DNS-over-HTTPS (DoH)
5. Check router DNS settings for tampering
"""
        
        return report

def main():
    detector = DNSSpoofingDetector()
    
    print("""
╔════════════════════════════════════════════════════════════════╗
║     DNS Spoofing Detection - Project 16                      ║
║                                                                ║
║     Educational tool for detecting DNS attacks               ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # Test detection
    test_domains = ["google.com", "example.com", "github.com"]
    
    print("[*] Testing DNS resolution and detection...")
    for domain in test_domains:
        result = detector.detect_cache_timing_anomaly(domain)
        if result:
            print(f"    [!] Suspicious: {domain}")
        else:
            print(f"    [+] Normal: {domain}")
    
    print(detector.generate_report())

if __name__ == "__main__":
    main()
