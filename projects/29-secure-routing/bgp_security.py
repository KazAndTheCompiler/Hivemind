#!/usr/bin/env python3
"""
Secure Routing Protocol Guide - Project 29
Understanding routing security (BGP, OSPF, etc.)

EDUCATIONAL USE ONLY. For understanding network infrastructure security.
"""

def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Secure Routing Protocols Guide - Project 29               ║
╚════════════════════════════════════════════════════════════════╝

COMMON ROUTING PROTOCOLS:

| Protocol | Type | Security Concerns |
|----------|------|-------------------|
| BGP | Exterior Gateway Protocol | Route hijacking, AS manipulation |
| OSPF | Interior Gateway Protocol | Authentication attacks |
| RIP | Distance Vector | Route poisoning |
| EIGRP | Hybrid | Cisco proprietary |
| IS-IS | Link State | Similar to OSPF |

BGP SECURITY ISSUES:

1. ROUTE HIJACKING
   - Malicious AS announces more specific prefix
   - Traffic redirected through attacker's AS
   - Can lead to MITM or data collection
   
2. ROUTE LEAKS
   - Accidental announcement of internal routes
   - Exposes internal network topology
   
3. PATH ATTRIBUTION
   - Fake AS paths to manipulate traffic
   - Hard to detect without global visibility

BGP SECURITY MEASURES:

1. RPKI (Resource Public Key Infrastructure)
   - Cryptographically verifies AS ownership
   - ROAs (Route Origin Authorizations)
   - Prevents route hijacking
   
2. IRR (Internet Routing Registry)
   - Database of routing policies
   - Used for validation
   
3. BGPsec
   - Path validation
   - Cryptographic verification of AS_PATH
   - Slow deployment (low adoption)

RPKI IMPLEMENTATION:

# Install Routinator (RPKI validator)
docker pull ctrix/routinator
docker run -d -p 9323:9323 -v routinator-data:/data ctrix/routinator \\
    routinator -w /data --http 0.0.0.0:9323

# Check route validity
curl http://localhost:9323/validity/<ASN>/<prefix>

OSPF SECURITY:

1. Use OSPF Authentication
   - Plaintext (not recommended)
   - MD5 (better)
   - SHA (recommended)
   
2. Enable cryptographic authentication
   interface GigabitEthernet0/0
    ip ospf message-digest-key 1 md5 <password>

3. Use VLANs to segment
   - Limit L2 adjacencies
   - Control OSPF area boundaries

RIP SECURITY:

1. Enable RIP Authentication
2. Use passive interfaces
3. Disable route poisoning where unnecessary

VERIFICATION COMMANDS:

# BGP
show ip bgp summary
show ip bgp neighbors
show ip bgp

# OSPF
show ip ospf neighbor
show ip ospf interface

# Routing table
show ip route

SECURITY CHECKLIST:

[ ] Implement RPKI for BGP
[ ] Use route filters at AS edges
[ ] Enable OSPF authentication
[ ] Monitor for route changes
[ ] Use looking glasses for verification
[ ] Implement IRR filtering
[ ] Enable logging for routing changes

TOOLS:

- RPKI Validators: Routinator, FortValidator
- BGP Looking Glasses: routeviews.org, ris.ripe.net
- Route analysis: BGPStream, MRTParse
- Monitoring: BGPAlert, Team Cymru

""")

if __name__ == "__main__":
    main()
