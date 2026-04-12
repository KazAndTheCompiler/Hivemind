#!/bin/bash
# Network Segmentation Audit - Project 54

echo "
╔════════════════════════════════════════════════════════════════╗
║     Network Segmentation Audit - Project 54                   ║
╚════════════════════════════════════════════════════════════════╝

NETWORK SEGMENTATION:

Why Segment?
- Limit lateral movement
- Isolate critical assets
- Reduce attack surface
- Compliance requirements
- Performance optimization

COMMON SEGMENTS:

┌─────────────────────────────────────────────────────────────┐
│                      INTERNET                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
              ┌───────┴───────┐
              │   DMZ (Publ)  │  - Web servers
              │   10.0.1.0/24 │  - Mail relays
              └───────────────┘    - DNS servers
                      │
              ┌───────┴───────┐
              │  SECURE ZONE  │  - Database servers
              │  10.0.2.0/24  │  - Internal APIs
              └───────────────┘  - File servers
                      │
              ┌───────┴───────┐
              │   OFFICE LAN  │  - Workstations
              │  192.168.1.0/24│ - Printers
              └───────────────┘  - VoIP
                      │
              ┌───────┴───────┐
              │  MANAGEMENT   │  - Admin access
              │  10.0.10.0/24 │  - Monitoring
              └───────────────┘  - Jump servers

FIREWALL RULES (Default Deny):

# DMZ to Internal: DENY (web should not access DB)
iptables -A FORWARD -s 10.0.1.0/24 -d 10.0.2.0/24 -j DROP

# Office to DMZ: ALLOW (users browse web)
iptables -A FORWARD -s 192.168.1.0/24 -d 10.0.1.0/24 -p tcp --dport 443 -j ACCEPT

# Office to Internal: DENY (no direct DB access)
iptables -A FORWARD -s 192.168.1.0/24 -d 10.0.2.0/24 -j DROP

# Management: LIMITED ACCESS
iptables -A FORWARD -s 10.0.10.0/24 -d 192.168.1.0/24 -p tcp --dport 3389 -j DROP

SEGMENTATION TESTING:

1. REACHABILITY SCAN
   # From each segment, scan other segments
   nmap -sn 10.0.2.0/24  # From DMZ, should not reach internal
   
2. FIREWALL TESTING
   # Test deny rules
   nmap -p 445 10.0.2.10  # From office, should be blocked
   
3. LATERAL MOVEMENT TEST
   # If compromised, what can attacker reach?
   # Simulate breach in each segment

VLAN CONFIGURATION:

# Create VLANs
vconfig add eth0 100  # DMZ
vconfig add eth0 200  # Internal
vconfig add eth0 300  # Office

# Assign IPs
ip addr add 10.0.1.1/24 dev eth0.100
ip addr add 10.0.2.1/24 dev eth0.200
ip addr add 192.168.1.1/24 dev eth0.300

AWS SECURITY GROUPS:

# Web server security group
aws ec2 create-security-group --group-name web-servers --description \"Web tier\"

# Allow HTTP/HTTPS only from internet
aws ec2 authorize-security-group-ingress --group-id sg-xxx \\
    --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress --group-id sg-xxx \\
    --protocol tcp --port 443 --cidr 0.0.0.0/0

# Allow SSH only from management
aws ec2 authorize-security-group-ingress --group-id sg-xxx \\
    --protocol tcp --port 22 --source-group sg-management

# DENY all other traffic (implicit)

KUBERNETES NETWORK POLICIES:

# Default deny all ingress/egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

# Allow web to database only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-to-db
spec:
  podSelector:
    matchLabels:
      app: database
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web
    ports:
    - protocol: TCP
      port: 5432

SEGMENTATION AUDIT CHECKLIST:

[ ] Network diagram updated
[ ] All segments documented
[ ] Firewall rules documented
[ ] Default deny configured
[ ] Cross-segment traffic reviewed
[ ] Management access secured
[ ] Segmentation tested (nmap)
[ ] VLANs properly isolated
[ ] Cloud security groups reviewed
[ ] Network policies enforced

MONITORING SEGMENTS:

# Monitor for cross-segment traffic
# Should not see office segment reaching database segment
# Zeek, Suricata for network monitoring

TOOLS:

| Tool | Purpose |
|------|---------|
| nmap | Network scanning |
| Zeek | Network analysis |
| Wireshark | Packet capture |
| iftop | Traffic monitoring |
| iptables | Firewall rules |

"

# Check for tools
echo -e \"\\n[*] Checking network tools...\"
for tool in nmap iptables zeek; do
    if command -v $tool &> /dev/null 2>&1; then
        echo \"[+] $tool installed\"
    else
        echo \"[-] $tool not found\"
    fi
done